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
    } else if (existingInv.status === "PENDING" && existingInv.expectedAmount !== correctAmount && !existingInv.details) {
      // Chỉ tự động fix amount nếu hóa đơn chưa từng bị sửa tay (chưa có details)
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
                voucherRef: trEnrollment.currentVoucher // Tham chiếu phiếu thu
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

    // Gửi thông báo Zalo sau khi thanh toán hoàn tất
    try {
      const student = await prisma.student.findUnique({ 
        where: { id: studentId },
        include: {
          enrollments: {
            where: { status: { not: "DROPPED" } },
            include: { class: true }
          }
        }
      });

      if (student && student.phoneParent) {
        // Tính lại tổng nợ sau khi đã thanh toán
        const debt = await getTotalDebt(studentId);
        
        const formatMoney = (m: number) => new Intl.NumberFormat('vi-VN').format(m) + 'đ';
        const methodVi = paymentMethod === "CASH" ? "Tiền mặt" : "Chuyển khoản";
        
        const classNames = student.enrollments.map(e => e.class.name).join(" và ") || "Tổng hợp";
        const today = new Date();
        const monthYear = `${today.getDate().toString().padStart(2, '0')}/${(today.getMonth() + 1).toString().padStart(2, '0')}/${today.getFullYear()}`;

        let msg = `***XÁC NHẬN THANH TOÁN HỌC PHÍ***\n`;
        msg += `Nông trại Khoa học tự nhiên ***${debt <= 0 ? 'ĐÃ NHẬN ĐỦ' : 'ĐÃ NHẬN MỘT PHẦN'}*** học phí học sinh: ***${student.fullName}***\n`;
        msg += `Phiếu thu ***${monthYear}***\n`;
        msg += `Lớp: ***${classNames}***\n`;
        msg += `Phương thức: ***${methodVi}***\n`;
        
        if (debt > 0) {
          msg += `\n_Lưu ý: Học phí của bé vẫn còn nợ ${formatMoney(debt)}._\n`;
        }
        
        msg += `_Kính báo./._`;

        await fetch(`${process.env.NEXT_PUBLIC_ZALO_BOT_URL || 'http://116.118.9.61:8080'}/send`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": process.env.NEXT_PUBLIC_ZALO_BOT_API_KEY || ""
          },
          body: JSON.stringify({ target: student.phoneParent, message: msg })
        });
      }
    } catch (zaloErr) {
      console.error("Không thể gửi thông báo Zalo xác nhận thanh toán:", zaloErr);
    }

    return { success: true };
  } catch (error) {
    console.error("Lỗi xác nhận thanh toán:", error);
    return { success: false, message: "Lỗi hệ thống khi thanh toán" };
  }
}

export async function checkInvoiceStatus(studentId: string) {
  const debt = await getTotalDebt(studentId);
  if (debt <= 0) return { status: "PAID", amountPaid: 0 };
  return { status: "UNDERPAID", amountPaid: 0 }; // Simplified
}

export async function applyDiscount(studentId: string, discount: number): Promise<{ success: boolean; message?: string }> {
  try {
    if (discount <= 0) return { success: false, message: "Khấu hao phải lớn hơn 0" };

    const pendingInvoices = await prisma.invoice.findMany({
      where: {
        studentId,
        status: { in: ["PENDING", "UNDERPAID"] }
      },
      orderBy: { createdAt: "asc" }
    });

    let remainingDiscount = discount;

    for (const inv of pendingInvoices) {
      if (remainingDiscount <= 0) break;

      const debtOfThisInvoice = inv.expectedAmount - inv.amountPaid;
      if (debtOfThisInvoice > 0) {
        const discountToApply = Math.min(remainingDiscount, debtOfThisInvoice);
        
        // Retrieve existing details if any
        let newDetails: any = { discount: discountToApply, originalExpected: inv.expectedAmount };
        if (inv.details && typeof inv.details === "object") {
          newDetails = { ...(inv.details as any), ...newDetails, accumulatedDiscount: ((inv.details as any).accumulatedDiscount || 0) + discountToApply };
        } else {
          newDetails.accumulatedDiscount = discountToApply;
        }

        await prisma.invoice.update({
          where: { id: inv.id },
          data: {
            expectedAmount: inv.expectedAmount - discountToApply,
            details: newDetails
          }
        });

        remainingDiscount -= discountToApply;
      }
    }

    revalidatePath("/admin/tuition");
    return { success: true };
  } catch (error) {
    console.error("Lỗi áp dụng khấu hao:", error);
    return { success: false, message: "Lỗi hệ thống khi áp dụng khấu hao" };
  }
}
