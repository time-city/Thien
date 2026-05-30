import { prisma } from "@/lib/prisma";
import { 
  Role, 
  AttendanceStatus, 
  HomeworkStatus, 
  RentalStatus,

} from "@prisma/client";

// ==========================================
// 1. MÔN HỌC (SUBJECTS)
// ==========================================
export async function getAllSubjects() {
  return await prisma.subject.findMany({
    orderBy: { createdAt: "desc" }
  });
}

export async function getSubjectById(id: string) {
  return await prisma.subject.findUnique({
    where: { id },
  });
}

// ==========================================
// 2. TÀI KHOẢN (USERS / TEACHERS / ADMINS)
// ==========================================
export type TeacherData = {
  id: string;
  username: string;
  fullName: string;
  role: Role;
  isActive: boolean;
  roomFeePerSession: number;
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
      roomFeePerSession: true,
    },
    orderBy: { createdAt: "desc" }
  });
}

export async function getUserById(id: string) {
  return await prisma.user.findUnique({
    where: { id },
    select: { id: true, username: true, fullName: true, role: true, isActive: true, roomFeePerSession: true }
  });
}

export async function getTeachers() {
  return await prisma.user.findMany({
    where: { 
      role: "TEACHER" // Ép Database chỉ tìm giáo viên, không quan tâm bọn khác
    },
    orderBy: { createdAt: "desc" },
  });
}

// ==========================================
// 3. LỚP HỌC (CLASSES)
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
        include: { class: { include: { subject: true } } }
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
      // Tính giá của gói học (Giá 1 buổi x Số buổi)
      price: e.class.subject.pricePerSession * e.class.subject.sessionsPerPackage
    }))
  }));
}

export type ClassData = {
  id: string;
  name: string;
  category: string;
  subjectId: string;
  subjectName: string;
  teachers: { teacherId: string; teacherName: string }[];
};

export async function getAllClasses(): Promise<ClassData[]> {
  const classes = await prisma.class.findMany({
    include: {
      subject: true,
      teachers: { include: { teacher: true } }
    },
    orderBy: { createdAt: "desc" }
  });

  return classes.map(c => ({
    id: c.id,
    name: c.name,
    category: c.category,
    subjectId: c.subjectId,
    subjectName: c.subject.name,
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
      subject: true,
      teachers: { include: { teacher: true } },
      enrollments: { include: { student: true } } // Lấy luôn danh sách hs của lớp
    }
  });
}

// ==========================================
// 4. HỌC SINH & GHI DANH (STUDENTS & ENROLLMENTS)
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
  subjectName: string;
  remainingSessions: number;
  feeStatus: string;
  status: string;
  teachers: string[]; // Tên các giáo viên phụ trách lớp
};

export type StudentData = {
  id: string;
  fullName: string;
  phone: string | null;
  parentName: string | null;
  parentPhone: string | null;
  gender: string | null;
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
              subject: true,
              teachers: { include: { teacher: true } }
            } 
          } 
        }
      },
      attendanceLogs: {
        include: { classSession: true },
        orderBy: { classSession: { date: "desc" } },
        take: 10 
      }
    },
    orderBy: { createdAt: "desc" }
  });

  return students.map(s => ({
    id: s.id,
    fullName: s.fullName,
    phone: s.phoneStudent,
    parentName: s.parentName,
    parentPhone: s.phoneParent,
    gender: s.gender,
    enrolledCourses: s.enrollments.map(e => ({
      enrollmentId: e.id,
      classId: e.classId,
      className: e.class.name,
      subjectName: e.class.subject.name,
      remainingSessions: e.remainingSessions,
      feeStatus: e.feeStatus,
      status: e.status,
      teachers: e.class.teachers.map(t => t.teacher.fullName)
    })),
    logs: s.attendanceLogs.map(log => ({
      id: log.id,
      date: log.classSession.date,
      attendanceStatus: log.attendanceStatus,
      homeworkStatus: log.homeworkStatus,
      note: log.note
    }))
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
// 5. LỊCH DẠY (SCHEDULE & SESSIONS)
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
    where: teacherId ? { teacherId } : undefined, // Truyền ID giáo viên thì chỉ lấy lịch người đó
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
// 6. TÀI CHÍNH (FINANCE - THU HỌC PHÍ, TRẢ LƯƠNG, THUÊ PHÒNG)
// ==========================================
export async function getTuitionEnrollments() {
  return await prisma.enrollment.findMany({
    include: {
      student: true,
      class: { include: { subject: true } }
    },
    orderBy: { createdAt: "desc" }
  });
}

export async function getRentalLogs(): Promise<RentalLogData[]> {
  const rawLogs = await prisma.roomRentalLog.findMany({
    include: {
      teacher: true,
      classSession: {
        include: { class: true } // Phải include class thì mới lấy được className
      }
    },
    orderBy: { createdAt: "desc" }
  });

  return rawLogs.map((log) => ({
    id: log.id,
    teacherId: log.teacherId,
    teacherName: log.teacher.fullName,
    classSessionId: log.classSessionId,
    className: log.classSession.class.name, // Lấy tên lớp từ bảng lồng
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