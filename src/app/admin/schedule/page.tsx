import { getRooms, getSchedule } from "@/actions/queries";
import AdminScheduleClient from "./AdminScheduleClient";

export default async function AdminSchedulePage({
  searchParams,
}: {
  searchParams: Promise<{ roomId?: string }>;
}) {
  const { roomId } = await searchParams;

  const [rooms, schedule] = await Promise.all([
    getRooms(),
    getSchedule(roomId)
  ]);

  return (
    <AdminScheduleClient 
      rooms={rooms} 
      initialSchedule={schedule} 
      selectedRoomId={roomId || ""} 
    />
  );
}
