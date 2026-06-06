"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

export async function createCombinedInvoice(
  studentId: string,
  baseExpectedAmount: number,
  baseDetails: any[]
): Promise<{ success: boolean; invoiceId?: string; message?: string }> {
  try {
    return await prisma.$transaction(async (tx) => {
      // 1. Lọc bỏ các DEBT cũ từ frontend truyền lên (tránh cộng đúp vì ta sẽ tự query)
      const tuitionDetails = baseDetails.filter(d => d.type !== "DEBT");
      let finalExpectedAmount = tuitionDetails.reduce((sum, d) => sum + Number(d.amount || 0), 0);

      // 2. Query tìm TẤT CẢ hóa đơn UNDERPAID của studentId
      const underpaidInvoices = await tx.invoice.findMany({
        where: { studentId, status: "UNDERPAID" }
      });

      // 3. Tính totalDebt và đẩy vào details
      const finalDetails = [...tuitionDetails];
      let totalDebt = 0;

      for (const inv of underpaidInvoices) {
        const debt = inv.expectedAmount - inv.amountPaid;
        totalDebt += debt;
        finalDetails.push({
          type: "DEBT",
          amount: debt,
          originalInvoiceId: inv.id
        });
      }

      finalExpectedAmount += totalDebt;

      // 4. Tìm xem học sinh này đã có Hóa Đơn Gộp nào chưa
      const existingCombined = await tx.invoice.findFirst({
        where: { studentId, status: "PENDING", isDebt: false, enrollmentId: null }
      });

      let combinedInvoiceId: string;

      if (existingCombined) {
        // Cập nhật lại số tiền và chi tiết
        await tx.invoice.update({
          where: { id: existingCombined.id },
          data: { expectedAmount: finalExpectedAmount, details: finalDetails }
        });
        combinedInvoiceId = existingCombined.id;
      } else {
        // Tạo mới Hóa đơn Tổng
        const newInvoice = await tx.invoice.create({
          data: {
            studentId,
            expectedAmount: finalExpectedAmount,
            status: "PENDING",
            details: finalDetails
          }
        });
        combinedInvoiceId = newInvoice.id;
      }

      // 5. Cập nhật các hóa đơn nợ cũ thành MERGED_TO_NEXT
      if (underpaidInvoices.length > 0) {
        await tx.invoice.updateMany({
          where: { id: { in: underpaidInvoices.map(i => i.id) } },
          data: { status: "MERGED_TO_NEXT" }
        });
      }

      return { success: true, invoiceId: combinedInvoiceId };
    });
  } catch (error) {
    console.error("Lỗi khi tạo hóa đơn:", error);
    return { success: false, message: "Lỗi hệ thống khi tạo hóa đơn" };
  }
}

export async function payInvoiceByCash(invoiceId: string, amountPaid: number) {
  try {
    const invoice = await prisma.invoice.findUnique({
      where: { id: invoiceId },
    });
    if (!invoice) return { success: false, message: "Không tìm thấy hóa đơn" };
    if (invoice.status === "PAID") return { success: false, message: "Hóa đơn đã thanh toán" };

    const remainingDebt = invoice.expectedAmount - invoice.amountPaid;
    let invoiceStatus: "PAID" | "UNDERPAID" | "OVERPAID" | "PENDING" = "PAID";
    if (amountPaid < remainingDebt) invoiceStatus = "UNDERPAID";
    else if (amountPaid > remainingDebt) invoiceStatus = "OVERPAID";

    const newAmountPaid = invoice.amountPaid + amountPaid;
    const transactionCode = `CASH-${Date.now()}-${Math.floor(Math.random() * 10000)}`;

    await prisma.$transaction(async (tx) => {
      // 1. Cập nhật hóa đơn (không sinh hóa đơn nợ rời, cứ để UNDERPAID)
      await tx.invoice.update({
        where: { id: invoice.id },
        data: {
          status: invoiceStatus,
          amountPaid: newAmountPaid,
          transactionCode,
        }
      });

      // 4. Phân bổ số tiền (Tạo PaymentHistory và cộng buổi học)
      const details = (Array.isArray(invoice.details) ? invoice.details : []) as any[];
      let remainingAmount = amountPaid;

      // Nếu không có details (hóa đơn cũ), ta fallback xử lý enrollmentId cũ
      if (details.length === 0 && invoice.enrollmentId) {
        details.push({ enrollmentId: invoice.enrollmentId, amount: invoice.expectedAmount, type: invoice.isDebt ? "DEBT" : "TUITION" });
      }

      let itemIndex = 0;
      for (const item of details) {
        const itemAmount = Number(item.amount) || 0;
        const itemType = item.type || "TUITION";
        const enrollmentId = item.enrollmentId;

        // Bỏ qua nếu là DEBT thuần túy mà không có classId
        // Thường nợ sẽ link tới một cái gì đó, nhưng nếu không ta chỉ ghi nhận trả nợ chung.
        if (enrollmentId) {
          const targetEnrollment = await tx.enrollment.findUnique({
            where: { id: enrollmentId },
            include: { class: true }
          });

          if (targetEnrollment) {
            // Ghi nhận lịch sử thanh toán cho classId này
            await tx.paymentHistory.create({
              data: {
                studentId: invoice.studentId,
                classId: targetEnrollment.classId,
                amount: Math.max(0, Math.min(remainingAmount, itemAmount)), // Đảm bảo không bị âm
                paymentMethod: "CASH",
                status: "SUCCESS",
                transactionCode: `${transactionCode}-${itemIndex++}`,
                voucherRef: targetEnrollment.currentVoucher + (itemType === "TUITION" ? 1 : 0) // Chỉ tăng ref nếu là TUITION
              }
            });

            // Nếu là học phí mới -> Cộng buổi
            if (itemType === "TUITION") {
              await tx.enrollment.update({
                where: { id: targetEnrollment.id },
                data: {
                  feeStatus: "PAID",
                  remainingSessions: { increment: targetEnrollment.class.sessionsPerPackage },
                  currentVoucher: { increment: 1 }
                }
              });
            }
          }
        }
        remainingAmount -= itemAmount;
      }
    });

    revalidatePath("/admin/tuition");
    revalidatePath("/admin/history/tuition");
    return { success: true };
  } catch (error) {
    console.error("Lỗi xác nhận tiền mặt:", error);
    return { success: false, message: "Lỗi hệ thống" };
  }
}
