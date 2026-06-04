"use client";

import { useRouter } from "next/navigation";

export default function AdminRoomSelector({
  rooms,
  selectedRoomId,
}: {
  rooms: { id: string; name: string }[];
  selectedRoomId: string;
}) {
  const router = useRouter();

  return (
    <select
      value={selectedRoomId}
      onChange={(e) => {
        const val = e.target.value;
        if (val) {
          router.push(`/schedule?roomId=${val}`);
        } else {
          router.push(`/schedule`);
        }
      }}
      className="border border-slate-300 rounded-lg px-4 py-2 bg-white text-sm font-medium focus:ring-2 focus:ring-blue-500 outline-none shadow-sm"
    >
      <option value="">-- Chọn Phòng Để Xem Lịch --</option>
      {rooms.map((room) => (
        <option key={room.id} value={room.id}>
          {room.name}
        </option>
      ))}
    </select>
  );
}
