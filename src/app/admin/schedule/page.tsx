import { getRooms, getSchedule, getAllClasses, getAllUsers } from "@/actions/queries";
import AdminScheduleClient from "./AdminScheduleClient";
import WeeklyCalendar from "@/components/schedule/WeeklyCalendar";
import { auth } from "@/auth";

export default async function AdminSchedulePage({
  searchParams,
}: {
  searchParams: Promise<{ roomId?: string }>;
}) {
  const { roomId } = await searchParams;
  const session = await auth();
  const userId = session?.user?.id;

  if (!roomId) {
    const [rooms, schedule, teacherSchedule] = await Promise.all([
      getRooms(),
      getSchedule(roomId),
      userId ? getSchedule(undefined, userId) : Promise.resolve([])
    ]);

    return (
      <AdminScheduleClient 
        rooms={rooms} 
        initialSchedule={schedule} 
        teacherSchedule={teacherSchedule}
        selectedRoomId="" 
      />
    );
  }

  const [rooms, schedule, classes, teachers, teacherSchedule] = await Promise.all([
    getRooms(),
    getSchedule(roomId),
    getAllClasses(),
    getAllUsers(),
    userId ? getSchedule(undefined, userId) : Promise.resolve([])
  ]);

  return (
    <WeeklyCalendar
      userRole="SUPER_ADMIN"
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
  );
}

