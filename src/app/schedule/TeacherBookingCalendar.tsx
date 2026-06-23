"use client";

import { useState, useMemo, useTransition, useOptimistic, useCallback } from "react";
import { useRouter } from "next/navigation";
import { format, startOfWeek, endOfWeek, isSameDay, addWeeks, subWeeks, parse, getDay } from "date-fns";
import { vi } from "date-fns/locale";
import { ChevronLeft, ChevronRight, XCircle, MapPin, CalendarPlus, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { requestRoomBooking, rejectSessionRequest, requestCancelSession } from "@/actions/mutations";
import type { RoomData, ScheduleItemData as BaseScheduleItemData, ClassData } from "@/actions/queries";
import { Calendar, dateFnsLocalizer, Event as CalendarEvent } from "react-big-calendar";

// Import CSS y chang bên WeeklyCalendar
import "react-big-calendar/lib/css/react-big-calendar.css";

export type ScheduleItemData = BaseScheduleItemData & { pending?: boolean };

const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek: () => startOfWeek(new Date(), { weekStartsOn: 1 }),
  getDay,
  locales: { vi },
});

export default function TeacherBookingCalendar({
  rooms,
  classes,
  initialSchedule,
  teacherSchedule,
  teacherId,
  selectedRoomId,
}: {
  rooms: RoomData[];
  classes: ClassData[];
  initialSchedule: BaseScheduleItemData[];
  teacherSchedule: BaseScheduleItemData[];
  teacherId: string;
  selectedRoomId: string;
}) {
  const router = useRouter();

  // State điều hướng ngày tháng
  const [currentDate, setCurrentDate] = useState<Date>(() => new Date());
  // Optimistic UI State
  const [optimisticSchedule, addOptimisticSchedule] = useOptimistic(
    initialSchedule as ScheduleItemData[],
    (state, action: { type: "ADD" | "CANCEL_PENDING" | "CANCEL_SCHEDULED"; payload: any }) => {
      switch (action.type) {
        case "ADD":
          return [...state, action.payload];
        case "CANCEL_PENDING":
          return state.filter(s => s.id !== action.payload.id);
        case "CANCEL_SCHEDULED":
          return state.map(s => s.id === action.payload.id ? { ...s, isCancelRequested: true, cancelReason: action.payload.reason, pending: true } : s);
        default:
          return state;
      }
    }
  );

  // Modal states
  const [bookingSlot, setBookingSlot] = useState<{ start: Date; end: Date } | null>(null);
  const [selectedClassId, setSelectedClassId] = useState("");
  const [cancelSession, setCancelSession] = useState<ScheduleItemData | null>(null);
  const [cancelReason, setCancelReason] = useState("");

  const [isPending, startTransition] = useTransition();

  // Hàm chuyển đổi tuần
  const handleNavigate = (action: 'PREV' | 'NEXT' | 'TODAY') => {
    if (action === 'TODAY') {
      setCurrentDate(new Date());
    } else if (action === 'PREV') {
      setCurrentDate(prev => subWeeks(prev, 1));
    } else if (action === 'NEXT') {
      setCurrentDate(prev => addWeeks(prev, 1));
    }
  };

  const handleRoomChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const roomId = e.target.value;
    startTransition(() => {
      if (roomId) {
        router.push(`/schedule?roomId=${roomId}`);
      } else {
        router.push(`/schedule`);
      }
    });
  };

  const handleRequestBooking = () => {
    if (!bookingSlot || !selectedClassId || !selectedRoomId) {
      toast.error("Vui lòng chọn đầy đủ thông tin");
      return;
    }

    const currentSlot = bookingSlot;
    const currentClassId = selectedClassId;
    const currentRoomId = selectedRoomId;

    setBookingSlot(null);
    setSelectedClassId("");

    startTransition(async () => {
      const tempId = `temp-${Date.now()}`;

      const tempSession: ScheduleItemData = {
        id: tempId,
        roomId: currentRoomId,
        roomName: rooms.find(r => r.id === currentRoomId)?.name || "",
        isAttendanceSubmitted: false,
        classId: currentClassId === "freelance" ? "" : currentClassId,
        className: currentClassId === "freelance" ? "Lớp Tự Do (Thuê phòng)" : classes.find(c => c.id === currentClassId)?.name || "",
        teacherId: teacherId,
        teacherName: "",
        date: currentSlot.start,
        startTime: currentSlot.start,
        endTime: currentSlot.end,
        status: "PENDING",
        isCancelRequested: false,
        cancelReason: null,
        pending: true
      };

      addOptimisticSchedule({ type: "ADD", payload: tempSession });

      const result = await requestRoomBooking({
        roomId: currentRoomId,
        classId: currentClassId,
        startTime: currentSlot.start.toISOString(),
        endTime: currentSlot.end.toISOString(),
      });

      if (result.success) {
        toast.success("Đăng ký phòng thành công! Đang chờ duyệt.");
        router.refresh();
      } else {
        toast.error(result.error || "Có lỗi xảy ra");
      }
    });
  };

  const handleCancelRequest = () => {
    if (!cancelSession) return;

    if (cancelSession.status === "SCHEDULED" && !cancelReason.trim()) {
      toast.warning("Vui lòng nhập lý do huỷ ca.");
      return;
    }

    const currentCancel = cancelSession;
    const currentReason = cancelReason;

    setCancelSession(null);
    setCancelReason("");

    startTransition(async () => {
      let result;

      if (currentCancel.status === "PENDING") {
        addOptimisticSchedule({ type: "CANCEL_PENDING", payload: { id: currentCancel.id } });
        result = await rejectSessionRequest(currentCancel.id);
      } else if (currentCancel.status === "SCHEDULED") {
        addOptimisticSchedule({ type: "CANCEL_SCHEDULED", payload: { id: currentCancel.id, reason: currentReason } });
        result = await requestCancelSession(currentCancel.id, currentReason);
      }

      if (result && result.success) {
        toast.success(currentCancel.status === "PENDING" ? "Đã hủy yêu cầu đặt phòng!" : "Đã gửi yêu cầu huỷ ca!");
        window.dispatchEvent(new Event("schedule-updated"));
        router.refresh();
      } else {
        toast.error(result?.error || "Có lỗi xảy ra");
      }
    });
  };

  const handleSelectSlot = useCallback(
    ({ start, end }: { start: Date; end: Date }) => {
      setBookingSlot({ start, end });
    },
    []
  );

  const handleSelectEvent = useCallback(
    (event: CalendarEvent) => {
      const s = event.resource as ScheduleItemData;
      // Chỉ cho phép giáo viên thao tác trên ca dạy của chính mình
      if (s.teacherId !== teacherId) {
        toast.warning("Ca học này đã có người đăng ký.");
        return;
      }
      if (s.status === "PENDING" || (s.status === "SCHEDULED" && !s.isCancelRequested)) {
        setCancelSession(s);
        setCancelReason("");
      } else {
        // Nếu đã duyệt và không xin huỷ, redirect qua trang điểm danh
        router.push(`/ta?classId=${s.classId}&sessionId=${s.id}`);
      }
    },
    [teacherId, router]
  );

  const events: CalendarEvent[] = useMemo(() => {
    return optimisticSchedule
      .filter(s => s.status !== "REJECTED" && s.status !== "CANCELLED")
      .map(s => ({
        id: s.id,
        title: s.className,
        start: new Date(s.startTime),
        end: new Date(s.endTime),
        resource: s,
      }));
  }, [optimisticSchedule]);

  return (
    // THIẾT KẾ FLEXBOX FULL MÀN HÌNH (h-dvh) CHỐNG SCROLL TOÀN TRANG
    <div className="h-dvh w-full mx-auto p-2 md:p-4 flex flex-col overflow-hidden bg-slate-50">
      <div className="flex-1 flex flex-col rounded-2xl bg-white shadow-sm border border-slate-200 overflow-hidden">

        {/* HEADER ĐIỀU HƯỚNG MỚI */}
        <div className="flex-shrink-0 px-4 py-3 border-b border-slate-100 bg-gradient-to-b from-slate-50 to-white">
          <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-3">

            <div className="flex flex-wrap items-center gap-3 md:gap-4">
              <h2 className="text-sm md:text-base font-extrabold text-slate-900 hidden sm:block">Đăng Ký Phòng</h2>

              {/* SELECT ROOM (Tích hợp lên Header cho gọn) */}
              <div className="flex items-center gap-2">
                <select
                  value={selectedRoomId}
                  disabled={isPending}
                  onChange={handleRoomChange}
                  className="border border-slate-300 rounded-lg px-3 py-1.5 bg-white text-xs md:text-sm font-bold text-slate-700 focus:ring-2 focus:ring-blue-500 outline-none shadow-sm cursor-pointer disabled:opacity-50"
                >
                  <option value="">-- Chọn Phòng --</option>
                  {rooms.map((room) => (
                    <option key={room.id} value={room.id}>
                      {room.name} {room.feePerHour > 0 ? `(${Number(room.feePerHour).toLocaleString('vi-VN')}đ/h)` : ""}
                    </option>
                  ))}
                </select>
                {isPending && <Loader2 className="w-4 h-4 animate-spin text-blue-600" />}
              </div>

              {/* NÚT CHUYỂN TUẦN */}
              <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg border border-slate-200 shadow-sm">
                <button onClick={() => handleNavigate('PREV')} className="p-1 hover:bg-white hover:shadow-sm rounded transition-all text-slate-700 hover:text-blue-600">
                  <ChevronLeft size={16} />
                </button>
                <button onClick={() => handleNavigate('TODAY')} className="px-2 md:px-3 text-xs md:text-sm font-bold text-slate-700 hover:text-blue-600 transition-colors">
                  Hôm nay
                </button>
                <button onClick={() => handleNavigate('NEXT')} className="p-1 hover:bg-white hover:shadow-sm rounded transition-all text-slate-700 hover:text-blue-600">
                  <ChevronRight size={16} />
                </button>
              </div>

              {/* HIỂN THỊ NGÀY THÁNG */}
              <div className="text-xs md:text-sm font-semibold text-blue-800 bg-blue-50 px-3 py-1.5 rounded-lg border border-blue-100 hidden md:block">
                Tuần {format(startOfWeek(currentDate, { weekStartsOn: 1 }), "dd/MM")} - {format(endOfWeek(currentDate, { weekStartsOn: 1 }), "dd/MM/yyyy")}
              </div>
            </div>

            {/* CHÚ GIẢI */}
            <div className="flex flex-wrap items-center gap-2 text-[10px] md:text-xs text-slate-600">
              <span className="inline-flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-blue-500" /> Của bạn</span>
              <span className="inline-flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-amber-400" /> Đang chờ</span>
              <span className="inline-flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-rose-500" /> Xin huỷ</span>
              <span className="inline-flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-slate-300" /> Kín lịch</span>
            </div>
          </div>
        </div>

        {/* NỘI DUNG LỊCH (Bọc class scroll tuỳ chỉnh) */}
        {!selectedRoomId ? (
          <div className="flex-1 flex flex-col items-center justify-center p-8 bg-slate-50/50">
            <MapPin size={48} className="text-slate-300 mb-4 animate-bounce" />
            <h3 className="text-lg font-bold text-slate-700 mb-2">Vui lòng chọn phòng</h3>
            <p className="text-slate-500 text-sm">Chọn một phòng ở menu phía trên để xem lịch trống và kéo thả đăng ký nhé!</p>
          </div>
        ) : (
          <div className="flex-1 p-2 min-h-0 relative">
            <div className="w-full h-full border border-slate-200 rounded-xl overflow-hidden rbc-custom-scroll-wrapper">
              <Calendar
                localizer={localizer}
                events={events}
                startAccessor="start"
                endAccessor="end"
                defaultView="week"
                culture="vi"
                date={currentDate}
                onNavigate={(date) => setCurrentDate(date)}
                selectable
                onSelectSlot={handleSelectSlot}
                onSelectEvent={handleSelectEvent}
                min={new Date(2026, 1, 1, 0, 0, 0)} // Full 24 tiếng
                max={new Date(2026, 1, 1, 23, 59, 59)}
                views={['week']}
                step={30}
                toolbar={false}

                // RENDER GIAO DIỆN CỤC SỰ KIỆN
                components={{
                  event: ({ event }: any) => {
                    const s = event.resource as ScheduleItemData;
                    const isMine = s.teacherId === teacherId;

                    return (
                      <div className="w-full h-full flex flex-col relative group pr-5 select-none">
                        <div className="font-semibold truncate">{isMine ? s.className : "Đã có người đặt"}</div>
                        <div className="text-[9px] opacity-90 truncate">{isMine ? "Lớp của bạn" : "Không thể thao tác"}</div>

                        {/* Hiện icon Dấu X để xin huỷ ca học CỦA MÌNH */}
                        {isMine && s.status !== "CANCELLED" && s.status !== "REJECTED" && !s.isCancelRequested && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setCancelSession(s);
                              setCancelReason("");
                            }}
                            className="absolute top-0 right-0 p-[3px] text-white/70 hover:text-white bg-black/10 hover:bg-rose-500 rounded opacity-0 group-hover:opacity-100 transition-all z-10"
                            title="Yêu cầu huỷ ca"
                          >
                            <XCircle size={13} />
                          </button>
                        )}
                      </div>
                    );
                  }
                }}

                // CSS BO VIỀN NHƯ GOOGLE CALENDAR
                eventPropGetter={(event: CalendarEvent) => {
                  const s = event.resource as ScheduleItemData;
                  const isMine = s.teacherId === teacherId;

                  // Style cho Lớp Của Người Khác (Làm xám, mờ đi)
                  if (!isMine) {
                    return {
                      style: {
                        backgroundColor: '#f1f5f9', color: '#64748b',
                        borderRadius: '4px', border: `1px solid #e2e8f0`, borderLeft: `3px solid #94a3b8`,
                        width: '96%', marginLeft: '2px', padding: '2px 4px', fontSize: '11px',
                        fontWeight: '500', lineHeight: '1.1', overflow: 'hidden', whiteSpace: 'nowrap', cursor: 'not-allowed'
                      }
                    };
                  }

                  // Style cho Lớp Của Mình
                  let backgroundColor = '#eff6ff'; let borderColor = '#3b82f6'; let textColor = '#1e3a8a';

                  if (s.status === 'PENDING') { backgroundColor = '#fffbeb'; borderColor = '#f59e0b'; textColor = '#78350f'; }
                  else if (s.isCancelRequested) { backgroundColor = '#fef2f2'; borderColor = '#ef4444'; textColor = '#991b1b'; }
                  else if (s.status === 'COMPLETED' || s.isAttendanceSubmitted) { backgroundColor = '#f8fafc'; borderColor = '#94a3b8'; textColor = '#334155'; }

                  const opacity = s.pending ? 0.6 : 1;

                  return {
                    style: {
                      backgroundColor, color: textColor, opacity,
                      borderRadius: '4px', border: `1px solid ${borderColor}`, borderLeft: `3px solid ${borderColor}`,
                      boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.03)',
                      width: '96%', marginLeft: '2px', padding: '2px 4px',
                      fontSize: '11px', fontWeight: '500', lineHeight: '1.1',
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      cursor: 'pointer',
                    },
                  };
                }}
              />
            </div>
          </div>
        )}
      </div>

      {/* MODAL: Đăng ký phòng (Hiện khi quét chuột (Select Slot) vào giờ trống) */}
      {bookingSlot && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/50 backdrop-blur-sm px-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl">
            <h3 className="text-xl font-bold text-slate-900 mb-2">Đăng Ký Phòng</h3>
            <p className="text-sm text-slate-500 mb-6">Chọn lớp học bạn muốn dạy trong khoảng thời gian này.</p>

            <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 mb-4 space-y-2 text-sm">
              <div className="flex justify-between border-b pb-2">
                <span className="text-slate-500">Phòng:</span>
                <span className="font-bold text-slate-900">
                  {rooms.find(r => r.id === selectedRoomId)?.name}
                  <span className="text-blue-600 ml-1">
                    ({Number(rooms.find(r => r.id === selectedRoomId)?.feePerHour || 0).toLocaleString('vi-VN')}đ/h)
                  </span>
                </span>
              </div>
              <div className="flex justify-between border-b pb-2">
                <span className="text-slate-500">Ngày:</span>
                <span className="font-bold text-slate-900">{format(bookingSlot.start, "dd/MM/yyyy")}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Thời gian:</span>
                <span className="font-bold text-slate-900">{format(bookingSlot.start, "HH:mm")} - {format(bookingSlot.end, "HH:mm")}</span>
              </div>
            </div>

            <div className="mb-6">
              <label className="block text-sm font-bold text-slate-700 mb-2">Lớp học của bạn</label>
              <select
                value={selectedClassId}
                onChange={(e) => setSelectedClassId(e.target.value)}
                className="w-full border border-slate-300 rounded-lg px-4 py-2.5 bg-white text-sm focus:ring-2 focus:ring-blue-500 outline-none"
              >
                <option value="">-- Chọn Lớp Học --</option>
                <option value="freelance" className="font-bold text-blue-700 bg-blue-50">🌟 Lớp Tự Do (Thuê phòng)</option>
                {classes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
              {classes.length === 0 && (
                <p className="text-xs text-rose-500 mt-2">Bạn chưa được gán dạy lớp nào. Vui lòng liên hệ Admin.</p>
              )}
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setBookingSlot(null)}
                disabled={isPending}
                className="flex-1 px-4 py-2.5 bg-slate-100 text-slate-700 font-bold rounded-xl hover:bg-slate-200 transition-colors"
              >
                Hủy
              </button>
              <button
                onClick={handleRequestBooking}
                disabled={isPending || !selectedClassId}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 transition-colors disabled:opacity-50"
              >
                Xác nhận
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Yêu Cầu Huỷ Ca (Hiện khi click icon dấu X) */}
      {cancelSession && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/50 backdrop-blur-sm px-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl text-center">
            <div className="w-16 h-16 bg-rose-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <XCircle size={32} className="text-rose-600" />
            </div>
            <h3 className="text-xl font-bold text-slate-900 mb-2">
              {cancelSession.status === "PENDING" ? "Hủy Đăng Ký?" : "Yêu Cầu Huỷ Ca"}
            </h3>
            <p className="text-sm text-slate-500 mb-4">
              {cancelSession.status === "PENDING"
                ? <>Bạn có chắc chắn muốn hủy yêu cầu đặt phòng cho lớp <strong>{cancelSession.className}</strong> không?</>
                : <>Bạn đang yêu cầu huỷ ca học đã được duyệt của lớp <strong>{cancelSession.className}</strong>. Xin lưu ý: nếu được duyệt, tiền phòng sẽ được hoàn lại.</>
              }
            </p>

            {cancelSession.status === "SCHEDULED" && (
              <textarea
                placeholder="Nhập lý do xin huỷ ca (VD: Ốm đột xuất...)"
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                className="w-full text-sm p-3 border border-slate-200 rounded-xl mb-6 outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500"
                rows={3}
              />
            )}

            <div className="flex gap-3">
              <button
                onClick={() => { setCancelSession(null); setCancelReason(""); }}
                disabled={isPending}
                className="flex-1 px-4 py-2.5 bg-slate-100 text-slate-700 font-bold rounded-xl hover:bg-slate-200 transition-colors"
              >
                Đóng
              </button>
              <button
                onClick={handleCancelRequest}
                disabled={isPending}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-rose-600 text-white font-bold rounded-xl hover:bg-rose-700 transition-colors disabled:opacity-50"
              >
                {cancelSession.status === "PENDING" ? "Đồng ý Hủy" : "Gửi Yêu Cầu Huỷ"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}