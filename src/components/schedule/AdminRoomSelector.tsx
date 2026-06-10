"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Loader2 } from "lucide-react";

export default function AdminRoomSelector({
  rooms,
  selectedRoomId,
}: {
  rooms: { id: string; name: string }[];
  selectedRoomId: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  return (
    <div className="flex items-center gap-2">
      <select
        value={selectedRoomId}
        disabled={isPending}
        onChange={(e) => {
          const val = e.target.value;
          startTransition(() => {
            if (val) {
              router.push(`/schedule?roomId=${val}`);
            } else {
              router.push(`/schedule`);
            }
          });
        }}
        className="border border-slate-300 rounded-lg px-4 py-2 bg-white text-sm font-medium focus:ring-2 focus:ring-blue-500 outline-none shadow-sm disabled:opacity-50"
      >
      <option value="">-- Chọn Phòng Để Xem Lịch --</option>
      {rooms.map((room) => (
        <option key={room.id} value={room.id}>
          {room.name}
        </option>
      ))}
      </select>
      {isPending && <Loader2 className="w-5 h-5 animate-spin text-blue-600" />}
    </div>
  );
}
