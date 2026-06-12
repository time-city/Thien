"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

export async function getTotalDebt(studentId: string): Promise<number> {
  // Tự động sinh hóa đơn cho các enrollment cạn buổi (<= 2) mà chưa có hóa đơn
  await autoCreateInvoices(studentId);

  const invoices = await prisma.invoice.findMany({
    where: {
      studentId,
      status: { in: ["PENDING", "UNDERPAID"] }
    }
  });
  return invoices.reduce((sum, inv) => sum + (inv.expectedAmount - inv.amountPaid), 0);
}

// Hàm phụ trợ tự động lên hóa đơn cho các Enrollment đến hạn
async function autoCreateInvoices(studentId: string) {
  const unbilledEnrollments = await prisma.enrollment.findMany({
    where: { 
      studentId, 
      status: { not: "DROPPED" },
      remainingSessions: { lte: 2 }
    },
    include: { class: true }
  });

  for (const enr of unbilledEnrollments) {
    const existingInv = await prisma.invoice.findFirst({
      where: { enrollmentId: enr.id, status: { in: ["PENDING", "UNDERPAID"] } }
    });
    
    const correctAmount = enr.class.pricePerSession;

    if (!existingInv) {
      await prisma.invoice.create({
        data: {
          enrollmentId: enr.id,
          studentId: studentId,
          expectedAmount: correctAmount,
          amountPaid: 0,
          status: "PENDING",
          transactionCode: `AUTO-${Date.now()}`
        }
      });
    } else if (existingInv.status === "PENDING" && existingInv.expectedAmount !== correctAmount) {
      // Fix already auto-generated invoices that had wrong amount
      await prisma.invoice.update({
        where: { id: existingInv.id },
        data: { expectedAmount: correctAmount }
      });
    }
  }
}

export async function processStudentPayment(
  studentId: string,
  amountPaid: number,
  paymentMethod: "CASH" | "BANK_TRANSFER",
  transactionRef?: string
): Promise<{ success: boolean; message?: string }> {
  try {
    if (amountPaid <= 0) return { success: false, message: "Số tiền thanh toán phải lớn hơn 0" };

    // Tự động sinh hóa đơn cho những lớp cạn buổi trước khi đập tiền vào
    await autoCreateInvoices(studentId);

    await prisma.$transaction(async (tx) => {
      // 1. Lấy tất cả các hóa đơn cần thanh toán, ưu tiên cũ nhất trước
      const pendingInvoices = await tx.invoice.findMany({
        where: {
          studentId,
          status: { in: ["PENDING", "UNDERPAID"] }
        },
        orderBy: { createdAt: "asc" },
        include: {
          enrollment: {
            include: { class: true }
          }
        }
      });

      let remainingCash = amountPaid;
      const tRef = transactionRef || `${paymentMethod}-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
      let itemIndex = 0;

      for (const invoice of pendingInvoices) {
        if (remainingCash <= 0) break;

        const debtOfThisInvoice = invoice.expectedAmount - invoice.amountPaid;
        const payAmount = Math.min(remainingCash, debtOfThisInvoice);

        if (payAmount > 0) {
          const newAmountPaid = invoice.amountPaid + payAmount;
          const newStatus = newAmountPaid >= invoice.expectedAmount ? "PAID" : "UNDERPAID";

          // Cập nhật hóa đơn
          await tx.invoice.update({
            where: { id: invoice.id },
            data: {
              amountPaid: newAmountPaid,
              status: newStatus,
              transactionCode: tRef
            }
          });

          // Xử lý Enrollment (cộng buổi học) và PaymentHistory
          if (invoice.enrollment) {
            const trEnrollment = invoice.enrollment;

            // Ghi nhận PaymentHistory cho classId này
            await tx.paymentHistory.create({
              data: {
                studentId,
                classId: trEnrollment.classId,
                amount: payAmount,
                paymentMethod,
                status: "SUCCESS",
                transactionCode: `${tRef}-${itemIndex++}`,
                voucherRef: trEnrollment.currentVoucher + 1 // Tham chiếu phiếu thu
              }
            });

            // Cộng buổi học khi hóa đơn này được thanh toán HOÀN TẤT
            if (newStatus === "PAID" && invoice.status !== "PAID") {
              await tx.enrollment.update({
                where: { id: trEnrollment.id },
                data: {
                  feeStatus: "PAID",
                  remainingSessions: { increment: trEnrollment.class.sessionsPerPackage },
                  currentVoucher: { increment: 1 }
                }
              });
            }

          } else {
            // Fallback nếu không có enrollment (ví dụ: hóa đơn gộp cũ chưa bị xóa hết)
            // Tìm một enrollment bất kỳ của học sinh để gán classId cho PaymentHistory
            const fallbackEnrollment = await tx.enrollment.findFirst({
              where: { studentId }
            });
            if (fallbackEnrollment) {
              await tx.paymentHistory.create({
                data: {
                  studentId,
                  classId: fallbackEnrollment.classId,
                  amount: payAmount,
                  paymentMethod,
                  status: "SUCCESS",
                  transactionCode: `${tRef}-${itemIndex++}`
                }
              });
            }
          }

          remainingCash -= payAmount;
        }
      }

      // Xử lý ném tiền thừa (nếu còn)
      // Hiện tại nếu remainingCash > 0, ta có thể lưu nó ở đâu đó, nhưng theo cơ bản ta sẽ bỏ qua hoặc tạo một OVERPAID record
      if (remainingCash > 0) {
        // Tùy chọn: Có thể tạo một hóa đơn OVERPAID mới
        // Hoặc ghi log
        console.log(`Học sinh ${studentId} đã đóng dư ${remainingCash} đ`);
      }
    });

    revalidatePath("/admin/tuition");
    revalidatePath("/admin/history/tuition");
    return { success: true };
  } catch (error) {
    console.error("Lỗi xác nhận thanh toán:", error);
    return { success: false, message: "Lỗi hệ thống khi thanh toán" };
  }
}

export async function checkInvoiceStatus(studentId: string) {
  // Thay đổi logic kiểm tra status: nếu tổng nợ = 0 thì là PAID
  const debt = await getTotalDebt(studentId);
  if (debt <= 0) return { status: "PAID", amountPaid: 0 };
  return { status: "UNDERPAID", amountPaid: 0 }; // Simplified
}
