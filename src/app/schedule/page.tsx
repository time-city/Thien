import WeeklyCalendar from "@/components/schedule/WeeklyCalendar";
import { auth } from "@/auth";
import { getSchedule, getAllClasses, getAllUsers } from "@/lib/queries";
import BulkScheduleModal from "@/components/schedule/BulkScheduleModal";

export default async function SchedulePage() {
  const session = await auth();
  if (!session?.user) {
    return <div className="p-8 text-center text-slate-500">Vui lòng đăng nhập</div>;
  }

  const userId = session.user.id;
  const userRole = session.user.role;

  // ==========================================
  // GIAO DIỆN DÀNH CHO SUPER_ADMIN
  // ==========================================
  if (userRole === "SUPER_ADMIN") {
    const schedule = await getSchedule();
    const classes = await getAllClasses();
    const teachers = await getAllUsers();

    return (
      <div className="max-w-7xl mx-auto p-4 md:p-8">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
          <BulkScheduleModal classes={classes} teachers={teachers} />
        </div>

        <WeeklyCalendar
          userRole={userRole}
          sessions={schedule.map((s) => ({
            id: s.id,
            classId: s.classId, // Đã fix lỗi s.id thành s.classId
            className: s.className,
            teacherId: s.teacherId,
            teacherFullName: s.teacherName,
            date: s.date,
            slot: s.slot,
            status: s.status,
          }))}
        />
      </div>
    );
  }

  // ==========================================
  // GIAO DIỆN DÀNH CHO TEACHER
  // ==========================================
  if (userRole === "TEACHER") {
    // Dùng luôn hàm getSchedule có truyền userId cho code sạch sẽ
    const schedule = await getSchedule(userId);

    return (
      <div className="max-w-7xl mx-auto p-4 md:p-8">
        <div className="mb-6">
          <h1 className="text-2xl font-extrabold text-slate-900">Lịch Dạy Của Tôi</h1>
          <p className="text-sm text-slate-500 mt-1">Theo dõi các ca dạy trong tuần của bạn</p>
        </div>

        <WeeklyCalendar
          userRole={userRole}
          sessions={schedule.map((s) => ({
            id: s.id,
            classId: s.classId,
            className: s.className,
            teacherId: s.teacherId,
            teacherFullName: s.teacherName,
            date: s.date,
            slot: s.slot,
            status: s.status,
          }))}
        />
      </div>
    );
  }

  return <div className="p-8 text-center text-slate-500">Không có quyền truy cập.</div>;
}