export type SessionLog = {
  sessionNumber: number;
  date: string;
  attendance: 'PRESENT' | 'LATE' | 'EXCUSED' | 'UNEXCUSED';
  homework: 'GOOD' | 'DONE' | 'NONE';
  note: string;
};

export type CourseInfo = {
  course: string;
  remaining: number;
  fee: number;
};

export type Student = {
  id: string;
  name: string;
  className: string;
  totalSessions: number; // Tạm giữ lại cho tương thích
  remainingSessions: number; // Tạm giữ lại
  feeStatus: 'PAID' | 'PENDING';
  logs: SessionLog[];
  enrolledCourses: CourseInfo[];
};

export type User = {
  id: string;
  username: string;
  name: string;
  role: 'SUPER_ADMIN' | 'TEACHER';
  status: 'ACTIVE' | 'LOCKED';
  subjects: string[];
};

export const mockUsers: User[] = [
  { id: 'u1', username: 'thien', name: 'Thiện', role: 'SUPER_ADMIN', status: 'ACTIVE', subjects: [] },
  { id: 'u2', username: 'ha', name: 'Cô Hà', role: 'TEACHER', status: 'ACTIVE', subjects: ['Toán'] },
  { id: 'u3', username: 'hung', name: 'Thầy Hùng', role: 'TEACHER', status: 'ACTIVE', subjects: ['Hóa'] },
  { id: 'u4', username: 'lan', name: 'Cô Lan', role: 'TEACHER', status: 'ACTIVE', subjects: ['Văn'] },
  { id: 'u5', username: 'nga', name: 'Cô Nga', role: 'TEACHER', status: 'ACTIVE', subjects: ['Sử'] },
  { id: 'u6', username: 'dung', name: 'Thầy Dũng', role: 'TEACHER', status: 'LOCKED', subjects: ['Lý'] },
];

export type ClassInfo = {
  id: string;
  name: string;
  teacherId: string;
};

export const mockClasses: ClassInfo[] = [
  { id: 'C1', name: 'KHTN 6', teacherId: 'u2' }, // Cô Hà
  { id: 'C2', name: 'KHTN 7', teacherId: 'u3' }, // Thầy Hùng
  { id: 'C3', name: 'KHTN 8', teacherId: 'u2' }, // Cô Hà
  { id: 'C4', name: 'KHTN 9', teacherId: 'u4' }, // Cô Lan
  { id: 'C5', name: 'HSG 9', teacherId: 'u5' }, // Cô Nga
];

const CLASS_NAMES = mockClasses.map(c => c.name);
const ATTENDANCE_OPTS: SessionLog['attendance'][] = ['PRESENT', 'LATE', 'EXCUSED', 'UNEXCUSED'];
const HOMEWORK_OPTS: SessionLog['homework'][] = ['GOOD', 'DONE', 'NONE'];

function generateMockData(): Student[] {
  const students: Student[] = [];
  let idCounter = 1;

  for (const className of CLASS_NAMES) {
    for (let i = 0; i < 20; i++) {
      const totalSessions = Math.random() > 0.5 ? 8 : 12;
      const logsCount = Math.floor(Math.random() * 3) + 4; // Từ 4 đến 6 buổi đã học
      const logs: SessionLog[] = [];

      for (let j = 1; j <= logsCount; j++) {
        const day = j.toString().padStart(2, '0');
        logs.push({
          sessionNumber: j,
          date: `${day}/05/2026`,
          attendance: ATTENDANCE_OPTS[Math.floor(Math.random() * ATTENDANCE_OPTS.length)],
          homework: HOMEWORK_OPTS[Math.floor(Math.random() * HOMEWORK_OPTS.length)],
          note: '',
        });
      }

      const enrolledCourses: CourseInfo[] = [];
      const possibleCourses = ['Hóa', 'Lý', 'Toán', 'Sinh'];
      // Random 1 to 3 courses
      const numCourses = Math.floor(Math.random() * 3) + 1;
      const shuffled = possibleCourses.sort(() => 0.5 - Math.random());
      
      for(let k = 0; k < numCourses; k++) {
        enrolledCourses.push({
          course: shuffled[k],
          remaining: Math.floor(Math.random() * 5), // 0 to 4 để test <= 2
          fee: (Math.floor(Math.random() * 5) + 5) * 100000, // 500k to 900k
        });
      }

      students.push({
        id: `HS${idCounter.toString().padStart(3, '0')}`,
        name: `Học sinh ${idCounter}`,
        className,
        totalSessions,
        remainingSessions: totalSessions - logsCount,
        feeStatus: Math.random() > 0.7 ? 'PENDING' : 'PAID',
        logs,
        enrolledCourses,
      });
      idCounter++;
    }
  }

  return students;
}

export const mockStudents: Student[] = generateMockData();
export const CLASSES = CLASS_NAMES;

export type RentalSession = {
  id: string;
  renterName: string;
  roomName: string;
  dayOfWeek: number; // 1: T2 -> 7: CN
  shift: number;
  timeSlot: string;
  pricePerSession: number;
  paymentStatus: 'PAID' | 'PENDING';
  room: string;
  teacherId: string;
};

export const mockRentals: RentalSession[] = [
  { id: 'R1', renterName: 'Thầy Hùng', roomName: 'Phòng 4', dayOfWeek: 6, shift: 1, timeSlot: '08:00 - 09:30', pricePerSession: 150000, paymentStatus: 'PENDING', room: 'Phòng 4', teacherId: 'u3' },
  { id: 'R2', renterName: 'Thầy Hùng', roomName: 'Phòng 4', dayOfWeek: 6, shift: 2, timeSlot: '14:00 - 15:30', pricePerSession: 150000, paymentStatus: 'PENDING', room: 'Phòng 4', teacherId: 'u3' },
  { id: 'R3', renterName: 'Cô Lan', roomName: 'Phòng 3', dayOfWeek: 7, shift: 3, timeSlot: '17:30 - 19:00', pricePerSession: 200000, paymentStatus: 'PAID', room: 'Phòng 3', teacherId: 'u4' },
];

export type ScheduleItem = {
  id: string;
  className: string;
  room: string;
  teacherId: string;
  dayOfWeek: number; // 1: T2, 2: T3, ..., 7: CN
  shift: number; // Ca 1, 2, 3, 4
};

export const mockSchedule: ScheduleItem[] = [
  { id: 'S1', className: 'KHTN 9', room: 'Phòng 1', teacherId: 'u2', dayOfWeek: 1, shift: 1 },
  { id: 'S2', className: 'KHTN 8', room: 'Phòng 2', teacherId: 'u3', dayOfWeek: 1, shift: 1 },
  { id: 'S3', className: 'HSG 9', room: 'Phòng 1', teacherId: 'u4', dayOfWeek: 2, shift: 2 },
  { id: 'S4', className: 'KHTN 7', room: 'Phòng 3', teacherId: 'u5', dayOfWeek: 3, shift: 3 },
  // Cố tình tạo trùng lịch (Conflict) ở Ca 2 Thứ 5:
  { id: 'S5', className: 'KHTN 6', room: 'Phòng 2', teacherId: 'u6', dayOfWeek: 4, shift: 2 },
  { id: 'S6', className: 'KHTN 8', room: 'Phòng 2', teacherId: 'u3', dayOfWeek: 4, shift: 2 },
];
