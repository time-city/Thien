"use server"

import { prisma } from "@/lib/prisma";
import { autoCreateInvoices } from "./invoice";

export type StudentCourseReport = {
  enrollmentId: string;
  studentName: string;
  phoneStudent: string | null;
  phoneParent: string | null;
  className: string;
  sessionsPerPackage: number;
  pricePerSession: number;
  pendingInvoice: { id: string; expectedAmount: number } | null;
  logs: {
    date: Date;
    startTime: Date;
    endTime: Date;
    attendanceStatus: string | null;
    homeworkStatus: string | null;
    note: string | null;
    teacherName: string;
  }[];
};

export async function getStudentCourseReport(studentId: string, classId: string, month?: number, year?: number): Promise<StudentCourseReport | null> {
  const currentDate = new Date();
  const targetMonth = month || currentDate.getMonth() + 1;
  const targetYear = year || currentDate.getFullYear();
  const startDate = new Date(targetYear, targetMonth - 1, 1);
  const endDate = new Date(targetYear, targetMonth, 0, 23, 59, 59, 999);

  const student = await prisma.student.findUnique({
    where: { id: studentId },
    select: { fullName: true, phoneStudent: true, phoneParent: true }
  });
  if (!student) return null;

  const classData = await prisma.class.findUnique({
    where: { id: classId },
    select: { name: true, sessionsPerPackage: true, pricePerSession: true }
  });
  if (!classData) return null;

  const enrollment = await prisma.enrollment.findFirst({
    where: { studentId, classId, status: { not: "DROPPED" } },
    select: { id: true }
  });
  if (!enrollment) return null;

  const pendingInvoice = await prisma.invoice.findFirst({
    where: { enrollmentId: enrollment.id, status: "PENDING" },
    orderBy: { createdAt: "desc" },
    select: { id: true, expectedAmount: true }
  });

  const logs = await prisma.attendanceLog.findMany({
    where: {
      studentId: studentId,
      classSession: {
        classId: classId,
        date: { gte: startDate, lte: endDate }
      }
    },
    include: {
      classSession: {
        include: { teacher: true }
      }
    },
    orderBy: {
      classSession: {
        date: "asc"
      }
    }
  });

  return {
    enrollmentId: enrollment.id,
    studentName: student.fullName,
    phoneStudent: student.phoneStudent,
    phoneParent: student.phoneParent,
    className: classData.name,
    sessionsPerPackage: classData.sessionsPerPackage,
    pricePerSession: classData.pricePerSession,
    pendingInvoice,
    logs: logs.map(log => ({
      id: log.id,
      date: log.classSession.date,
      startTime: log.classSession.startTime,
      endTime: log.classSession.endTime,
      attendanceStatus: log.attendanceStatus,
      homeworkStatus: log.homeworkStatus,
      note: log.note,
      isReportSent: log.isReportSent,
      teacherName: log.classSession.teacher.fullName
    }))
  };
}

export type StudentCombinedReport = {
  studentId: string;
  studentName: string;
  phoneStudent: string | null;
  phoneParent: string | null;
  items: {
    type: "TUITION" | "DEBT";
    enrollmentId?: string;
    className?: string;
    amount: number;
    sessionsPerPackage?: number;
    pendingInvoiceId?: string;
    voucherNumber?: number;
    remainingSessions?: number;
    month?: number;
    year?: number;
  }[];
  totalExpectedAmount: number;
  logs: {
    id: string;
    className: string;
    date: Date;
    startTime: Date;
    endTime: Date;
    attendanceStatus: string | null;
    homeworkStatus: string | null;
    note: string | null;
    teacherName: string;
  }[];
};

