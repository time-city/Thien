import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import crypto from "crypto";

export async function POST(req: Request) {
  try {
    // 1. Lấy raw body để xác thực HMAC
    const rawBody = await req.text();
    
    // 2. BẢO MẬT: Kiểm tra HMAC-SHA256
    const signature = req.headers.get("x-sepay-signature");
    const secretKey = process.env.SEPAY_WEBHOOK_SECRET;

    if (!secretKey) {
      console.warn("Chưa cấu hình SEPAY_WEBHOOK_SECRET trong .env");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!signature) {
      return NextResponse.json({ success: false, message: "Thiếu chữ ký" }, { status: 401 });
    }

    // Cắt bỏ chuỗi 'sha256=' (nếu có) để lấy mã hex thuần
    const actualSignature = signature.replace(/^sha256=/, "");

    // Tính toán mã băm từ raw body
    const expectedSignature = crypto.createHmac("sha256", secretKey).update(rawBody).digest("hex");
    if (expectedSignature !== actualSignature) {
      return NextResponse.json({ success: false, message: "Sai chữ ký bảo mật" }, { status: 401 });
    }

    // 3. TRÍCH XUẤT PAYLOAD
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
            { phoneStudent: { contains: studentPhoneMatch } }, // Lọc theo số điện thoại
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

