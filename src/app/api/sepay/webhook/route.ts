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


      // Tìm học sinh theo SĐT (phoneStudent) hoặc id/qrCodeId nếu khớp
      const student = await prisma.student.findFirst({
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
        let targetEnrollment = student.enrollments.find(e => e.feeStatus === "UNPAID");
        if (!targetEnrollment && student.enrollments.length > 0) {
          targetEnrollment = student.enrollments.reduce((prev, curr) =>
            (prev.remainingSessions < curr.remainingSessions) ? prev : curr
          );
        }

        if (targetEnrollment) {
          // Thực hiện hạch toán qua Transaction
          await prisma.$transaction(async (tx) => {
            // 1. Tạo lịch sử thanh toán thành công
            await tx.paymentHistory.create({
              data: {
                studentId: student.id,
                classId: targetEnrollment!.classId,
                amount: amount,
                paymentMethod: "BANK_TRANSFER",
                status: "SUCCESS",
                transactionCode: sepayId,
                voucherRef: targetEnrollment!.currentVoucher + 1
              }
            });

            // 2. Cập nhật enrollment (Cộng buổi)
            await tx.enrollment.update({
              where: { id: targetEnrollment!.id },
              data: {
                feeStatus: "PAID",
                remainingSessions: { increment: targetEnrollment!.class.sessionsPerPackage },
                currentVoucher: { increment: 1 }
              }
            });
          });
        }
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

