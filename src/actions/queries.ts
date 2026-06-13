import { prisma } from "@/lib/prisma";
import {
  Role,
  ClassStatus,
  AttendanceStatus,
  HomeworkStatus,
  RentalStatus,
  SessionStatus,
} from "@prisma/client";

// ==========================================
// 1. TÀI KHOẢN (USERS / TEACHERS / ADMINS)
// ==========================================

export type TeacherData = {
  id: string;
  username: string;
  fullName: string;
  role: Role;
  isActive: boolean;
  salaryBalance?: number;
};

export type RentalLogData = {
  id: string;
  teacherId: string;
  teacherName: string;
  classSessionId: string | null;
  className: string | null;
  date: Date;
  slot: number;
  status: RentalStatus;
  feeCalculated: number;
};

export async function getAllUsers(): Promise<TeacherData[]> {
  return await prisma.user.findMany({
    select: {
      id: true,
      username: true,
      fullName: true,
      role: true,
      isActive: true,
    },
    orderBy: { createdAt: "desc" }
  });
}

export async function getUserById(id: string) {
  return await prisma.user.findUnique({
    where: { id },
    select: { id: true, username: true, fullName: true, role: true, isActive: true }
  });
}

export async function getTeachers() {
  return await prisma.user.findMany({
    where: {
      role: "TEACHER"
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function getAllAvailableTeachers() {
  return await prisma.user.findMany({
    where: {
      role: {
        in: ["TEACHER", "SUPER_ADMIN"],
      },
      isActive: true,
    },
    select: {
      id: true,
      fullName: true,
      role: true,
    },
    orderBy: {
      fullName: "asc",
    },
  });
}

// ==========================================
// 2. LỚP HỌC (CLASSES) VÀ THU HỌC PHÍ
// ==========================================

export type TuitionStudentData = {
  id: string;
  fullName: string;
  phoneStudent: string | null;
  phoneParent: string | null;
  enrolledCourses: {
    enrollmentId: string;
    classId: string;
    className: string;
    feeStatus: string;
    remainingSessions: number;
    price: number;
    sessionsPerPackage: number;
    pendingInvoices: { id: string; status: string; expectedAmount: number; amountPaid: number }[];
  }[];
  allPendingInvoices?: { id: string; status: string; expectedAmount: number; amountPaid: number; isDebt: boolean }[];
  hasUnsentReports?: boolean;
  hasLogs?: boolean;
};

export async function getTuitionData(): Promise<TuitionStudentData[]> {
  const students = await prisma.student.findMany({
    include: {
      enrollments: {
        where: {
          status: {
            not: "DROPPED"
          }
        },
        include: { 
          class: true,
          invoices: {
            where: {
              status: { in: ["PENDING", "UNDERPAID"] }
            }
          }
        }
      },
      invoices: {
        where: {
          status: { in: ["PENDING", "UNDERPAID"] }
        }
      },
      attendanceLogs: {
        select: { id: true, isReportSent: true }
      }
    }
  });

  return students.map(s => ({
    id: s.id,
    fullName: s.fullName,
    phoneStudent: s.phoneStudent,
    phoneParent: s.phoneParent,
    allPendingInvoices: s.invoices.map(inv => ({
      id: inv.id,
      status: inv.status,
      expectedAmount: inv.expectedAmount,
      amountPaid: inv.amountPaid,
      isDebt: inv.isDebt
    })),
    hasLogs: s.attendanceLogs && s.attendanceLogs.length > 0,
    hasUnsentReports: s.attendanceLogs && s.attendanceLogs.some(log => !log.isReportSent),
    enrolledCourses: s.enrollments.map(e => ({
      enrollmentId: e.id,
      classId: e.classId,
      className: e.class.name,
      feeStatus: e.feeStatus,
      remainingSessions: e.remainingSessions,
      price: e.class.pricePerSession,
      sessionsPerPackage: e.class.sessionsPerPackage,
      pendingInvoices: e.invoices.map(inv => ({
        id: inv.id,
        status: inv.status,
        expectedAmount: inv.expectedAmount,
        amountPaid: inv.amountPaid
      }))
    }))
  }));
}

export type ClassData = {
  id: string;
  name: string;
  category: string;
  subjectName?: string;
  status: ClassStatus;
  creatorName: string | null;
  createdById: string | null;
  pricePerSession: number;
  sessionsPerPackage: number;
  teachers: { teacherId: string; teacherName: string; salaryPerSession?: number }[];
};

export type RoomData = {
  id: string;
  name: string;
  capacity: number | null;
  feePerSession: number;
  isActive: boolean;
  sessionCount: number;
};

export type TuitionHistoryItem = {
  id: string;
  paymentDate: Date;
  expectedAmount?: number;
  amount: number;
  status?: string;
  paymentMethod: string;
  transactionCode: string | null;
  studentName: string;
  className: string;
  isInvoice: boolean;
};

export type SalaryHistoryItem = {
  id: string;
  paymentDate: Date;
  amount: number;
  note: string | null;
  teacherName: string;
};

export async function getRooms(): Promise<RoomData[]> {
  const rooms = await prisma.room.findMany({
    include: {
      _count: {
        select: { sessions: true },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return rooms.map((room) => ({
    id: room.id,
    name: room.name,
    capacity: room.capacity,
    feePerSession: room.feePerSession,
    isActive: room.isActive,
    sessionCount: room._count.sessions,
  }));
}

export async function getAdminTuitionHistory(): Promise<TuitionHistoryItem[]> {
  const invoices = await prisma.invoice.findMany({
    where: {
      status: { notIn: ["CANCELLED", "MERGED_TO_NEXT"] } // 🟢 Ẩn đi những nợ cũ đã gộp
    },
    include: {
      student: { select: { fullName: true } },
      enrollment: { include: { class: { select: { name: true } } } },
    },
    orderBy: { updatedAt: "desc" },
  });

  const histories = await prisma.paymentHistory.findMany({
    include: {
      student: { select: { fullName: true } },
      class: { select: { name: true } },
    },
    orderBy: { paymentDate: "desc" },
  });

  const merged: TuitionHistoryItem[] = [
    ...invoices.map((inv: any) => ({
      id: inv.id,
      paymentDate: inv.updatedAt,
      expectedAmount: inv.expectedAmount,
      amount: inv.amountPaid,
      status: inv.status,
      paymentMethod: "BANK_TRANSFER",
      transactionCode: inv.transactionCode,
      studentName: inv.student?.fullName || "Không xác định",
      className: inv.enrollment?.class?.name || (inv.isDebt ? "Thu Nợ" : "Thu Tổng Hợp"),
      isInvoice: true,
    })),
    ...histories.map((h: any) => ({
      id: h.id,
      paymentDate: h.paymentDate,
      expectedAmount: h.amount,
      amount: h.amount,
      status: "PAID",
      paymentMethod: h.paymentMethod,
      transactionCode: h.transactionCode,
      studentName: h.student.fullName,
      className: h.class.name,
      isInvoice: false,
    })),
  ];

  merged.sort((a, b) => b.paymentDate.getTime() - a.paymentDate.getTime());

  return merged;
}

export async function getAdminSalaryHistory(): Promise<SalaryHistoryItem[]> {
  const histories = await prisma.salaryPayment.findMany({
    include: {
      teacher: { select: { fullName: true } },
    },
    orderBy: { paymentDate: "desc" },
  });

  return histories.map((item) => ({
    id: item.id,
    paymentDate: item.paymentDate,
    amount: item.amount,
    note: item.note,
    teacherName: item.teacher.fullName,
  }));
}

export async function getTeacherSalaryHistory(teacherId: string): Promise<SalaryHistoryItem[]> {
  const histories = await prisma.salaryPayment.findMany({
    where: { teacherId },
    include: {
      teacher: { select: { fullName: true } },
    },
    orderBy: { paymentDate: "desc" },
  });

  return histories.map((item) => ({
    id: item.id,
    paymentDate: item.paymentDate,
    amount: item.amount,
    note: item.note,
    teacherName: item.teacher.fullName,
  }));
}

export async function getAllClasses(): Promise<ClassData[]> {
  const classes = await prisma.class.findMany({
    include: {
      teachers: { include: { teacher: true } },
      createdBy: { select: { id: true, fullName: true } },
    },
    orderBy: { createdAt: "desc" }
  });

  return classes.map(c => ({
    id: c.id,
    name: c.name,
    category: c.category,
    subjectName: (c as any).subjectName ?? undefined,
    status: c.status,
    creatorName: c.createdBy?.fullName ?? null,
    createdById: c.createdById,
    pricePerSession: c.pricePerSession,
    sessionsPerPackage: c.sessionsPerPackage,
    teachers: c.teachers.map((t) => ({
      teacherId: t.teacherId,
      teacherName: t.teacher.fullName,
      salaryPerSession: t.salaryPerSession,
    })),
  }));
}

export async function getClassById(id: string) {
  return await prisma.class.findUnique({
    where: { id },
    include: {
      teachers: { include: { teacher: true } },
      enrollments: { include: { student: true } },
    },
  });
}

export async function fetchClassDetailsForView(classId: string) {
  return await prisma.class.findUnique({
    where: { id: classId },
    include: {
      teachers: { include: { teacher: true } },
      enrollments: { include: { student: true } },
    },
  });
}

// ==========================================
// 3. HỌC SINH & GHI DANH (STUDENTS & ENROLLMENTS)
// ==========================================
export type SessionLogData = {
  id: string;
  date: Date;
  attendanceStatus: AttendanceStatus;
  homeworkStatus: HomeworkStatus | null;
  note: string | null;
  classId: string | null;
  className: string;
};

export type EnrolledCourseData = {
  enrollmentId: string;
  classId: string;
  className: string;
  subjectName?: string | null;
  remainingSessions: number;
  feeStatus: string;
  status: string;
  teachers: string[];
};

export type StudentData = {
  id: string;
  fullName: string;
  phone: string | null;
  parentName: string | null;
  parentPhone: string | null;
  gender: string | null;
  dob: Date | null;
  school: string | null;
  enrolledCourses: EnrolledCourseData[];
  logs: SessionLogData[];
};

export async function getStudentsDetailed(): Promise<StudentData[]> {
  const students = await prisma.student.findMany({
    include: {
      enrollments: {
        where: {
          status: {
            not: "DROPPED"
          }
        },
        include: {
          class: {
            include: {
              teachers: { include: { teacher: true } },
            },
          },
        },
      },
      attendanceLogs: {
        include: { classSession: { include: { class: true } } },
        orderBy: { classSession: { date: "desc" } },
        take: 10,
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return students.map((s) => ({
    id: s.id,
    fullName: s.fullName,
    phone: s.phoneStudent,
    parentName: s.parentName,
    parentPhone: s.phoneParent,
    gender: s.gender,
    dob: s.dob,
    school: s.school,
    enrolledCourses: s.enrollments.map((e) => ({
      enrollmentId: e.id,
      classId: e.classId,
      className: e.class.name,
      subjectName: (e.class as any).subjectName ?? null,
      remainingSessions: e.remainingSessions,
      feeStatus: e.feeStatus,
      status: e.status,
      teachers: e.class.teachers.map((t) => t.teacher.fullName),
    })),
    logs: s.attendanceLogs.map((log) => ({
      id: log.id,
      date: log.classSession.date,
      attendanceStatus: log.attendanceStatus,
      homeworkStatus: log.homeworkStatus,
      note: log.note,
      classId: log.classSession.classId,
      className: log.classSession.class?.name || "Lớp Tự Do (Thuê phòng)",
    })),
  }));
}

export async function getStudentById(id: string) {
  return await prisma.student.findUnique({
    where: { id },
    include: {
      enrollments: { include: { class: true } }
    }
  });
}

// ==========================================
// 4. LỊCH DẠY (SCHEDULE & SESSIONS)
// ==========================================
export type ScheduleItemData = {
  id: string;
  classId: string;
  className: string;
  teacherId: string;
  teacherName: string;
  roomId: string | null;
  roomName: string | null;
  date: Date;
  slot: number;
  status: string;
  isAttendanceSubmitted: boolean;
  isCancelRequested?: boolean;
  cancelReason?: string | null;
};

export async function getSchedule(roomId?: string, teacherId?: string, status?: string): Promise<ScheduleItemData[]> {
  const sessions = await prisma.classSession.findMany({
    where: {
      ...(teacherId ? { teacherId } : {}),
      ...(roomId ? { roomId } : {}),
      ...(status ? { status: status as SessionStatus } : {}),
    },
    include: { class: true, teacher: true, room: true },
    orderBy: [{ date: "asc" }, { slot: "asc" }]
  });

  return sessions.map(s => ({
    id: s.id,
    classId: s.classId || "freelance",
    className: s.class?.name || "Lớp Tự Do (Thuê phòng)",
    teacherId: s.teacherId,
    teacherName: s.teacher.fullName,
    roomId: s.roomId,
    roomName: s.room?.name ?? null,
    date: s.date,
    slot: s.slot,
    status: s.status,
    isAttendanceSubmitted: s.isAttendanceSubmitted,
    isCancelRequested: s.isCancelRequested,
    cancelReason: s.cancelReason
  }));
}

export type TeacherBookingHistoryItem = {
  id: string;
  classId: string;
  className: string;
  roomId: string | null;
  roomName: string | null;
  date: Date;
  slot: number;
  status: string;
  createdAt?: Date; // In schema, classSession doesn't have createdAt?
};

export async function getTeacherBookingHistory(teacherId: string): Promise<TeacherBookingHistoryItem[]> {
  const sessions = await prisma.classSession.findMany({
    where: { teacherId },
    include: { class: true, room: true },
    orderBy: [{ date: "desc" }, { slot: "desc" }] // Sort newest first
  });

  return sessions.map(s => ({
    id: s.id,
    classId: s.classId || "freelance",
    className: s.class?.name || "Lớp Tự Do (Thuê phòng)",
    roomId: s.roomId,
    roomName: s.room?.name ?? null,
    date: s.date,
    slot: s.slot,
    status: s.status,
  }));
}

// Trả về các session đã được chốt ca (đã submit điểm danh hoặc có status COMPLETED)
export async function getCompletedSessions(): Promise<ScheduleItemData[]> {
  const sessions = await prisma.classSession.findMany({
    where: {
      OR: [
        { isAttendanceSubmitted: true },
        { status: "COMPLETED" }
      ]
    },
    include: { class: true, teacher: true, room: true },
    orderBy: [{ date: "asc" }, { slot: "asc" }]
  });

  return sessions.map(s => ({
    id: s.id,
    classId: s.classId || "freelance",
    className: s.class?.name || "Lớp Tự Do (Thuê phòng)",
    teacherId: s.teacherId,
    teacherName: s.teacher.fullName,
    roomId: s.roomId,
    roomName: s.room?.name ?? null,
    date: s.date,
    slot: s.slot,
    status: s.status,
    isAttendanceSubmitted: s.isAttendanceSubmitted,
    isCancelRequested: s.isCancelRequested,
    cancelReason: s.cancelReason
  }));
}

export async function getSessionById(id: string) {
  return await prisma.classSession.findUnique({
    where: { id },
    include: { class: true, teacher: true }
  });
}

// ==========================================
// 5. TÀI CHÍNH (FINANCE - THU HỌC PHÍ, TRẢ LƯƠNG, THUÊ PHÒNG)
// ==========================================
export async function getTuitionEnrollments() {
  return await prisma.enrollment.findMany({
    include: {
      student: true,
      class: true
    },
    orderBy: { createdAt: "desc" }
  });
}

export async function getRentalLogs(): Promise<RentalLogData[]> {
  const rawLogs = await prisma.roomRentalLog.findMany({
    include: {
      teacher: true,
      classSession: {
        include: { class: true }
      }
    },
    orderBy: { createdAt: "desc" }
  });

  return rawLogs.map((log) => ({
    id: log.id,
    teacherId: log.teacherId,
    teacherName: log.teacher.fullName,
    classSessionId: log.classSessionId,
    className: log.classSession.class?.name || "Lớp Tự Do (Thuê phòng)",
    date: log.classSession.date,
    slot: log.classSession.slot,
    feeCalculated: log.feeCalculated,
    status: log.status,
  }));
}

export async function getPaymentHistory() {
  return await prisma.paymentHistory.findMany({
    include: { student: true, class: true },
    orderBy: { paymentDate: "desc" }
  });
}

// ==========================================
// 6. THIẾT LẬP GIÁO VIÊN VÀ LƯƠNG (TEACHER SETTINGS & FINANCE)
// ==========================================

export type TeacherInfo = {
  id: string;
  fullName: string;
  username: string;
  salaryBalance: number;
  totalRoomFee: number;
  totalEarned: number;
};

export type TeachingHistory = {
  id: string;
  date: Date;
  slot: number;
  className: string;
  status: "completed" | "scheduled";
  isCancelRequested?: boolean;
  cancelReason?: string | null;
};

export async function getTeacherSettingsInfo(teacherId: string) {
  const teacherInfo = await prisma.user.findUnique({
    where: { id: teacherId },
    select: {
      id: true,
      fullName: true,
      username: true,
      salaryBalance: true,
    },
  });

  const agg = await prisma.roomRentalLog.aggregate({
    where: { teacherId },
    _sum: { feeCalculated: true },
  });

  const totalRoomFee = agg._sum.feeCalculated ?? 0;
  const totalEarned = (teacherInfo?.salaryBalance ?? 0) + totalRoomFee;

  const sessions = await prisma.classSession.findMany({
    where: { teacherId },
    include: { class: true },
    orderBy: { date: "desc" },
  });

  const teachingHistory: TeachingHistory[] = sessions.map((s) => ({
    id: s.id,
    date: s.date,
    slot: s.slot,
    className: s.class?.name || "Lớp Tự Do (Thuê phòng)",
    status: s.status === "COMPLETED" ? "completed" : "scheduled",
    isCancelRequested: s.isCancelRequested,
    cancelReason: s.cancelReason,
  }));

  return {
    teacherInfo: teacherInfo
      ? {
        ...teacherInfo,
        totalRoomFee,
        totalEarned,
      }
      : (undefined as any),
    teachingHistory,
  };
}

export type TeacherFinanceViewData = {
  id: string;
  username: string;
  fullName: string;
  salaryBalance: number;
  totalRoomFee: number;
  totalEarned: number;
};

export async function getTeachersForFinance(): Promise<TeacherFinanceViewData[]> {
  const teachers = await prisma.user.findMany({
    where: { role: "TEACHER" },
    select: {
      id: true,
      username: true,
      fullName: true,
      salaryBalance: true,
    },
    orderBy: { fullName: "asc" }
  });

  const result = await Promise.all(
    teachers.map(async (t) => {
      // Tính tổng phí phòng đã trừ
      const roomFeeAggr = await prisma.roomRentalLog.aggregate({
        where: { teacherId: t.id },
        _sum: { feeCalculated: true }
      });
      const totalRoomFee = roomFeeAggr._sum.feeCalculated || 0;

      // Tổng thu nhập giảng dạy = Số dư ví hiện tại + Tổng phí phòng đã trừ
      const totalEarned = t.salaryBalance + totalRoomFee;

      return {
        ...t,
        totalRoomFee,
        totalEarned
      };
    })
  );

  // Sắp xếp ai có số dư ví cao nhất (cần trả lương) lên đầu
  return result.sort((a, b) => b.salaryBalance - a.salaryBalance);
}
