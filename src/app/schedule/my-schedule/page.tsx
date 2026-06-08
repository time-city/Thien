import WeeklyCalendar from "@/components/schedule/WeeklyCalendar";
import { auth } from "@/auth";
import { getSchedule } from "@/lib/queries";
import { redirect } from "next/navigation";

export default async function MySchedulePage() {
  const session = await auth();
  if (!session?.user) {
    return <div className="p-8 text-center text-slate-500">Vui lòng đăng nhập</div>;
  }

  const userId = session.user.id;
  const userRole = session.user.role;

  // Trang này chỉ dành cho giáo viên (hoặc admin nhưng filter theo ID giáo viên)
  if (userRole !== "TEACHER" && userRole !== "SUPER_ADMIN") {
    redirect("/");
  }

  const teacherSchedule = await getSchedule(undefined, userId);

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-8">
      <div className="mb-6">
        <h1 className="text-2xl md:text-3xl font-extrabold text-slate-900 tracking-tight">Lịch Dạy Của Tôi</h1>
        <p className="text-sm text-slate-500 mt-1">
          Xem toàn bộ lịch dạy cá nhân, bao gồm các lớp chính thức và các ca dạy tự do.
        </p>
      </div>

      <WeeklyCalendar
        userRole={userRole}
        sessions={teacherSchedule.map((s) => ({
          id: s.id,
          classId: s.classId,
          className: s.className,
          teacherId: s.teacherId,
          teacherFullName: s.teacherName,
          roomName: s.roomName,
          date: s.date,
          slot: s.slot,
          status: s.status,
          isAttendanceSubmitted: s.isAttendanceSubmitted,
        }))}
      />
    </div>
  );
}
