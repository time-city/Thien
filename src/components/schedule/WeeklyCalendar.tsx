"use client";

import { useMemo, useState, useOptimistic, startTransition, useCallback, useTransition } from "react";
import { format, startOfWeek, endOfWeek, parse, getDay, addWeeks, subWeeks } from "date-fns";
import { vi } from "date-fns/locale";
import { Trash2, CheckCircle, XCircle, Loader2, ChevronLeft, ChevronRight, MapPin } from "lucide-react";
import { toast } from "sonner";
import { deleteSchedule, updateSessionTime } from "@/actions/schedule";
import { approveSessionRequest, rejectSessionRequest } from "@/actions/mutations";
import { useConfirm } from "@/hooks/useconfirm";
import { useRouter, usePathname } from "next/navigation";
import BulkScheduleModal from "./BulkScheduleModal";
import { Calendar, dateFnsLocalizer, Event as CalendarEvent } from "react-big-calendar";
import withDragAndDrop, { EventInteractionArgs } from "react-big-calendar/lib/addons/dragAndDrop";

import "react-big-calendar/lib/css/react-big-calendar.css";
import "react-big-calendar/lib/addons/dragAndDrop/styles.css";

// Dùng DnDCalendar để vừa cho phép quét lịch tạo mới, vừa cho phép dời giờ ca cũ
const DnDCalendar = withDragAndDrop<CalendarEvent>(Calendar as any);

type Role = "SUPER_ADMIN" | "TEACHER";

type ScheduleSession = {
  id: string;
  classId: string;
  className: string;
  teacherId: string;
  teacherFullName: string;
  roomId: string | null;
  roomName: string | null;
  date: Date;
  startTime: Date;
  endTime: Date;
  status: string;
  isAttendanceSubmitted?: boolean;
  pending?: boolean;
  hourlyRate?: number;
};

type WeeklyCalendarProps = {
  userRole: Role;
  sessions: ScheduleSession[];
  rooms?: any[];
  classes?: any[];
  teachers?: any[];
  teacherSchedule?: any[];
  selectedRoomId?: string;
  onSlotSelect?: (slot: { start: Date; end: Date; roomId: string }) => void;
};

const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek: () => startOfWeek(new Date(), { weekStartsOn: 1 }),
  getDay,
  locales: { vi },
});

const formats = {
  dayFormat: (date: Date) => format(date, "dd/MM", { locale: vi }),
};

