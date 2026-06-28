import WeeklyCalendar from "@/components/schedule/WeeklyCalendar";
import TeacherBookingCalendar from "./TeacherBookingCalendar";
import { auth } from "@/auth";
import { getSchedule, getAllClasses, getAllUsers, getRooms } from "@/lib/queries";
import BulkScheduleModal from "@/components/schedule/BulkScheduleModal";
import AdminRoomSelector from "@/components/schedule/AdminRoomSelector";

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
    const rooms = await getRooms();
    const classes = await getAllClasses();
    const teachers = await getAllUsers();

    // Nếu chưa chọn phòng thì có thể hiện form chọn phòng, 
    // Hoặc lấy lịch của phòng đã chọn.
    const [schedule, teacherSchedule] = await Promise.all([
      roomId ? getSchedule(roomId) : Promise.resolve([]),
      getSchedule(undefined, userId)
    ]);

    return (
      <div className="max-w-7xl mx-auto p-4 md:p-8">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-extrabold text-slate-900">Quản Lý Lịch Dạy</h1>
            <p className="text-sm text-slate-500 mt-1">Duyệt, xem và tạo lịch định kỳ</p>
          </div>
          <BulkScheduleModal classes={classes} teachers={teachers} rooms={rooms} defaultData={{ roomId }} />
        </div>

        {/* Room Selector for Admin */}
        <div className="mb-6 flex flex-col sm:flex-row gap-3">
          <form className="flex items-center gap-3 w-full sm:w-auto">
            <AdminRoomSelector rooms={rooms} selectedRoomId={roomId || ""} />
          </form>
        </div>

        {!roomId ? (
          <div className="bg-white border border-slate-200 rounded-xl p-16 text-center shadow-sm">
            <h3 className="text-lg font-bold text-slate-700 mb-2">Vui lòng chọn phòng</h3>
            <p className="text-slate-500">Bạn cần chọn một phòng cụ thể ở menu trên để xem toàn bộ lịch dạy.</p>
          </div>
        ) : (
          <WeeklyCalendar
            userRole="SUPER_ADMIN"
            // 🟢 SỬA CHỮ "sessions" THÀNH "schedule" (hoặc tên biến ông đang dùng)
            sessions={schedule.map((s) => ({
              id: s.id,
              classId: s.classId,
              className: s.className,
              teacherId: s.teacherId,
              teacherFullName: s.teacherName,
              roomId: s.roomId,
              roomName: s.roomName,
              date: s.date,
              startTime: s.startTime,
              endTime: s.endTime,
              status: s.status,
              isAttendanceSubmitted: s.isAttendanceSubmitted,
            }))}
            rooms={rooms}
            classes={classes}
            teachers={teachers}
            selectedRoomId={roomId}
            teacherSchedule={teacherSchedule}
          />
        )}
      </div>
    );
  }

  // ==========================================
  // GIAO DIỆN DÀNH CHO TEACHER (ROOM BOOKING)
  // ==========================================
  if (userRole === "TEACHER") {
    const [rooms, classes, schedule, teacherSchedule] = await Promise.all([
      getRooms(),
      getAllClasses(),
      roomId ? getSchedule(roomId) : getSchedule(undefined, userId), // Lịch của phòng đang chọn HOẶC Lịch của cá nhân GV
      getSchedule(undefined, userId) // Lịch của toàn bộ giáo viên này (để biết bị trùng phòng khác)
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
        teacherSchedule={teacherSchedule}
        teacherId={userId}
        selectedRoomId={roomId || ""}
      />
    );
  }

  return <div className="p-8 text-center text-slate-500">Không có quyền truy cập.</div>;
}