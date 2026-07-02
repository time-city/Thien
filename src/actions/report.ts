"use server"

import { prisma } from "@/lib/prisma";

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
    attendanceStatus: string;
    homeworkStatus: string | null;
    note: string | null;
    teacherName: string;
  }[];
};

export async function getStudentCourseReport(studentId: string, classId: string): Promise<StudentCourseReport | null> {
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
        classId: classId
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
  }[];
  totalExpectedAmount: number;
  logs: {
    id: string;
    className: string;
    date: Date;
    startTime: Date;
    endTime: Date;
    attendanceStatus: string;
    homeworkStatus: string | null;
    note: string | null;
    teacherName: string;
  }[];
};

export async function getStudentCombinedReport(studentId: string): Promise<StudentCombinedReport | null> {
  const student = await prisma.student.findUnique({
    where: { id: studentId },
    select: { fullName: true, phoneStudent: true, phoneParent: true }
  });
  if (!student) return null;

  // 1. Fetch enrollments that need payment (remainingSessions <= 2)
  const enrollments = await prisma.enrollment.findMany({
    where: {

      studentId,
      status: { not: "DROPPED" },
      remainingSessions: { lte: 2 }
    },
    include: { class: true }
  });

  // 2. Fetch all underpaid invoices (debts)
  const underpaidInvoices = await prisma.invoice.findMany({
    where: { studentId, status: "UNDERPAID" },
    orderBy: { createdAt: "asc" }
  });

  const pendingInvoices = await prisma.invoice.findMany({
    where: { studentId, status: "PENDING" },
    include: { enrollment: { include: { class: true } } }
  });

  const items: StudentCombinedReport["items"] = [];
  let totalExpectedAmount = 0;
  const processedInvoiceIds = new Set<string>();

  // Process enrollments
  for (const enr of enrollments) {
    // Check if there's already a pending invoice specifically for this enrollment
    const inv = pendingInvoices.find(i => !i.isDebt && i.enrollmentId === enr.id);
    const amount = inv ? inv.expectedAmount : enr.class.pricePerSession;

    if (inv) {
      processedInvoiceIds.add(inv.id);
    }

    items.push({
      type: "TUITION",
      enrollmentId: enr.id,
      className: enr.class.name,
      amount: amount,
      sessionsPerPackage: enr.class.sessionsPerPackage,
      pendingInvoiceId: inv?.id,
      voucherNumber: enr.currentVoucher
    });
    totalExpectedAmount += amount;
  }

  // Process any other PENDING invoices that weren't caught above
  for (const inv of pendingInvoices) {
    if (!processedInvoiceIds.has(inv.id)) {
      const debt = inv.expectedAmount - inv.amountPaid;
      items.push({
        type: inv.isDebt ? "DEBT" : "TUITION",
        enrollmentId: inv.enrollmentId || undefined,
        className: inv.enrollment?.class?.name || "Hóa đơn tổng hợp",
        amount: debt,
        sessionsPerPackage: inv.enrollment?.class?.sessionsPerPackage,
        pendingInvoiceId: inv.id,
        voucherNumber: inv.enrollment?.currentVoucher
      });
      totalExpectedAmount += debt;
    }
  }

  // Process rollover debts
  for (const inv of underpaidInvoices) {
    const debt = inv.expectedAmount - inv.amountPaid;
    items.push({
      type: "DEBT",
      amount: debt,
      pendingInvoiceId: inv.id
    });
    totalExpectedAmount += debt;
  }

  // Fetch logs for the enrollments being paid
  const classIds = enrollments.map(e => e.classId);
  const logs = await prisma.attendanceLog.findMany({
    where: {
      studentId: studentId,
      isReportSent: false,
      classSession: { classId: { in: classIds } }
    },
    include: {
      classSession: { include: { teacher: true, class: true } }
    },
    orderBy: { classSession: { date: "asc" } }
  });

  // Deduplicate logs by date and slot (or classSessionId) to prevent duplicates from bad test data
  const uniqueLogs = [];
  const seenSessions = new Set();
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