export default function WeeklyCalendar({
  userRole,
  sessions,
  rooms = [],
  classes = [],
  teachers = [],
  teacherSchedule = [],
  selectedRoomId = ""
}: WeeklyCalendarProps) {
  const [currentDate, setCurrentDate] = useState<Date>(() => new Date());
  const { confirm } = useConfirm();
  const [isDeleting, setIsDeleting] = useState(false);
  const router = useRouter();
  const pathname = usePathname();

  // State Modal Xóa
  const [deleteModalState, setDeleteModalState] = useState<{
    isOpen: boolean;
    type: "SINGLE" | "BULK";
    sessionId?: string;
  }>({ isOpen: false, type: "SINGLE" });

  // Optimistic UI đồng bộ mượt mà
  const [optimisticSessions, dispatchOptimistic] = useOptimistic(
    sessions as ScheduleSession[],
    (state, action: { type: "DELETE_MANY" | "APPROVE" | "REJECT" | "UPDATE_TIME" | "ADD" | "REVERT_ADD"; payload: any }) => {
      switch (action.type) {
        case "DELETE_MANY": return state.filter(s => !(action.payload as string[]).includes(s.id));
        case "APPROVE": return state.map(s => s.id === action.payload ? { ...s, status: "COMPLETED", pending: true } : s);
        case "REJECT": return state.map(s => s.id === action.payload ? { ...s, status: "REJECTED", pending: true } : s);
        case "UPDATE_TIME": return state.map(s => s.id === action.payload.id ? { ...s, startTime: action.payload.start, endTime: action.payload.end, pending: true } : s);
        case "ADD": return [...state, ...action.payload];
        case "REVERT_ADD": return state.filter(s => !(action.payload as string[]).includes(s.id));
        default: return state;
      }
    }
  );

  // State Modal Duyệt
  const [selectedPendingSession, setSelectedPendingSession] = useState<ScheduleSession | null>(null);
  const isAdmin = userRole === "SUPER_ADMIN";

  // 🟢 STATE CHO MODAL TẠO LỊCH (Khi Admin kéo quét trên lưới)
  const [bookingSlot, setBookingSlot] = useState<{ start: Date; end: Date } | null>(null);
  const [isPending, startTransitionHook] = useTransition();

  // Điều hướng tuần
  const handleNavigate = (action: 'PREV' | 'NEXT' | 'TODAY') => {
    if (action === 'TODAY') setCurrentDate(new Date());
    else if (action === 'PREV') setCurrentDate(prev => subWeeks(prev, 1));
    else if (action === 'NEXT') setCurrentDate(prev => addWeeks(prev, 1));
  };

  // Kéo dời giờ lịch cũ
  const onEventDrop = useCallback(({ event, start, end }: EventInteractionArgs<CalendarEvent>) => {
    const s = event.resource as ScheduleSession;
    startTransition(() => { dispatchOptimistic({ type: "UPDATE_TIME", payload: { id: s.id, start, end } }); });
    startTransition(async () => {
      try {
        const result = await updateSessionTime(s.id, start as Date, end as Date);
        if (result.success) { toast.success("Đã di chuyển lịch học!"); router.refresh(); }
        else { toast.error(result.error || "Có lỗi, lịch đã quay về vị trí cũ!"); router.refresh(); }
      } catch (error) { toast.error("Lỗi kết nối mạng!"); router.refresh(); }
    });
  }, [dispatchOptimistic, router]);

  // Kéo giãn thời lượng lịch cũ
  const onEventResize = useCallback(({ event, start, end }: EventInteractionArgs<CalendarEvent>) => {
    const s = event.resource as ScheduleSession;
    startTransition(() => { dispatchOptimistic({ type: "UPDATE_TIME", payload: { id: s.id, start, end } }); });
    const diffInHours = ((end as Date).getTime() - (start as Date).getTime()) / (1000 * 60 * 60);
    const rate = s.hourlyRate || 0;
    const estimatedCost = diffInHours * rate;
    startTransition(async () => {
      try {
        const result = await updateSessionTime(s.id, start as Date, end as Date);
        if (result.success) { toast.success(`Cập nhật thời lượng. Tạm tính: ${estimatedCost.toLocaleString("vi-VN")}đ`); router.refresh(); }
        else { toast.error(result.error || "Không thể thay đổi thời lượng!"); router.refresh(); }
      } catch (error) { toast.error("Lỗi hệ thống!"); router.refresh(); }
    });
  }, [dispatchOptimistic, router]);

  // Xóa lịch
  const executeDelete = async (mode: "SINGLE" | "FOLLOWING") => {
    setIsDeleting(true);
    startTransition(async () => {
      try {
        let result;
        if (deleteModalState.type === "SINGLE" && deleteModalState.sessionId) {
          if (mode === "SINGLE") dispatchOptimistic({ type: "DELETE_MANY", payload: [deleteModalState.sessionId] });
          result = await deleteSchedule(deleteModalState.sessionId, mode);
          if (result.success) toast.success(`Đã xóa thành công ca học!`);
        }
        if (result?.success) { window.dispatchEvent(new Event("schedule-updated")); router.refresh(); }
        else toast.error(result?.error || "Xóa thất bại!");
      } finally { setIsDeleting(false); setDeleteModalState({ isOpen: false, type: "SINGLE" }); }
    });
  };

  // Duyệt
  const handleApprove = () => {
    if (!selectedPendingSession) return;
    const currentSelected = selectedPendingSession;
    setSelectedPendingSession(null);
    startTransition(async () => {
      dispatchOptimistic({ type: "APPROVE", payload: currentSelected.id });
      const result = await approveSessionRequest(currentSelected.id);
      if (result.success) {
        if ("deductedFee" in result && result.deductedFee) toast.success(`Đã duyệt! Thu phí phòng: ${result.deductedFee.toLocaleString("vi-VN")}đ`);
        else toast.success("Đã duyệt lịch học!");
        window.dispatchEvent(new Event("schedule-updated")); router.refresh();
      } else toast.error(result.error || "Có lỗi xảy ra.");
    });
  };

  // Từ chối
  const handleReject = () => {
    if (!selectedPendingSession) return;
    const currentSelected = selectedPendingSession;
    setSelectedPendingSession(null);
    startTransition(async () => {
      dispatchOptimistic({ type: "REJECT", payload: currentSelected.id });
      const result = await rejectSessionRequest(currentSelected.id);
      if (result.success) { toast.success("Đã từ chối lịch học!"); window.dispatchEvent(new Event("schedule-updated")); router.refresh(); }
      else toast.error(result.error || "Có lỗi xảy ra.");
    });
  };

  // 🟢 BẮT SỰ KIỆN ADMIN KÉO QUÉT (SELECT SLOT) ĐỂ TẠO LỊCH MỚI
  const handleSelectSlot = useCallback(({ start, end }: { start: Date; end: Date }) => {
    if (!selectedRoomId) {
      toast.warning("Vui lòng chọn phòng học ở thanh công cụ ngoài trước khi tạo lịch.");
      return;
    }

    // Ghi nhận khoảng thời gian vừa kéo và mở Modal
    setBookingSlot({ start, end });
  }, [selectedRoomId]);

  const handleSelectEvent = (event: CalendarEvent) => {
    const s = event.resource as ScheduleSession;
    if (isAdmin && (s.status === "PENDING" || s.pending)) setSelectedPendingSession(s);
    else router.push(`/ta?classId=${s.classId}&sessionId=${s.id}`);
  };

  const events: CalendarEvent[] = useMemo(() => {
    return optimisticSessions.filter(s => s.status !== "CANCELLED" && s.status !== "REJECTED").map(s => ({
      id: s.id, title: `${s.className} - ${s.teacherFullName}`, start: new Date(s.startTime), end: new Date(s.endTime), resource: s,
    }));
  }, [optimisticSessions]);

  return (
    <div className="h-dvh w-full mx-auto p-0 md:p-4 flex flex-col overflow-hidden bg-slate-50">
      <div className="flex-1 flex flex-col md:rounded-2xl bg-white md:shadow-sm md:border md:border-slate-200 overflow-hidden">

        {/* HEADER ĐIỀU HƯỚNG */}
        <div className="flex-shrink-0 px-4 py-3 border-b border-slate-100 bg-gradient-to-b from-slate-50 to-white">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex flex-wrap items-center gap-3 md:gap-4">
              <h2 className="text-sm md:text-base font-extrabold text-slate-900 hidden sm:block">Thời khóa biểu</h2>
              
              {/* SELECT ROOM */}
              {isAdmin && rooms && rooms.length > 0 && (
                <div className="flex items-center gap-2">
                  <select
                    value={selectedRoomId}
                    onChange={(e) => {
                      const rId = e.target.value;
                      if (rId) {
                        router.push(`${pathname}?roomId=${rId}`);
                      } else {
                        router.push(pathname);
                      }
                    }}
                    className="border border-slate-300 rounded-lg px-3 py-1.5 bg-white text-xs md:text-sm font-bold text-slate-700 focus:ring-2 focus:ring-blue-500 outline-none shadow-sm cursor-pointer"
                  >
                    <option value="">-- Chọn Phòng --</option>
                    {rooms.map((room: any) => (
                      <option key={room.id} value={room.id}>
                        {room.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg border border-slate-200 shadow-sm">
                <button onClick={() => handleNavigate('PREV')} className="p-1 hover:bg-white hover:shadow-sm rounded transition-all text-slate-700 hover:text-blue-600"><ChevronLeft size={18} /></button>
                <button onClick={() => handleNavigate('TODAY')} className="px-3 text-xs md:text-sm font-bold text-slate-700 hover:text-blue-600 transition-colors">Hôm nay</button>
                <button onClick={() => handleNavigate('NEXT')} className="p-1 hover:bg-white hover:shadow-sm rounded transition-all text-slate-700 hover:text-blue-600"><ChevronRight size={18} /></button>
              </div>
              <div className="text-xs md:text-sm font-semibold text-blue-800 bg-blue-50 px-3 py-1.5 rounded-lg border border-blue-100">
                Tuần {format(startOfWeek(currentDate, { weekStartsOn: 1 }), "dd/MM")} - {format(endOfWeek(currentDate, { weekStartsOn: 1 }), "dd/MM/yyyy")}
              </div>
            </div>
            <div className="flex items-center gap-2 text-[10px] md:text-xs text-slate-600 self-end sm:self-auto">
              <span className="inline-flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-blue-500" /> Đã lịch</span>
              <span className="inline-flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-amber-400" /> Chờ duyệt</span>
              <span className="inline-flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-slate-400" /> Hoàn tất</span>
            </div>
          </div>
        </div>

        {/* LƯỚI LỊCH */}
        <div className="flex-1 p-2 min-h-0 relative">
          <div className="w-full h-full border border-slate-200 rounded-xl overflow-x-auto overflow-y-hidden rbc-no-scroll-wrapper">
            <div className="h-full min-w-[700px] md:min-w-full">
              <DnDCalendar
              localizer={localizer}
              events={events}
              startAccessor={(event: CalendarEvent) => event.start as Date}
              endAccessor={(event: CalendarEvent) => event.end as Date}
              defaultView="week" culture="vi" date={currentDate}
              onNavigate={(date) => setCurrentDate(date)}
              onSelectEvent={handleSelectEvent}
              min={new Date(2026, 1, 1, 0, 0, 0)} max={new Date(2026, 1, 1, 23, 59, 59)}
              views={['week']} step={30} toolbar={false}
              formats={formats}

              // Cho phép kéo dời giờ ca học cũ
              resizable={isAdmin}
              draggableAccessor={(e) => isAdmin}
              onEventDrop={onEventDrop}
              onEventResize={onEventResize}

              // 🟢 KÍCH HOẠT QUÉT CHUỘT (KÉO THẢ TẠO CA MỚI)
              selectable={isAdmin}
              onSelectSlot={handleSelectSlot}

              components={{
                header: ({ date }) => {
                  return (
                    <div className="capitalize text-center py-1">
                      {format(date, "EEEE, dd/MM", { locale: vi })}
                    </div>
                  );
                },
                event: ({ event }: any) => {
                  const s = event.resource as ScheduleSession;
                  return (
                    <div className="w-full h-full flex flex-col relative group pr-4 select-none break-words text-left">
                      <div className="font-semibold leading-tight text-[11px]">{s.className}</div>
                      <div className="text-[9px] opacity-80 leading-normal mt-0.5">{s.teacherFullName}</div>
                      {isAdmin && (
                        <button onClick={(e) => { e.stopPropagation(); setDeleteModalState({ isOpen: true, type: "SINGLE", sessionId: s.id }); }} className="absolute top-0 right-0 p-[3px] text-white/70 hover:text-white bg-black/10 hover:bg-red-500 rounded opacity-0 group-hover:opacity-100 transition-all z-10" title="Xóa ca học này">
                          <Trash2 size={13} />
                        </button>
                      )}
                    </div>
                  );
                }
              }}

              eventPropGetter={(event: CalendarEvent) => {
                const s = event.resource as ScheduleSession;
                let backgroundColor = '#eff6ff'; let borderColor = '#3b82f6'; let textColor = '#1e3a8a';
                if (s.status === 'PENDING') { backgroundColor = '#fffbeb'; borderColor = '#f59e0b'; textColor = '#78350f'; }
                else if (s.status === 'COMPLETED' || s.isAttendanceSubmitted) { backgroundColor = '#f8fafc'; borderColor = '#94a3b8'; textColor = '#334155'; }
                return { style: { backgroundColor, color: textColor, opacity: s.pending ? 0.5 : 1, borderRadius: '4px', border: `1px solid ${borderColor}`, borderLeft: `3px solid ${borderColor}`, boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.03)', width: '96%', marginLeft: '2px', padding: '2px 4px', fontSize: '11px', fontWeight: '500', lineHeight: '1.2', overflow: 'hidden', whiteSpace: 'normal', cursor: 'pointer', minHeight: '36px' } };
              }}
            />
            </div>
          </div>
        </div>
      </div>

      {/* ================= MODAL 1: TẠO LỊCH MỚI CỦA ADMIN (Gọi BulkScheduleModal) ================= */}
      {bookingSlot && isAdmin && (
        <BulkScheduleModal
          classes={classes}
          rooms={rooms}
          teachers={teachers}
          defaultData={{
            roomId: selectedRoomId,
            startTime: format(bookingSlot.start, "HH:mm"),
            endTime: format(bookingSlot.end, "HH:mm"),
            day: bookingSlot.start.getDay(),
            date: format(bookingSlot.start, "yyyy-MM-dd")
          }}
          isOpen={!!bookingSlot}
          onOpenChange={(open) => {
            if (!open) setBookingSlot(null);
          }}
          showTriggerButton={false}
          onOptimisticSubmit={(newSessions) => {
            startTransition(() => {
              dispatchOptimistic({ type: "ADD", payload: newSessions });
            });
          }}
          onRevertSubmit={(tempIds) => {
            startTransition(() => {
              dispatchOptimistic({ type: "REVERT_ADD", payload: tempIds });
            });
          }}
        />
      )}

      {/* ================= MODAL 2: DUYỆT CA HỌC PENDING ================= */}
      {selectedPendingSession && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm px-4" onClick={() => setSelectedPendingSession(null)}>
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-xl font-bold text-slate-900 mb-2">Duyệt Ca Học</h3>
            <p className="text-sm text-slate-500 mb-6">Xác nhận duyệt hoặc từ chối yêu cầu đăng ký này.</p>
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 mb-6 space-y-2 text-sm">
              <div className="flex justify-between border-b pb-2"><span className="text-slate-500">Giáo viên:</span><span className="font-bold text-slate-900">{selectedPendingSession.teacherFullName}</span></div>
              <div className="flex justify-between border-b pb-2"><span className="text-slate-500">Lớp học:</span><span className="font-bold text-slate-900">{selectedPendingSession.className}</span></div>
              <div className="flex justify-between border-b pb-2"><span className="text-slate-500">Ngày:</span><span className="font-bold text-slate-900">{format(new Date(selectedPendingSession.date), "dd/MM/yyyy")}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Thời gian:</span><span className="font-bold text-slate-900">{format(new Date(selectedPendingSession.startTime), "HH:mm")} - {format(new Date(selectedPendingSession.endTime), "HH:mm")}</span></div>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setSelectedPendingSession(null)} className="flex-1 px-4 py-2 bg-slate-100 text-slate-700 font-bold rounded-xl hover:bg-slate-200 transition-colors">Đóng</button>
              <button onClick={handleReject} className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2 bg-rose-100 text-rose-700 font-bold rounded-xl hover:bg-rose-200 transition-colors"><XCircle size={16} /> Từ chối</button>
              <button onClick={handleApprove} className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 transition-colors"><CheckCircle size={16} /> Duyệt</button>
            </div>
          </div>
        </div>
      )}

      {/* ================= MODAL 3: XÓA LỊCH CŨ ================= */}
      {deleteModalState.isOpen && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm" onClick={() => setDeleteModalState({ isOpen: false, type: "SINGLE" })}>
          <div className="bg-white w-[95%] max-w-md rounded-2xl shadow-xl border border-slate-200 p-5" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-extrabold text-slate-800">Xóa ca học</h2>
              <button onClick={() => setDeleteModalState({ isOpen: false, type: "SINGLE" })} className="p-1.5 bg-slate-100 hover:bg-slate-200 rounded-full text-slate-600 transition-colors">
                <XCircle size={18} />
              </button>
            </div>
            <p className="text-sm text-slate-600 mb-6 leading-relaxed">Bạn có muốn xóa thêm các ca học lặp lại tiếp theo của cùng lớp học và giáo viên này không?</p>
            <div className="flex flex-col gap-3">
              <button disabled={isDeleting} onClick={() => executeDelete("SINGLE")} className="w-full flex flex-col items-center justify-center gap-1 py-3 px-4 rounded-xl border-2 border-slate-200 hover:border-blue-500 hover:bg-blue-50 text-slate-700 hover:text-blue-700 font-bold relative transition-colors">
                <span>Chỉ xóa ca này</span>
                <span className="text-xs font-normal opacity-80">Không ảnh hưởng đến lịch trong tương lai</span>
                {isDeleting && <Loader2 size={16} className="animate-spin absolute right-4" />}
              </button>
              <button disabled={isDeleting} onClick={() => executeDelete("FOLLOWING")} className="w-full flex flex-col items-center justify-center gap-1 py-3 px-4 rounded-xl border-2 border-slate-200 hover:border-rose-500 hover:bg-rose-50 text-slate-700 hover:text-rose-700 font-bold relative transition-colors">
                <span>Xóa ca này và các ca tiếp theo</span>
                <span className="text-xs font-normal opacity-80">Xóa vĩnh viễn chuỗi lịch này về sau</span>
                {isDeleting && <Loader2 size={16} className="animate-spin absolute right-4" />}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}