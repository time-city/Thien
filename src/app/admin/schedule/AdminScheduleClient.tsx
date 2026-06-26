"use client";

import { useState, useMemo, useTransition, useOptimistic } from "react";
import { useRouter } from "next/navigation";
import { format, addDays, startOfWeek, isSameDay, addWeeks, parse, getDay } from "date-fns";
import { vi } from "date-fns/locale";
import { ChevronLeft, ChevronRight, CheckCircle, XCircle, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { approveSessionRequest, rejectSessionRequest, approveCancelSession, rejectCancelSession } from "@/actions/mutations";
import type { RoomData, ScheduleItemData as BaseScheduleItemData } from "@/actions/queries";
import { Calendar, dateFnsLocalizer, Event as CalendarEvent } from "react-big-calendar";
import "react-big-calendar/lib/css/react-big-calendar.css";

export type ScheduleItemData = BaseScheduleItemData & { pending?: boolean };

const locales = {
  'vi': vi,
}

const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek: () => startOfWeek(new Date(), { weekStartsOn: 1 }),
  getDay,
  locales,
})

const formats = {
  dayFormat: "EEEE, dd/MM",
};

export default function AdminScheduleClient({
  rooms,
  initialSchedule,
  selectedRoomId,
}: {
  rooms: RoomData[];
  initialSchedule: BaseScheduleItemData[];
  selectedRoomId: string;
  teacherSchedule?: BaseScheduleItemData[];
}) {
  const router = useRouter();
  // Optimistic UI State
  const [optimisticSchedule, addOptimisticSchedule] = useOptimistic(
    initialSchedule as ScheduleItemData[],
    (state, action: { type: "APPROVE" | "REJECT" | "APPROVE_CANCEL" | "REJECT_CANCEL"; payload: string }) => {
      switch (action.type) {
        case "APPROVE":
          return state.map(s => s.id === action.payload ? { ...s, status: "COMPLETED", pending: true } : s);
        case "REJECT":
          return state.map(s => s.id === action.payload ? { ...s, status: "REJECTED", pending: true } : s);
        case "APPROVE_CANCEL":
          return state.filter(s => s.id !== action.payload);
        case "REJECT_CANCEL":
          return state.map(s => s.id === action.payload ? { ...s, isCancelRequested: false, pending: true } : s);
        default:
          return state;
      }
    }
  );

  const [currentDate, setCurrentDate] = useState<Date>(() => new Date());
  const [selectedSession, setSelectedSession] = useState<ScheduleItemData | null>(null);

  const [isPending, startTransition] = useTransition();

  const handleRoomChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const roomId = e.target.value;
    startTransition(() => {
      if (roomId) {
        router.push(`/admin/schedule?roomId=${roomId}`);
      } else {
        router.push(`/admin/schedule`);
      }
    });
  };

  const handleApprove = () => {
    if (!selectedSession) return;
    const currentSelected = selectedSession;
    setSelectedSession(null);
    
    startTransition(async () => {
      addOptimisticSchedule({ type: "APPROVE", payload: currentSelected.id });
      
      const result = await approveSessionRequest(currentSelected.id);

      if (result.success) {
        toast.success("Đã duyệt lịch học!");
        window.dispatchEvent(new Event("schedule-updated"));
        router.refresh();
      } else {
        toast.error(result.error || "Có lỗi xảy ra");
      }
    });
  };

  const handleReject = () => {
    if (!selectedSession) return;
    const currentSelected = selectedSession;
    setSelectedSession(null);

    startTransition(async () => {
      addOptimisticSchedule({ type: "REJECT", payload: currentSelected.id });

      const result = await rejectSessionRequest(currentSelected.id);

      if (result.success) {
        toast.success("Đã từ chối lịch học!");
        window.dispatchEvent(new Event("schedule-updated"));
        router.refresh();
      } else {
        toast.error(result.error || "Có lỗi xảy ra");
      }
    });
  };

  const handleApproveCancel = () => {
    if (!selectedSession) return;
    const currentSelected = selectedSession;
    setSelectedSession(null);

    startTransition(async () => {
      addOptimisticSchedule({ type: "APPROVE_CANCEL", payload: currentSelected.id });

      const result = await approveCancelSession(currentSelected.id);

      if (result.success) {
        toast.success("Đã duyệt huỷ ca!");
        window.dispatchEvent(new Event("schedule-updated"));
        router.refresh();
      } else {
        toast.error(result.error || "Có lỗi xảy ra");
      }
    });
  };

  const handleRejectCancel = () => {
    if (!selectedSession) return;
    const currentSelected = selectedSession;
    setSelectedSession(null);

    startTransition(async () => {
      addOptimisticSchedule({ type: "REJECT_CANCEL", payload: currentSelected.id });

      const result = await rejectCancelSession(currentSelected.id);

      if (result.success) {
        toast.success("Đã từ chối huỷ ca!");
        window.dispatchEvent(new Event("schedule-updated"));
        router.refresh();
      } else {
        toast.error(result.error || "Có lỗi xảy ra");
      }
    });
  };

  const events: CalendarEvent[] = optimisticSchedule
    .filter(s => s.status !== "REJECTED" && s.status !== "CANCELLED")
    .map(s => ({
      id: s.id,
      title: `${s.className} (${s.teacherName})`,
      start: new Date(s.startTime),
      end: new Date(s.endTime),
      resource: s,
    }));

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-8">
      <div className="mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900">Duyệt Đặt Phòng</h1>
          <p className="text-sm text-slate-500 mt-1">Quản lý và duyệt lịch dạy của giáo viên</p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
          <select
            value={selectedRoomId}
            disabled={isPending}
            onChange={handleRoomChange}
            className="border border-slate-300 rounded-lg px-4 py-2 bg-white text-sm focus:ring-2 focus:ring-blue-500 outline-none disabled:opacity-50"
          >
            <option value="">-- Chọn Phòng --</option>
            {rooms.map((room) => (
              <option key={room.id} value={room.id}>
                {room.name}
              </option>
            ))}
          </select>
          {isPending && <Loader2 className="w-5 h-5 animate-spin text-blue-600" />}
        </div>
      </div>

      {!selectedRoomId ? (
        <div className="space-y-4">
          <h2 className="text-lg font-bold text-slate-800">Yêu Cầu Chờ Duyệt</h2>
          {optimisticSchedule.filter(s => s.status === "PENDING" || s.isCancelRequested).length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-xl p-12 text-center text-slate-500">
              Không có yêu cầu duyệt nào. Vui lòng chọn phòng học để xem lịch tuần.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {optimisticSchedule.filter(s => s.status === "PENDING" || s.isCancelRequested).map(s => {
                const isCancel = s.isCancelRequested;
                return (
                  <div key={s.id} className={`bg-white border rounded-xl p-5 shadow-sm flex flex-col gap-2 relative transition-all hover:shadow-md ${isCancel ? "border-rose-200" : "border-slate-200"}`}>
                    <div className="flex justify-between items-start">
                      <div className="font-extrabold text-blue-700 text-lg">{s.className}</div>
                      {isCancel && <span className="px-2 py-1 bg-rose-100 text-rose-700 text-[10px] font-bold rounded-lg">Xin Huỷ Ca</span>}
                    </div>
                    <div className="text-sm text-slate-600 flex justify-between">
                      <span><strong>Giáo viên:</strong> {s.teacherName}</span>
                    </div>
                    <div className="text-sm text-slate-600">
                      <strong>Phòng:</strong> {rooms.find(r => r.id === s.roomId)?.name || "Chưa rõ"}
                    </div>
                    <div className="text-sm text-slate-600">
                      <strong>Thời gian:</strong> <span className="capitalize">{format(new Date(s.startTime), "EEEE", { locale: vi })}</span>, {format(new Date(s.startTime), "dd/MM/yyyy HH:mm")} - {format(new Date(s.endTime), "HH:mm")}
                    </div>
                    {isCancel && s.cancelReason && (
                      <div className="text-sm bg-rose-50/50 p-2 rounded-lg text-rose-800 italic mt-1">
                        <strong>Lý do:</strong> {s.cancelReason}
                      </div>
                    )}
                    <button 
                      onClick={() => setSelectedSession(s)} 
                      className="mt-3 w-full py-2 bg-amber-100 text-amber-800 font-bold rounded-lg hover:bg-amber-200 transition-colors flex items-center justify-center gap-2"
                    >
                      Xử lý ngay
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : (
        <div className="w-full h-[80vh] border border-slate-200 rounded-xl bg-white shadow-sm p-4">
          <Calendar
            localizer={localizer}
            events={events}
            startAccessor="start"
            endAccessor="end"
            defaultView="week"
            culture="vi"
            formats={formats}
            min={new Date(2026, 1, 1, 6, 0, 0)}
            max={new Date(2026, 1, 1, 23, 0, 0)}
            onSelectEvent={(event) => {
              const s = event.resource as ScheduleItemData;
              setSelectedSession(s);
            }}
            eventPropGetter={(event) => {
              const s = event.resource as ScheduleItemData;
              let backgroundColor = '#3b82f6';
              if (s.status === 'PENDING') backgroundColor = '#f59e0b';
              else if (s.isCancelRequested) backgroundColor = '#ef4444';
              else if (s.status === 'COMPLETED' || s.isAttendanceSubmitted) backgroundColor = '#94a3b8';
              
              return { style: { backgroundColor } };
            }}
            components={{
              header: ({ date }) => {
                return (
                  <div className="capitalize text-center py-1">
                    {format(date, "EEEE, dd/MM", { locale: vi })}
                  </div>
                );
              }
            }}
          />
        </div>
      )}

      {/* Approve/Reject Modal */}
      {selectedSession && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm px-4" onClick={() => setSelectedSession(null)}>
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-xl font-bold text-slate-900 mb-2">
              {selectedSession.isCancelRequested ? "Duyệt Huỷ Ca" : "Duyệt Ca Học"}
            </h3>
            <p className="text-sm text-slate-500 mb-6">
              {selectedSession.isCancelRequested 
                ? "Giáo viên đang yêu cầu huỷ ca này. Nếu đồng ý huỷ, tiền thuê phòng tự do sẽ được hoàn lại (nếu có)."
                : "Xác nhận duyệt hoặc từ chối đăng ký này."}
            </p>
            
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 mb-6 space-y-2 text-sm">
              <div className="flex justify-between border-b pb-2">
                <span className="text-slate-500">Giáo viên:</span>
                <span className="font-bold text-slate-900">{selectedSession.teacherName}</span>
              </div>
              <div className="flex justify-between border-b pb-2">
                <span className="text-slate-500">Lớp học:</span>
                <span className="font-bold text-slate-900">{selectedSession.className}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Thời gian:</span>
                <span className="font-bold text-slate-900"><span className="capitalize">{format(new Date(selectedSession.startTime), "EEEE", { locale: vi })}</span>, {format(new Date(selectedSession.startTime), "dd/MM/yyyy HH:mm")} - {format(new Date(selectedSession.endTime), "HH:mm")}</span>
              </div>
            </div>

            {selectedSession.isCancelRequested && selectedSession.cancelReason && (
              <div className="mb-6 bg-rose-50 p-3 rounded-lg border border-rose-100 text-sm">
                <div className="text-rose-800 font-bold mb-1">Lý do huỷ:</div>
                <div className="text-rose-700">{selectedSession.cancelReason}</div>
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => setSelectedSession(null)}
                className="flex-1 px-4 py-2 bg-slate-100 text-slate-700 font-bold rounded-xl hover:bg-slate-200 transition-colors"
              >
                Đóng
              </button>
              {(selectedSession.status === 'PENDING' || selectedSession.isCancelRequested) && (
                <>
                  <button
                    onClick={selectedSession.isCancelRequested ? handleRejectCancel : handleReject}
                    className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2 bg-rose-100 text-rose-700 font-bold rounded-xl hover:bg-rose-200 transition-colors"
                  >
                    <XCircle size={16} /> Từ chối {selectedSession.isCancelRequested && "Huỷ"}
                  </button>
                  <button
                    onClick={selectedSession.isCancelRequested ? handleApproveCancel : handleApprove}
                    className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 transition-colors"
                  >
                    <CheckCircle size={16} /> Đồng ý {selectedSession.isCancelRequested && "Huỷ"}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