export async function getStudentCombinedReport(studentId: string, month?: number, year?: number): Promise<StudentCombinedReport | null> {
  const currentDate = new Date();
  const targetMonth = month || currentDate.getMonth() + 1;
  const targetYear = year || currentDate.getFullYear();
  
  let reportMonth = targetMonth - 1;
  let reportYear = targetYear;
  if (reportMonth === 0) {
    reportMonth = 12;
    reportYear -= 1;
  }

  const startDate = new Date(reportYear, reportMonth - 1, 1);
  const endDate = new Date(reportYear, reportMonth, 0, 23, 59, 59, 999);

  const student = await prisma.student.findUnique({
    where: { id: studentId },
    select: { fullName: true, phoneStudent: true, phoneParent: true }
  });
  if (!student) return null;

  // Gọi hàm cũ để đảm bảo các học sinh nợ (cơ chế cũ) có invoice
  await autoCreateInvoices(studentId, targetMonth, targetYear);

  // 1. Lấy TẤT CẢ hóa đơn PENDING của học sinh
  const allPendingInvoices = await prisma.invoice.findMany({
    where: { studentId, status: "PENDING" },
    include: { enrollment: { include: { class: true } } }
  });

  // Chỉ lấy hóa đơn học phí của đúng tháng đang chọn (và các hóa đơn lẻ khác)
  const pendingInvoices = allPendingInvoices.filter(inv => {
    const details = inv.details as any;
    if (details?.billingType === "MONTHLY_TUITION") {
      return details.month === targetMonth && details.year === targetYear;
    }
    if (details?.billingType === "MONTHLY") return false; // Lọc hóa đơn cũ
    return true;
  });

  const items: StudentCombinedReport["items"] = [];
  let totalExpectedAmount = 0;
  const classIds = new Set<string>();

  for (const inv of pendingInvoices) {
    const debt = inv.expectedAmount - inv.amountPaid;
    const invDetails = inv.details as any;
    
    if (inv.enrollment?.classId) {
      classIds.add(inv.enrollment.classId);
    }

    items.push({
      type: "TUITION",
      enrollmentId: inv.enrollmentId || undefined,
      className: inv.enrollment?.class?.name || "Hóa đơn tổng hợp",
      amount: debt,
      sessionsPerPackage: inv.enrollment?.class?.sessionsPerPackage,
      pendingInvoiceId: inv.id,
      voucherNumber: inv.enrollment?.currentVoucher,
      month: invDetails?.month,
      year: invDetails?.year
    });
    totalExpectedAmount += debt;
  }

  // 2. Lấy log điểm danh TRONG THÁNG mục tiêu cho các lớp mà học sinh đang ACTIVE
  const activeEnrollments = await prisma.enrollment.findMany({
    where: { studentId, status: "ACTIVE" }
  });
  
  for (const enr of activeEnrollments) {
    classIds.add(enr.classId);
  }

  const logs = await prisma.attendanceLog.findMany({
    where: {
      studentId: studentId,
      classSession: { 
        classId: { in: Array.from(classIds) },
        date: { gte: startDate, lte: endDate }
      }
    },
    include: {
      classSession: { include: { teacher: true, class: true } }
    },
    orderBy: [
      { classSession: { classId: "asc" } },
      { classSession: { date: "asc" } }
    ]
  });

  // Dedup: loại bỏ log trùng classSessionId
  const uniqueLogs: typeof logs = [];
  const seenSessions = new Set<string>();
  for (const log of logs) {
    if (!seenSessions.has(log.classSessionId)) {
      seenSessions.add(log.classSessionId);
      uniqueLogs.push(log);
    }
  }

  return {
    studentId,
    studentName: student.fullName,
    phoneStudent: student.phoneStudent,
    phoneParent: student.phoneParent,
    items,
    totalExpectedAmount,
    logs: uniqueLogs.map(log => ({
      id: log.id,
      className: log.classSession.class?.name || "Lớp Tự Do",
      date: log.classSession.date,
      startTime: log.classSession.startTime,
      endTime: log.classSession.endTime,
      attendanceStatus: log.attendanceStatus,
      homeworkStatus: log.homeworkStatus,
      note: log.note,
      teacherName: log.classSession.teacher.fullName
    }))
  };
}

export async function markReportAsSent(logIds: string[]) {
  if (!logIds || logIds.length === 0) return { success: true };
  try {
    await prisma.attendanceLog.updateMany({
      where: { id: { in: logIds } },
      data: {
        isReportSent: true,
        reportedAt: new Date()
      }
    });
    return { success: true };
  } catch (e) {
    console.error("Lỗi đánh dấu báo cáo:", e);
    return { success: false };
  }
}
