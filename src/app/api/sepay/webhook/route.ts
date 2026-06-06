import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import crypto from "crypto";

export async function POST(request: Request) {
  try {
    const rawBody = await request.text();
    const signature = request.headers.get("x-sepay-signature") ?? "";
    const timestampHeader = request.headers.get("x-sepay-timestamp") ?? "0";
    const secretKey = process.env.SEPAY_WEBHOOK_SECRET?.trim();

    if (!secretKey) {
      console.error("🚨 THIẾU SEPAY_WEBHOOK_SECRET");
      return NextResponse.json({ success: false, message: "Server error" }, { status: 500 });
    }

    const timestamp = Number(timestampHeader);

    // 1. Kiểm tra timestamp chống replay attack (±5 phút = 300 giây)
    if (Math.abs(Date.now() / 1000 - timestamp) > 300) {
      console.error("🚨 REQUEST QUÁ HẠN (EXPIRED)");
      return NextResponse.json({ success: false, message: "Request expired" }, { status: 401 });
    }

    // 2. Tạo chữ ký chuẩn theo SePay: "sha256=" + hash(timestamp.body)
    const expectedSignature = "sha256=" + crypto.createHmac("sha256", secretKey)
      .update(`${timestamp}.${rawBody}`)
      .digest("hex");

    // 3. So sánh chữ ký an toàn (timingSafeEqual)
    const sigBuffer = Buffer.from(signature);
    const expBuffer = Buffer.from(expectedSignature);

    if (sigBuffer.length !== expBuffer.length || !crypto.timingSafeEqual(sigBuffer, expBuffer)) {
      console.error("🚨 LỆCH CHỮ KÝ BẢO MẬT!");
      return NextResponse.json({ success: false, message: "Invalid signature" }, { status: 401 });
    }

    console.log("✅ [SEPAY WEBHOOK] XÁC THỰC THÀNH CÔNG!");

    // 4. PARSE DỮ LIỆU VÀ XỬ LÝ DATABASE
    let body;
    try {
      body = JSON.parse(rawBody);
    } catch (e) {
      return NextResponse.json({ success: true, reason: "Invalid JSON format" });
    }

    const { id, transferAmount, transferContent, transferType, content: sepayContent, description } = body;

    const sepayId = String(id);
    const amount = Number(transferAmount);
    const contentStr = sepayContent || transferContent || description || "";
    const content = String(contentStr).toUpperCase();

    // CHẶN GIAO DỊCH CHUYỂN TIỀN RA (OUT) HOẶC SỐ TIỀN <= 0
    if (transferType === "out" || isNaN(amount) || amount <= 0) {
      return NextResponse.json({ success: true, reason: "Ignored outgoing or zero amount transfer" });
    }

    // 4. CHỐNG TRÙNG LẶP (IDEMPOTENCY)
    const existingPayment = await prisma.paymentHistory.findUnique({
      where: { transactionCode: sepayId },
    });

    if (existingPayment) {
      return NextResponse.json({ success: true, reason: "Already processed" });
    }

    // 5. XỬ LÝ NGHIỆP VỤ DB (Thu Học Phí)
    // Hỗ trợ cú pháp HT + số điện thoại (VD: HT0901234567) hoặc HP + UUID (VD: HP 123e4567-...)
    const htMatch = content.match(/(?:HT|HP)\s*([a-zA-Z0-9-]+)/i);
    if (htMatch) {
      const studentPhoneMatch = htMatch[1]; // Đây là số điện thoại hoặc mã rút gọn hoặc UUID


      let targetEnrollment: any = null;
      let student: any = null;

      let invoice: any = null;

      // 1. Ưu tiên tìm Hóa đơn (Invoice ID) do mã QR mới gen
      if (studentPhoneMatch.length === 36) {
        invoice = await prisma.invoice.findUnique({
          where: { id: studentPhoneMatch },
          include: { enrollment: { include: { class: true } }, student: true }
        });

        if (invoice) {
          targetEnrollment = invoice.enrollment;
          student = invoice.student;
        } else {
          // Fallback 1: Thử tìm Enrollment ID (mã QR cũ không có invoice)
          targetEnrollment = await prisma.enrollment.findUnique({
            where: { id: studentPhoneMatch },
            include: { class: true, student: true }
          });
          if (targetEnrollment) {
            student = targetEnrollment.student;
          }
        }
      }

      // 2. Fallback: Tìm theo Học sinh (SĐT/ID) nếu phụ huynh gõ tay nội dung cũ
      if (!targetEnrollment) {
        student = await prisma.student.findFirst({
          where: {
            OR: [
              { phoneStudent: { contains: studentPhoneMatch } },
              { phoneParent: { contains: studentPhoneMatch } },
              { id: studentPhoneMatch.length === 36 ? studentPhoneMatch : undefined },
              { qrCodeId: studentPhoneMatch }
            ]
          },
          include: {
            enrollments: {
              include: { class: true }
            }
          }
        });

        if (student) {
          // Tìm lớp học cần gạch nợ (ưu tiên lớp UNPAID hoặc số buổi còn lại ít nhất)
          targetEnrollment = student.enrollments.find((e: any) => e.feeStatus === "UNPAID") || null;
          if (!targetEnrollment && student.enrollments.length > 0) {
            targetEnrollment = student.enrollments.reduce((prev: any, curr: any) =>
              (prev.remainingSessions < curr.remainingSessions) ? prev : curr
            );
          }
        }
      }

      if (student && (targetEnrollment || invoice)) {
        let invoiceStatus: "PAID" | "UNDERPAID" | "OVERPAID" | "PENDING" = "PAID";
        let newAmountPaid = amount;

        if (invoice) {
          const remainingDebt = invoice.expectedAmount - invoice.amountPaid;
          if (amount < remainingDebt) invoiceStatus = "UNDERPAID";
          else if (amount > remainingDebt) invoiceStatus = "OVERPAID";

          newAmountPaid = invoice.amountPaid + amount;
        }

        // Thực hiện hạch toán qua Transaction
        await prisma.$transaction(async (tx) => {
          // 0. Cập nhật hóa đơn (không sinh nợ rời)
          if (invoice) {
            await tx.invoice.update({
              where: { id: invoice.id },
              data: {
                status: invoiceStatus,
                amountPaid: newAmountPaid,
                transactionCode: sepayId,
              }
            });
          }

          // Phân bổ số tiền (Tạo PaymentHistory và cộng buổi học)
          const details = (invoice && Array.isArray(invoice.details) ? invoice.details : []) as any[];
          let remainingAmount = amount;

          // Fallback nếu không có details (đóng qua cú pháp cũ hoặc hóa đơn cũ)
          if (details.length === 0 && targetEnrollment) {
            details.push({
              enrollmentId: targetEnrollment.id,
              amount: invoice?.expectedAmount || amount,
              type: invoice?.isDebt ? "DEBT" : "TUITION"
            });
          }

          let itemIndex = 0;
          for (const item of details) {
            const itemAmount = Number(item.amount) || 0;
            const itemType = item.type || "TUITION";
            const enrollmentId = item.enrollmentId;

            if (enrollmentId) {
              const trEnrollment = await tx.enrollment.findUnique({
                where: { id: enrollmentId },
                include: { class: true }
              });

              if (trEnrollment) {
                const actualItemPaid = invoice ? Math.max(0, Math.min(remainingAmount, itemAmount)) : amount;
                // Ghi nhận lịch sử thanh toán
                await tx.paymentHistory.create({
                  data: {
                    studentId: student.id,
                    classId: trEnrollment.classId,
                    amount: actualItemPaid,
                    paymentMethod: "BANK_TRANSFER",
                    status: "SUCCESS",
                    transactionCode: `${sepayId}-${itemIndex++}`,
                    voucherRef: trEnrollment.currentVoucher + (itemType === "TUITION" ? 1 : 0)
                  }
                });

                // Cộng buổi học nếu là học phí mới và có thực thanh toán
                if (itemType === "TUITION" && actualItemPaid > 0) {
                  await tx.enrollment.update({
                    where: { id: trEnrollment.id },
                    data: {
                      feeStatus: "PAID",
                      remainingSessions: { increment: trEnrollment.class.sessionsPerPackage },
                      currentVoucher: { increment: 1 }
                    }
                  });
                }
              }
            }
            remainingAmount -= itemAmount;
          }
        });
      }
    }

    // 6. LUÔN TRẢ VỀ 200 KÈM {success: true} ĐỂ SEPAY KHÔNG RETRY
    return NextResponse.json({ success: true });

  } catch (error) {
    console.error("SePay Webhook Error:", error);
    // Vẫn trả về 200 để SePay không retry (do lỗi logic server, tránh lặp vô hạn)
    return NextResponse.json({ success: true, reason: "Internal error caught" });
  }
}

