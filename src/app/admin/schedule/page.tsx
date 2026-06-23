import { getRooms, getSchedule, getAllClasses, getAllUsers } from "@/actions/queries";
import AdminScheduleClient from "./AdminScheduleClient";
import WeeklyCalendar from "@/components/schedule/WeeklyCalendar";

export default async function AdminSchedulePage({
  searchParams,
}: {
  searchParams: Promise<{ roomId?: string }>;
}) {
  const { roomId } = await searchParams;

  if (!roomId) {
    const [rooms, schedule] = await Promise.all([
      getRooms(),
      getSchedule(roomId)
    ]);

    return (
      <AdminScheduleClient 
        rooms={rooms} 
        initialSchedule={schedule} 
        selectedRoomId="" 
      />
    );
  }

  const [rooms, schedule, classes, teachers] = await Promise.all([
    getRooms(),
    getSchedule(roomId),
    getAllClasses(),
    getAllUsers()
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
    />
  );
}

