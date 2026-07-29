"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { sendZaloAndLog } from "@/lib/zalo";

export async function getTotalDebt(studentId: string): Promise<number> {
  // Tự động sinh hóa đơn cho các enrollment cạn buổi (<= 2) mà chưa có hóa đơn
  await autoCreateInvoices(studentId);

  const invoices = await prisma.invoice.findMany({
    where: {
      studentId,
      status: "PENDING"
    }
  });
  return invoices.reduce((sum, inv) => sum + (inv.expectedAmount - inv.amountPaid), 0);
}

// Hàm phụ trợ tự động lên hóa đơn cho các Enrollment đến hạn
async function autoCreateInvoices(studentId: string) {
  await prisma.$transaction(async (tx) => {
    // Khóa dòng học sinh để chống Race Condition khi nhiều luồng cùng gọi getTotalDebt
    await tx.$executeRaw`SELECT id FROM "students" WHERE id = ${studentId}::uuid FOR UPDATE`;

    const unbilledEnrollments = await tx.enrollment.findMany({
      where: { 
        studentId, 
        status: { not: "DROPPED" },
        remainingSessions: { lte: 0 }
      },
      include: { class: true }
    });

    for (const enr of unbilledEnrollments) {
      const existingInv = await tx.invoice.findFirst({
        where: { enrollmentId: enr.id, status: "PENDING" }
      });
      
      const correctAmount = enr.class.pricePerSession;

      if (!existingInv) {
        await tx.invoice.create({
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
        await tx.invoice.update({
          where: { id: existingInv.id },
          data: { expectedAmount: correctAmount }
        });
      }
    }
  });
}

export async function processStudentPayment(
  studentId: string,
  amountPaid: number,
  paymentMethod: "CASH" | "BANK_TRANSFER",
  transactionRef?: string
): Promise<{ success: boolean; message?: string }> {
  try {
    if (amountPaid < 0) return { success: false, message: "Số tiền thanh toán không được âm" };

    // Tự động sinh hóa đơn cho những lớp cạn buổi trước khi đập tiền vào
    await autoCreateInvoices(studentId);

    let sessionLines = "";

    await prisma.$transaction(async (tx) => {
      // 0. KHÓA ROW-LEVEL ĐỂ CHỐNG RACE CONDITION
      await tx.$executeRaw`SELECT id FROM "students" WHERE id = ${studentId}::uuid FOR UPDATE`;

      // 1. Lấy tất cả các hóa đơn cần thanh toán
      const pendingInvoices = await tx.invoice.findMany({
        where: {
          studentId,
          status: "PENDING"
        },
        orderBy: { createdAt: "asc" },
        include: {
          enrollment: {
            include: { class: true }
          }
        }
      });

      if (pendingInvoices.length === 0) {
         // Thanh toán khi không có nợ -> OVERPAID
         await tx.tuitionException.create({
           data: {
             studentId,
             amount: amountPaid,
             type: "OVERPAID",
             note: "Thanh toán dư (Không có môn nào cần gia hạn)"
           }
         });
         return; // Kết thúc transaction sớm
      }

      const totalExpected = pendingInvoices.reduce((sum, inv) => sum + inv.expectedAmount, 0);
      const tRef = transactionRef || `${paymentMethod}-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
      let itemIndex = 0;
      let classNames: string[] = [];

      let remainingCash = amountPaid;

      // 2. Xử lý tất cả các hóa đơn PENDING
      for (const invoice of pendingInvoices) {
        // Đổi trạng thái thành PAID bất kể số tiền
        await tx.invoice.update({
          where: { id: invoice.id },
          data: {
            amountPaid: invoice.expectedAmount,
            status: "PAID",
            transactionCode: tRef
          }
        });

        if (invoice.enrollment) {
          const trEnrollment = invoice.enrollment;
          classNames.push(trEnrollment.class.name);

          // Phân bổ log PaymentHistory (chia tiền tượng trưng cho từng lớp)
          const logAmount = Math.min(Math.max(0, remainingCash), invoice.expectedAmount);
          remainingCash -= logAmount;

          await tx.paymentHistory.create({
            data: {
              studentId,
              classId: trEnrollment.classId,
              amount: logAmount,
              paymentMethod,
              status: "SUCCESS",
              transactionCode: `${tRef}-${itemIndex++}`,
              voucherRef: trEnrollment.currentVoucher
            }
          });

          // Cộng buổi học
          const updatedEnr = await tx.enrollment.update({
            where: { id: trEnrollment.id },
            data: {
              feeStatus: "PAID",
              remainingSessions: { increment: trEnrollment.class.sessionsPerPackage },
              currentVoucher: { increment: 1 }
            }
          });
          
          sessionLines += `• ${trEnrollment.class.name}: Đã gia hạn ${trEnrollment.class.sessionsPerPackage} buổi (Hiện có: ${updatedEnr.remainingSessions} buổi)\n`;
        }
      }

      // Xử lý tiền dư (nếu còn)
      if (remainingCash > 0) {
        await tx.tuitionException.create({
          data: {
            studentId,
            amount: remainingCash,
            type: "OVERPAID",
            note: `Thanh toán dư cho các môn: ${classNames.join(", ")}`
          }
        });
      } 
      // Xử lý tiền thiếu
      else if (amountPaid < totalExpected) {
        await tx.tuitionException.create({
          data: {
            studentId,
            amount: totalExpected - amountPaid,
            type: "UNDERPAID",
            note: `Thanh toán thiếu cho các môn: ${classNames.join(", ")}`
          }
        });
      }
    });

    try {
      revalidatePath("/admin/tuition");
      revalidatePath("/admin/history/tuition");
    } catch {}

    // Gửi thông báo Zalo sau khi thanh toán hoàn tất
    try {
      const student = await prisma.student.findUnique({ where: { id: studentId } });
      if (student && student.phoneParent && sessionLines !== "") {
        const formatMoney = (m: number) => new Intl.NumberFormat('vi-VN').format(m) + 'đ';
        const methodVi = paymentMethod === "CASH" ? "Tiền mặt" : "Chuyển khoản";
        
        const today = new Date();
        const monthYear = `${today.getDate().toString().padStart(2, '0')}/${(today.getMonth() + 1).toString().padStart(2, '0')}/${today.getFullYear()}`;

        let msg = `***XÁC NHẬN THANH TOÁN HỌC PHÍ***\n`;
        msg += `Nông trại Khoa học tự nhiên đã nhận thanh toán học phí cho học sinh: ***${student.fullName}***\n`;
        msg += `Phiếu thu ***${monthYear}***\n`;
        msg += `Phương thức: ***${methodVi}***\n`;
        msg += `Số tiền nhận: ***${formatMoney(amountPaid)}***\n`;
        msg += `\n${sessionLines}\n`;
        msg += `_Kính báo./._`;

        await sendZaloAndLog({
          phone: student.phoneParent,
          message: msg,
          messageType: "PAYMENT_CONFIRM",
          studentId,
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
        status: "PENDING"
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
