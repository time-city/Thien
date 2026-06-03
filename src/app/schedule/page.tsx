import WeeklyCalendar from "@/components/schedule/WeeklyCalendar";
import TeacherBookingCalendar from "./TeacherBookingCalendar";
import { auth } from "@/auth";
import { getSchedule, getAllClasses, getAllUsers, getRooms } from "@/lib/queries";
import BulkScheduleModal from "@/components/schedule/BulkScheduleModal";

export default async function SchedulePage({
  searchParams,
}: {
  searchParams: Promise<{ roomId?: string }>;
}) {
  const session = await auth();
  if (!session?.user) {
    return <div className="p-8 text-center text-slate-500">Vui lòng đăng nhập</div>;
  }

  const { roomId } = await searchParams;
  const userId = session.user.id;
  const userRole = session.user.role;

  // ==========================================
  // GIAO DIỆN DÀNH CHO SUPER_ADMIN
  // ==========================================
  if (userRole === "SUPER_ADMIN") {
    const schedule = await getSchedule(); // admin sees all
    const classes = await getAllClasses();
    const teachers = await getAllUsers();
    const rooms = await getRooms();

    return (
      <div className="max-w-7xl mx-auto p-4 md:p-8">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
          <BulkScheduleModal classes={classes} teachers={teachers} rooms={rooms} />
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
            isAttendanceSubmitted: s.isAttendanceSubmitted,
          }))}
        />
      </div>
    );
  }

  // ==========================================
  // GIAO DIỆN DÀNH CHO TEACHER (ROOM BOOKING)
  // ==========================================
  if (userRole === "TEACHER") {
    const [rooms, classes, schedule] = await Promise.all([
      getRooms(),
      getAllClasses(),
      getSchedule(roomId) // pass roomId to get full schedule of the room
    ]);

    // Lọc classes mà giáo viên được gán
    const myClasses = classes.filter(c => 
      c.teachers.some(t => t.teacherId === userId)
    );

    return (
      <TeacherBookingCalendar
        rooms={rooms}
        classes={myClasses}
        initialSchedule={schedule}
        teacherId={userId}
        selectedRoomId={roomId || ""}
      />
    );
  }

  return <div className="p-8 text-center text-slate-500">Không có quyền truy cập.</div>;
}