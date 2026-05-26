export type SessionLog = {
  sessionNumber: number;
  date: string;
  attendance: 'PRESENT' | 'LATE' | 'EXCUSED' | 'UNEXCUSED';
  homework: 'GOOD' | 'DONE' | 'NONE';
  note: string;
};

export type Student = {
  id: string;
  name: string;
  className: string;
  totalSessions: number;
  remainingSessions: number;
  feeStatus: 'PAID' | 'PENDING';
  logs: SessionLog[];
};

const CLASS_NAMES = ['KHTN 6', 'KHTN 7', 'KHTN 8', 'KHTN 9', 'HSG 9'];
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

      students.push({
        id: `HS${idCounter.toString().padStart(3, '0')}`,
        name: `Học sinh ${idCounter}`,
        className,
        totalSessions,
        remainingSessions: totalSessions - logsCount,
        feeStatus: Math.random() > 0.7 ? 'PENDING' : 'PAID',
        logs,
      });
      idCounter++;
    }
  }

  return students;
}

export const mockStudents: Student[] = generateMockData();
export const CLASSES = CLASS_NAMES;
