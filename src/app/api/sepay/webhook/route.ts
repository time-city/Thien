import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import crypto from "crypto";

export async function POST(request: Request) {
  try {
    const rawBody = await request.text();
    
    // Lấy header (Xử lý case-insensitive)
    const signatureHeader = request.headers.get("x-sepay-signature") || request.headers.get("X-SePay-Signature");
    const secretKey = process.env.SEPAY_WEBHOOK_SECRET;

    // 1. Kiểm tra biến môi trường và header
    if (!secretKey) {
      console.error("🚨 [SEPAY WEBHOOK] LỖI: Thiếu biến môi trường SEPAY_WEBHOOK_SECRET trên Server");
      return NextResponse.json({ success: false, message: "Server configuration error" }, { status: 500 });
    }
    if (!signatureHeader) {
      console.error("🚨 [SEPAY WEBHOOK] LỖI: Request không có header X-SePay-Signature");
      return NextResponse.json({ success: false, message: "Missing signature" }, { status: 401 });
    }

    // 2. Làm sạch chữ ký (Cắt bỏ tiền tố sha256= nếu có)
    const actualSignature = signatureHeader.replace(/^sha256=/, "").trim();

    // 3. Băm dữ liệu Raw Body
    const hmac = crypto.createHmac("sha256", secretKey);
    hmac.update(rawBody);
    const expectedSignature = hmac.digest("hex");

    // 4. Đối chiếu và in Log chi tiết nếu sai
    if (actualSignature !== expectedSignature) {
      console.error("🚨 [SEPAY WEBHOOK] LỆCH CHỮ KÝ BẢO MẬT!");
      console.error("   - Header gửi lên :", actualSignature);
      console.error("   - Server tính ra :", expectedSignature);
      console.error("   - Raw Body size  :", rawBody.length);
      return NextResponse.json({ success: false, message: "Invalid signature" }, { status: 401 });
    }

    console.log("✅ [SEPAY WEBHOOK] Xác thực chữ ký THÀNH CÔNG!");

    // --- BẮT ĐẦU LOGIC PARSE JSON VÀ UPDATE DATABASE Ở ĐÂY ---
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

