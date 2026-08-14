"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { sendZaloAndLog } from "@/lib/zalo";

// ==========================================
// [MONTHLY BILLING] Tạo phiếu thu tháng mới
// Được gọi khi admin bấm nút "Tạo phiếu thu tháng X"
// ==========================================
export async function createMonthlyInvoices(month: number, year: number): Promise<{
  success: boolean;
  created: number;
  skipped: number;
  alreadyExists: boolean;
  error?: string;
}> {
  try {
    // Lấy tất cả enrollment ACTIVE kèm thông tin lớp
    const enrollments = await prisma.enrollment.findMany({
      where: { status: "ACTIVE" },
      include: { class: true, student: true }
    });

    let created = 0;
    let skipped = 0;

    const activeEnrollmentIds = enrollments.map((e) => e.id);
    
    const existingInvoices = await prisma.invoice.findMany({
      where: {
        enrollmentId: { in: activeEnrollmentIds },
        status: { in: ["PENDING", "PAID"] }
      }
    });

    const existingSet = new Set(
      existingInvoices
        .filter((inv) => {
          const det = inv.details as any;
          return det?.month === month && det?.year === year;
        })
        .map((inv) => inv.enrollmentId)
    );

    const newInvoicesData: any[] = [];
    const enrollmentsToUpdate: string[] = [];

    for (const enr of enrollments) {
      const enrMonth = enr.createdAt.getMonth() + 1;
      const enrYear = enr.createdAt.getFullYear();
      
      // Bỏ qua nếu tháng mục tiêu nhỏ hơn hoặc bằng tháng ghi danh (tháng đầu miễn phí)
      if (year < enrYear || (year === enrYear && month <= enrMonth)) {
        skipped++;
        continue;
      }

      if (existingSet.has(enr.id)) {
        skipped++;
        continue;
      }

      newInvoicesData.push({
        enrollmentId: enr.id,
        studentId: enr.studentId,
        expectedAmount: enr.class.pricePerSession,
        amountPaid: 0,
        status: "PENDING",
        transactionCode: `MONTHLY-${month}-${year}-${enr.id.slice(-6)}`,
        details: { month, year, billingType: "MONTHLY", className: enr.class.name }
      });
      enrollmentsToUpdate.push(enr.id);
    }

    if (newInvoicesData.length > 0) {
      await prisma.$transaction([
        prisma.invoice.createMany({ data: newInvoicesData }),
        prisma.enrollment.updateMany({
          where: { id: { in: enrollmentsToUpdate } },
          data: { feeStatus: "UNPAID" }
        })
      ]);
      created = newInvoicesData.length;
    }

    return { success: true, created, skipped, alreadyExists: created === 0 && skipped > 0 };
  } catch (error) {
    console.error("createMonthlyInvoices error:", error);
    return { success: false, created: 0, skipped: 0, alreadyExists: false, error: "Lỗi tạo phiếu thu tháng" };
  }
}

// ==========================================
// [MONTHLY BILLING] Thống kê điểm danh tháng trước
// Hiển thị ngay sau khi tạo phiếu thu tháng mới
// ==========================================
export async function getPreviousMonthAttendanceSummary(month: number, year: number): Promise<{
  studentName: string;
  className: string;
  attendedSessions: number;
  totalExpected: number;
  enrollmentId: string;
}[]> {
  // Tính tháng trước
  const prevMonth = month === 1 ? 12 : month - 1;
  const prevYear = month === 1 ? year - 1 : year;

  const startDate = new Date(prevYear, prevMonth - 1, 1);
  const endDate = new Date(prevYear, prevMonth, 0, 23, 59, 59, 999);

  const enrollments = await prisma.enrollment.findMany({
    where: { status: "ACTIVE" },
    include: {
      class: true,
      student: true
    }
  });

  const result = [];
  for (const enr of enrollments) {
    const count = await prisma.attendanceLog.count({
      where: {
        studentId: enr.studentId,
        classSession: {
          classId: enr.classId,
          date: { gte: startDate, lte: endDate },
          isAttendanceSubmitted: true
        }
      }
    });

    result.push({
      studentName: enr.student.fullName,
      className: enr.class.name,
      attendedSessions: count,
      totalExpected: enr.class.sessionsPerPackage,
      enrollmentId: enr.id
    });
  }

  // Sắp xếp theo tên lớp, rồi tên học sinh
  result.sort((a, b) => {
    if (a.className !== b.className) return a.className.localeCompare(b.className);
    return a.studentName.localeCompare(b.studentName);
  });

  return result;
}

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
export async function autoCreateInvoices(studentId: string, month?: number, year?: number) {
  const currentDate = new Date();
  const targetMonth = month || currentDate.getMonth() + 1;
  const targetYear = year || currentDate.getFullYear();

  // Lấy tất cả enrollment đang ACTIVE
  const enrollments = await prisma.enrollment.findMany({
    where: { 
      studentId, 
      status: "ACTIVE"
    },
    include: { class: true }
  });

  for (const enr of enrollments) {
    // Tìm hóa đơn của tháng này (bất kể PENDING hay PAID)
    // Prisma không hỗ trợ lọc JSON trực tiếp tốt trên SQLite/một số DB, nên lọc thủ công ở mảng trả về hoặc query mở rộng
    // Do số lượng hóa đơn của 1 student không quá lớn, ta fetch PENDING hoặc PAID rồi lọc
    const existingInvoices = await prisma.invoice.findMany({
      where: {
        studentId,
        enrollmentId: enr.id
      }
    });

    let hasInvoiceThisMonth = existingInvoices.some(inv => {
      const details = inv.details as any;
      return details?.billingType === "MONTHLY_TUITION" && 
             details?.month === targetMonth && 
             details?.year === targetYear;
    });

    // MIGRATION / FALLBACK LOGIC
    if (!hasInvoiceThisMonth) {
      if (targetYear < 2026 || (targetYear === 2026 && targetMonth <= 7)) {
        hasInvoiceThisMonth = true;
      } else if (targetYear === 2026 && targetMonth === 8) {
        hasInvoiceThisMonth = enr.remainingSessions > 0;
      }
    }

    if (!hasInvoiceThisMonth) {
      // Học phí 1 tháng chính là trường pricePerSession
      const expectedAmount = enr.class.pricePerSession;
      
      await prisma.invoice.create({
        data: {
          studentId,
          enrollmentId: enr.id,
          expectedAmount,
          amountPaid: 0,
          status: "PENDING",
          transactionCode: `MONTH-${targetMonth}-${targetYear}-${enr.id.slice(-6)}`,
          details: { 
            billingType: "MONTHLY_TUITION", 
            className: enr.class.name,
            month: targetMonth,
            year: targetYear
          }
        }
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

          // [MONTHLY BILLING] Không cộng buổi nữa, chỉ cập nhật feeStatus
          const invoiceDetails = invoice.details as any;
          const paidMonth = invoiceDetails?.month;
          const paidYear = invoiceDetails?.year;
          const monthLabel = (paidMonth && paidYear)
            ? `tháng ${paidMonth}/${paidYear}`
            : `tháng hiện tại`;

          await tx.enrollment.update({
            where: { id: trEnrollment.id },
            data: { feeStatus: "PAID" }
          });

          sessionLines += `• ${trEnrollment.class.name}: Đã thanh toán học phí ${monthLabel}\n`;
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
        msg += `_Kính báo./._\n`;
        msg += `_Học phí được tính cố định theo tháng._`;

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
