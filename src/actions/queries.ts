import { prisma } from "@/lib/prisma";
import { 
  Role, 
  AttendanceStatus, 
  HomeworkStatus, 
  RentalStatus,
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
    },
    orderBy: {
      fullName: "asc", 
    },
  });
}

// ==========================================
// 2. LỚP HỌC (CLASSES)
// ==========================================

export type TuitionStudentData = {
  id: string;
  fullName: string;
  enrolledCourses: {
    enrollmentId: string;
    className: string;
    feeStatus: string;
    remainingSessions: number;
    price: number;
  }[];
};

export async function getTuitionData(): Promise<TuitionStudentData[]> {
  const students = await prisma.student.findMany({
    include: {
      enrollments: {
        include: { class: true } // Đã xóa include subject
      }
    }
  });

  return students.map(s => ({
    id: s.id,
    fullName: s.fullName,
    enrolledCourses: s.enrollments.map(e => ({
      enrollmentId: e.id,
      className: e.class.name,
      feeStatus: e.feeStatus,
      remainingSessions: e.remainingSessions,
      // Tính giá của gói học (Giá 1 buổi x Số buổi) lấy thẳng từ Class
      price: e.class.pricePerSession * e.class.sessionsPerPackage
    }))
  }));
}

export type ClassData = {
  id: string;
  name: string;
  category: string;
  subjectName?: string;
  roomFeePerSession: number;
  pricePerSession: number;
  sessionsPerPackage: number;
  teachers: { teacherId: string; teacherName: string }[];
};

export async function getAllClasses(): Promise<ClassData[]> {
  const classes = await prisma.class.findMany({
    include: {
      teachers: { include: { teacher: true } }
    },
    orderBy: { createdAt: "desc" }
  });

  return classes.map(c => ({
    id: c.id,
    name: c.name,
    category: c.category,
    subjectName: (c as any).subjectName ?? undefined,
    roomFeePerSession: c.roomFeePerSession,
    pricePerSession: c.pricePerSession,
    sessionsPerPackage: c.sessionsPerPackage,
    teachers: c.teachers.map(ct => ({
      teacherId: ct.teacherId,
      teacherName: ct.teacher.fullName
    }))
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
        include: {
          class: {
            include: {
              teachers: { include: { teacher: true } },
            },
          },
        },
      },
      attendanceLogs: {
        include: { classSession: true },
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
  date: Date;
  slot: number;
  status: string;
  isAttendanceSubmitted: boolean;
};

export async function getSchedule(teacherId?: string): Promise<ScheduleItemData[]> {
  const sessions = await prisma.classSession.findMany({
    where: teacherId ? { teacherId } : undefined, 
    include: { class: true, teacher: true },
    orderBy: [{ date: "asc" }, { slot: "asc" }]
  });

  return sessions.map(s => ({
    id: s.id,
    classId: s.classId,
    className: s.class.name,
    teacherId: s.teacherId,
    teacherName: s.teacher.fullName,
    date: s.date,
    slot: s.slot,
    status: s.status,
    isAttendanceSubmitted: s.isAttendanceSubmitted
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
      class: true // Đã xóa include subject
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
    className: log.classSession.class.name, 
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
// 6. TEACHER SETTINGS
// ==========================================

export type TeacherInfo = {
  id: string;
  fullName: string;
  username: string;
  salaryBalance: number;
};

export type TeachingHistory = {
  id: string;
  date: Date;
  slot: number;
  className: string;
  status: "completed" | "scheduled";
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

  const sessions = await prisma.classSession.findMany({
    where: { teacherId },
    include: { class: true },
    orderBy: { date: "desc" },
  });

  const teachingHistory: TeachingHistory[] = sessions.map((s) => ({
    id: s.id,
    date: s.date,
    slot: s.slot,
    className: s.class.name,
    status: s.status === "COMPLETED" ? "completed" : "scheduled",
  }));

  return {
    teacherInfo,
    teachingHistory,
  };
}

