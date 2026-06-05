"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { format, addDays, startOfWeek, isSameDay, addWeeks } from "date-fns";
import { ChevronLeft, ChevronRight, CheckCircle, XCircle } from "lucide-react";
import { toast } from "sonner";
import { approveSessionRequest, rejectSessionRequest } from "@/actions/mutations";
import type { RoomData, ScheduleItemData } from "@/actions/queries";

const SHIFTS = [
  { id: 1, label: "Ca 1", time: "07:30 - 09:00" },
  { id: 2, label: "Ca 2", time: "09:30 - 11:00" },
  { id: 3, label: "Ca 3", time: "13:30 - 15:00" },
  { id: 4, label: "Ca 4", time: "15:30 - 17:00" },
  { id: 5, label: "Ca 5", time: "17:30 - 19:00" },
  { id: 6, label: "Ca 6", time: "19:30 - 21:00" },
] as const;

const DAYS = [
  { id: 1, label: "Thứ 2" },
  { id: 2, label: "Thứ 3" },
  { id: 3, label: "Thứ 4" },
  { id: 4, label: "Thứ 5" },
  { id: 5, label: "Thứ 6" },
  { id: 6, label: "Thứ 7" },
  { id: 7, label: "Chủ Nhật" },
] as const;

function toISODate(d: Date): string {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function dayOfWeekMon1Sun7(date: Date): number {
  const js = date.getDay();
  return js === 0 ? 7 : js;
}

export default function AdminScheduleClient({
  rooms,
  initialSchedule,
  selectedRoomId,
}: {
  rooms: RoomData[];
  initialSchedule: ScheduleItemData[];
  selectedRoomId: string;
}) {
  const router = useRouter();
  const [schedule, setSchedule] = useState(initialSchedule);
  const [currentDate, setCurrentDate] = useState<Date>(() => new Date());
  
  // Modal State
  const [selectedSession, setSelectedSession] = useState<ScheduleItemData | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  // NO MANUAL F5 RULE: Sync prop to local state
  useEffect(() => {
    setSchedule(initialSchedule);
  }, [initialSchedule]);

  const { startOfThisWeek } = useMemo(() => {
    return { startOfThisWeek: startOfWeek(currentDate, { weekStartsOn: 1 }) };
  }, [currentDate]);

  const handleRoomChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const roomId = e.target.value;
    if (roomId) {
      router.push(`/admin/schedule?roomId=${roomId}`);
    } else {
      router.push(`/admin/schedule`);
    }
  };

  const handleApprove = async () => {
    if (!selectedSession) return;
    setIsProcessing(true);
    const result = await approveSessionRequest(selectedSession.id);
    setIsProcessing(false);

    if (result.success) {
      toast.success("Đã duyệt lịch học!");
      setSelectedSession(null);
      window.dispatchEvent(new Event("schedule-updated"));
      router.refresh();
    } else {
      toast.error(result.error || "Có lỗi xảy ra");
    }
  };

  const handleReject = async () => {
    if (!selectedSession) return;
    setIsProcessing(true);
    const result = await rejectSessionRequest(selectedSession.id);
    setIsProcessing(false);

    if (result.success) {
      toast.success("Đã từ chối lịch học!");
      setSelectedSession(null);
      window.dispatchEvent(new Event("schedule-updated"));
      router.refresh();
    } else {
      toast.error(result.error || "Có lỗi xảy ra");
    }
  };

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-8">
      <div className="mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900">Duyệt Đặt Phòng</h1>
          <p className="text-sm text-slate-500 mt-1">Quản lý và duyệt lịch dạy của giáo viên</p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <select
            value={selectedRoomId}
            onChange={handleRoomChange}
            className="border border-slate-300 rounded-lg px-4 py-2 bg-white text-sm focus:ring-2 focus:ring-blue-500 outline-none"
          >
            <option value="">-- Chọn Phòng --</option>
            {rooms.map((room) => (
              <option key={room.id} value={room.id}>
                {room.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {!selectedRoomId ? (
        <div className="space-y-4">
          <h2 className="text-lg font-bold text-slate-800">Yêu Cầu Chờ Duyệt</h2>
          {schedule.filter(s => s.status === "PENDING").length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-xl p-12 text-center text-slate-500">
              Không có yêu cầu duyệt nào. Vui lòng chọn phòng học để xem lịch tuần.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {schedule.filter(s => s.status === "PENDING").map(s => (
                <div key={s.id} className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm flex flex-col gap-2 relative transition-all hover:shadow-md">
                  <div className="font-extrabold text-blue-700 text-lg">{s.className}</div>
                  <div className="text-sm text-slate-600 flex justify-between">
                    <span><strong>Giáo viên:</strong> {s.teacherName}</span>
                  </div>
                  <div className="text-sm text-slate-600">
                    <strong>Phòng:</strong> {rooms.find(r => r.id === s.roomId)?.name || "Chưa rõ"}
                  </div>
                  <div className="text-sm text-slate-600">
                    <strong>Thời gian:</strong> {format(new Date(s.date), "dd/MM/yyyy")} - Ca {s.slot} ({SHIFTS.find(shift => shift.id === s.slot)?.time})
                  </div>
                  <button 
                    onClick={() => setSelectedSession(s)} 
                    className="mt-3 w-full py-2 bg-amber-100 text-amber-800 font-bold rounded-lg hover:bg-amber-200 transition-colors flex items-center justify-center gap-2"
                  >
                    Xử lý ngay
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="w-full overflow-x-auto border border-slate-200 rounded-xl bg-white shadow-sm scrollbar-thin scrollbar-thumb-slate-300 scrollbar-track-slate-100">
          <div className="min-w-[900px]">
            {/* Toolbar */}
            <div className="p-3 border-b border-slate-200 flex justify-between items-center bg-slate-50/50">
              <div className="font-bold text-slate-700">
                Tuần: {format(startOfThisWeek, "dd/MM")} - {format(addDays(startOfThisWeek, 6), "dd/MM/yyyy")}
              </div>
              <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-lg p-1 shadow-sm">
                <button
                  onClick={() => setCurrentDate((d) => addWeeks(d, -1))}
                  className="p-1.5 rounded hover:bg-slate-100 text-slate-600 transition-colors"
                >
                  <ChevronLeft size={18} />
                </button>
                <button
                  onClick={() => setCurrentDate(new Date())}
                  className="px-3 py-1 text-[13px] font-bold text-slate-700 hover:bg-slate-50 transition-colors"
                >
                  Hôm nay
                </button>
                <button
                  onClick={() => setCurrentDate((d) => addWeeks(d, 1))}
                  className="p-1.5 rounded hover:bg-slate-100 text-slate-600 transition-colors"
                >
                  <ChevronRight size={18} />
                </button>
              </div>
            </div>

            {/* Header Days */}
            <div className="grid grid-cols-[80px_repeat(7,1fr)] bg-slate-50 border-b border-slate-200">
              <div className="p-2 border-r border-slate-200 flex items-center justify-center font-bold text-slate-500 text-[12px] uppercase tracking-wider">
                Ca học
              </div>
              {DAYS.map((d) => {
                const dateForCol = addDays(startOfThisWeek, d.id - 1);
                const isToday = isSameDay(dateForCol, new Date());
                return (
                  <div
                    key={d.id}
                    className={`p-2 border-r border-slate-200 last:border-r-0 text-center flex flex-col justify-center items-center ${
                      isToday ? "bg-blue-50/50" : ""
                    }`}
                  >
                    <div className={`font-extrabold text-[13px] ${isToday ? "text-blue-700" : "text-slate-900"}`}>
                      {d.label}
                    </div>
                    <div className={`text-[11px] font-semibold ${isToday ? "text-blue-500" : "text-slate-500"}`}>
                      {format(dateForCol, "dd/MM")}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Slots */}
            <div>
              {SHIFTS.map((shift) => (
                <div key={shift.id} className="grid grid-cols-[80px_repeat(7,1fr)] border-b border-slate-200 last:border-b-0">
                  <div className="p-2 border-r border-slate-200 bg-slate-50/30 flex flex-col justify-center items-center gap-0.5">
                    <span className="font-bold text-slate-800 text-[13px]">{shift.label}</span>
                    <span className="text-[11px] text-slate-500 font-medium">{shift.time}</span>
                  </div>

                  {DAYS.map((day) => {
                    const dateForCell = addDays(startOfThisWeek, day.id - 1);
                    const dateISO = toISODate(dateForCell);
                    const isToday = isSameDay(dateForCell, new Date());

                    const cellSessions = schedule.filter((s) => {
                      if (s.status === "REJECTED" || s.status === "CANCELLED") return false;
                      return toISODate(s.date) === dateISO && dayOfWeekMon1Sun7(s.date) === day.id && s.slot === shift.id;
                    });

                    return (
                      <div
                        key={day.id}
                        className={`p-1.5 border-r border-slate-100 last:border-r-0 min-h-[80px] ${
                          isToday ? "bg-blue-50/20" : ""
                        }`}
                      >
                        {cellSessions.length === 0 ? (
                          <div className="h-full min-h-[60px] rounded border border-transparent" />
                        ) : (
                          <div className="flex flex-col gap-1.5 h-full">
                            {cellSessions.map((ev) => {
                              const isPending = ev.status === "PENDING";
                              const isCompleted = ev.status === "COMPLETED" || ev.isAttendanceSubmitted;

                              const bgClass = isPending 
                                ? "bg-amber-100 border-amber-300 text-amber-900 hover:scale-[1.02] cursor-pointer"
                                : isCompleted 
                                ? "bg-slate-100 border-slate-200 text-slate-500 cursor-default opacity-80"
                                : "bg-white border-slate-200 text-slate-700 cursor-default";

                              return (
                                <button
                                  key={ev.id}
                                  onClick={() => isPending && setSelectedSession(ev)}
                                  className={`p-2 w-full text-left rounded-lg border text-[11px] leading-snug shadow-sm flex flex-col gap-1 transition-all ${bgClass}`}
                                >
                                  <div className="font-extrabold line-clamp-1">{ev.className}</div>
                                  <div className="font-medium opacity-80 line-clamp-1">{ev.teacherName}</div>
                                  <div className="text-[10px] font-bold mt-1">
                                    {isPending ? (
                                      <span className="text-amber-600">Chờ duyệt</span>
                                    ) : isCompleted ? (
                                      <span className="text-slate-500">Đã xong</span>
                                    ) : (
                                      <span className="text-green-600">Đã duyệt</span>
                                    )}
                                  </div>
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Approve/Reject Modal */}
      {selectedSession && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm px-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl">
            <h3 className="text-xl font-bold text-slate-900 mb-2">Duyệt Ca Học</h3>
            <p className="text-sm text-slate-500 mb-6">Xác nhận duyệt hoặc từ chối đăng ký này.</p>
            
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 mb-6 space-y-2 text-sm">
              <div className="flex justify-between border-b pb-2">
                <span className="text-slate-500">Giáo viên:</span>
                <span className="font-bold text-slate-900">{selectedSession.teacherName}</span>
              </div>
              <div className="flex justify-between border-b pb-2">
                <span className="text-slate-500">Lớp học:</span>
                <span className="font-bold text-slate-900">{selectedSession.className}</span>
              </div>
              <div className="flex justify-between border-b pb-2">
                <span className="text-slate-500">Ngày:</span>
                <span className="font-bold text-slate-900">{format(selectedSession.date, "dd/MM/yyyy")}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Ca học:</span>
                <span className="font-bold text-slate-900">Ca {selectedSession.slot} ({SHIFTS.find(s => s.id === selectedSession.slot)?.time})</span>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setSelectedSession(null)}
                disabled={isProcessing}
                className="flex-1 px-4 py-2 bg-slate-100 text-slate-700 font-bold rounded-xl hover:bg-slate-200 transition-colors"
              >
                Hủy
              </button>
              <button
                onClick={handleReject}
                disabled={isProcessing}
                className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2 bg-rose-100 text-rose-700 font-bold rounded-xl hover:bg-rose-200 transition-colors disabled:opacity-50"
              >
                <XCircle size={16} /> Từ chối
              </button>
              <button
                onClick={handleApprove}
                disabled={isProcessing}
                className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 transition-colors disabled:opacity-50"
              >
                <CheckCircle size={16} /> Đồng ý
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
