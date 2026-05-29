import { Prisma } from "@prisma/client";
import type { 
  Role, 
  AttendanceStatus, 
  HomeworkStatus, 
  PaymentStatus, 
  RentalStatus,
  Gender,
  EnrollmentStatus,
  FeeStatus,
  SessionStatus,
  PaymentMethod,
  TransactionStatus
} from "@prisma/client";

// =======================================================================
// 1. RE-EXPORT CÁC TYPE GỐC TỪ PRISMA 
// =======================================================================
export type {
  Role,
  EnrollmentStatus,
  FeeStatus,
  SessionStatus,
  AttendanceStatus,
  HomeworkStatus,
  RentalStatus,
  Gender,
  PaymentMethod,
  PaymentStatus,
  TransactionStatus,
  User,
  SalaryPayment,
  Subject,
  Class,
  ClassTeacher,
  Student,
  Enrollment,
  PaymentHistory,
  ClassSession,
  AttendanceLog,
  RoomRentalLog,
  PendingTransaction,
} from "@prisma/client";

// =======================================================================
// 2. DEFINE CÁC TYPE QUAN HỆ (PRISMA RELATIONAL PAYLOADS)
// =======================================================================

export type ClassWithRelations = Prisma.ClassGetPayload<{
  include: {
    subject: true;
    teachers: {
      include: { teacher: true };
    };
    enrollments: true;
  };
}>;

export type StudentWithRelations = Prisma.StudentGetPayload<{
  include: {
    enrollments: {
      include: { class: { include: { subject: true } } };
    };
    attendanceLogs: {
      include: { classSession: true };
    };
  };
}>;

export type SessionWithRelations = Prisma.ClassSessionGetPayload<{
  include: {
    class: true;
    teacher: true;
    attendanceLogs: {
      include: { student: true };
    };
  };
}>;

export type EnrollmentWithRelations = Prisma.EnrollmentGetPayload<{
  include: {
    student: true;
    class: { include: { subject: true } };
  };
}>;

export type UserWithRelations = Prisma.UserGetPayload<{
  include: {
    classTeachers: { include: { class: true } };
    classSessions: true;
  };
}>;

// =======================================================================
// 3. APPLICATION TYPES (DÙNG CHO QUERIES VÀ UI COMPONENTS)
// =======================================================================

// --- TÀI KHOẢN (Users / Teachers) ---
export type TeacherData = {
  id: string;
  username: string;
  fullName: string;
  role: Role;
  isActive: boolean;
  roomFeePerSession: number;
};

// --- LỚP HỌC (Classes) ---
export type ClassData = {
  id: string;
  name: string;
  category: string;
  subjectId: string;
  subjectName: string;
  teachers: { teacherId: string; teacherName: string }[];
};

// --- HỌC SINH (Students & Logs) ---
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
  feeStatus: string; // Có thể đổi thành FeeStatus Enum nếu DB đồng bộ hoàn toàn
  status: string;
};

export type StudentData = {
  id: string;
  fullName: string;
  phone: string | null;
  parentName: string | null;
  parentPhone: string | null;
  enrolledCourses: EnrolledCourseData[];
  logs: SessionLogData[];
};

// --- LỊCH HỌC (Schedule) ---
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

export type SessionDetailData = {
  id: string;
  date: Date;
  slot: number;
  className: string;
  teacherName: string;
  status: string;
};

// --- TÀI CHÍNH (Tuition & Rentals) ---
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

export type RentalLogData = {
  id: string;
  teacherName: string;
  date: Date;
  slot: number;
  feeCalculated: number;
  status: string;
};

// =======================================================================
// 4. COMPONENT SPECIFIC TYPES (Dành riêng cho các màn hình UI)
// =======================================================================

// Dùng cho màn hình Điểm danh / Sơ đồ lớp
export type CheckInStudent = {
  id: string;
  fullName: string;
  className: string;
  seat: string;
  attendance?: AttendanceStatus;
  homework?: HomeworkStatus;
  note?: string;
  phone?: string | null;
  parentName?: string | null;
  parentPhone?: string | null;
  remainingSessions?: number | null;
  feeStatus?: string | null;
};

export type UISessionInfo = {
  className: string;
  teacherName: string;
  date: string; // Để string vì truyền từ Server Component xuống Client sẽ ép thành ISO
  slot: number;
};