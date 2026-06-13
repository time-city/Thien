"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { format, addDays, startOfWeek, isSameDay, addWeeks } from "date-fns";
import { ChevronLeft, ChevronRight, XCircle, MapPin, CalendarPlus } from "lucide-react";
import { toast } from "sonner";
import { requestRoomBooking, rejectSessionRequest, requestCancelSession } from "@/actions/mutations";
import type { RoomData, ScheduleItemData, ClassData } from "@/actions/queries";

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
  initialSchedule: ScheduleItemData[];
  teacherSchedule: ScheduleItemData[];
  teacherId: string;
  selectedRoomId: string;
}) {
  const router = useRouter();
  const [schedule, setSchedule] = useState(initialSchedule);
  const [currentDate, setCurrentDate] = useState<Date>(() => new Date());
  
  // Modal states
  const [bookingSlot, setBookingSlot] = useState<{ date: Date; slot: number } | null>(null);
  const [selectedClassId, setSelectedClassId] = useState("");
  const [cancelSession, setCancelSession] = useState<ScheduleItemData | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);

  // NO MANUAL F5 RULE
  useEffect(() => {
    setSchedule(initialSchedule);
  }, [initialSchedule]);

  const { startOfThisWeek } = useMemo(() => {
    return { startOfThisWeek: startOfWeek(currentDate, { weekStartsOn: 1 }) };
  }, [currentDate]);

  const handleRoomChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const roomId = e.target.value;
    if (roomId) {
      router.push(`/schedule?roomId=${roomId}`);
    } else {
      router.push(`/schedule`);
    }
  };

  const handleRequestBooking = async () => {
    if (!bookingSlot || !selectedClassId || !selectedRoomId) {
      toast.error("Vui lòng chọn đầy đủ thông tin");
      return;
    }

    setIsProcessing(true);
    const dateStr = toISODate(bookingSlot.date);
    const result = await requestRoomBooking({
      roomId: selectedRoomId,
      classId: selectedClassId,
      date: dateStr,
      slot: bookingSlot.slot,
    });
    setIsProcessing(false);

    if (result.success) {
      toast.success("Đăng ký phòng thành công! Đang chờ duyệt.");
      setBookingSlot(null);
      setSelectedClassId("");
      router.refresh();
    } else {
      toast.error(result.error || "Có lỗi xảy ra");
    }
  };

  const handleCancelRequest = async () => {
    if (!cancelSession) return;
    setIsProcessing(true);
    
    let result;
    if (cancelSession.status === "PENDING") {
      result = await rejectSessionRequest(cancelSession.id);
    } else if (cancelSession.status === "SCHEDULED") {
      if (!cancelReason.trim()) {
        toast.warning("Vui lòng nhập lý do huỷ ca.");
        setIsProcessing(false);
        return;
      }
      result = await requestCancelSession(cancelSession.id, cancelReason);
    }

    setIsProcessing(false);
    
    if (result && result.success) {
      toast.success(cancelSession.status === "PENDING" ? "Đã hủy yêu cầu đặt phòng!" : "Đã gửi yêu cầu huỷ ca!");
      setCancelSession(null);
      setCancelReason("");
      window.dispatchEvent(new Event("schedule-updated"));
      router.refresh();
    } else {
      toast.error(result?.error || "Có lỗi xảy ra");
    }
  };

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-8">
      <div className="mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900">Đăng Ký Phòng Học</h1>
          <p className="text-sm text-slate-500 mt-1">Lựa chọn phòng và ca trống để đăng ký lịch dạy</p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <select
            value={selectedRoomId}
            onChange={handleRoomChange}
            className="border border-slate-300 rounded-lg px-4 py-2 bg-white text-sm font-medium focus:ring-2 focus:ring-blue-500 outline-none shadow-sm"
          >
            <option value="">-- Chọn Phòng Để Xem Lịch --</option>
            {rooms.map((room) => (
              <option key={room.id} value={room.id}>
                {room.name} {room.feePerSession > 0 ? `(Phí: ${Number(room.feePerSession).toLocaleString('vi-VN')}đ)` : ""}
              </option>
            ))}
          </select>
        </div>
      </div>

      {!selectedRoomId ? (
        <div className="space-y-4">
          <h2 className="text-lg font-bold text-slate-800">Các Lớp Đang Chờ Duyệt</h2>
          {schedule.filter(s => s.status === "PENDING" && s.teacherId === teacherId).length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-xl p-16 text-center shadow-sm">
              <MapPin size={48} className="mx-auto text-slate-300 mb-4" />
              <h3 className="text-lg font-bold text-slate-700 mb-2">Vui lòng chọn phòng</h3>
              <p className="text-slate-500">Bạn cần chọn một phòng cụ thể ở menu trên để xem lịch trống và đăng ký.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {schedule.filter(s => s.status === "PENDING" && s.teacherId === teacherId).map(s => (
                <div key={s.id} className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm flex flex-col gap-2 relative transition-all hover:shadow-md">
                  <div className="font-extrabold text-blue-700 text-lg">{s.className}</div>
                  <div className="text-sm text-slate-600">
                    <strong>Phòng:</strong> {rooms.find(r => r.id === s.roomId)?.name || "Chưa rõ"}
                  </div>
                  <div className="text-sm text-slate-600">
                    <strong>Thời gian:</strong> {format(new Date(s.date), "dd/MM/yyyy")} - Ca {s.slot} ({SHIFTS.find(shift => shift.id === s.slot)?.time})
                  </div>
                  <button 
                    onClick={() => setCancelSession(s)} 
                    className="mt-3 w-full py-2 bg-rose-50 text-rose-600 font-bold rounded-lg hover:bg-rose-100 transition-colors flex items-center justify-center gap-2 border border-rose-200"
                  >
                    Hủy Yêu Cầu
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="w-full border border-slate-200 rounded-xl bg-white shadow-sm">
          {/* Toolbar - Dùng chung cho cả Desktop & Mobile */}
          <div className="p-3 border-b border-slate-200 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-slate-50/50">
            <div className="font-bold text-slate-700">
              Tuần: {format(startOfThisWeek, "dd/MM")} - {format(addDays(startOfThisWeek, 6), "dd/MM/yyyy")}
            </div>
            <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-lg p-1 shadow-sm w-full sm:w-auto justify-between sm:justify-start">
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

          {/* === DESKTOP VIEW === */}
          <div className="hidden lg:block w-full overflow-x-auto scrollbar-thin scrollbar-thumb-slate-300 scrollbar-track-slate-100">
            <div className="min-w-[900px]">
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
                        return toISODate(s.date) === dateISO && dayOfWeekMon1Sun7(s.date) === day.id && s.slot === shift.id;
                      });

                      const teacherBusySessions = teacherSchedule.filter((s) => {
                        return toISODate(s.date) === dateISO && dayOfWeekMon1Sun7(s.date) === day.id && s.slot === shift.id;
                      });

                      const session = cellSessions.length > 0 ? cellSessions[0] : null;
                      const teacherBusy = teacherBusySessions.length > 0 && (!session || session.id !== teacherBusySessions[0].id) ? teacherBusySessions[0] : null;

                      return (
                        <div
                          key={day.id}
                          className={`p-1.5 border-r border-slate-100 last:border-r-0 min-h-[80px] ${
                            isToday && !session ? "bg-blue-50/20" : ""
                          }`}
                        >
                          {!session ? (
                            !teacherBusy ? (
                              <button
                                onClick={() => setBookingSlot({ date: dateForCell, slot: shift.id })}
                                className="w-full h-full min-h-[60px] rounded border-2 border-dashed border-slate-200 hover:border-blue-400 hover:bg-blue-50/50 flex flex-col items-center justify-center gap-1 transition-colors text-slate-400 hover:text-blue-500 group"
                              >
                                <CalendarPlus size={16} className="opacity-0 group-hover:opacity-100 transition-opacity" />
                                <span className="text-[10px] font-semibold opacity-0 group-hover:opacity-100 transition-opacity">Đặt phòng</span>
                              </button>
                            ) : (
                              <div className="w-full h-full min-h-[60px] p-2 rounded-lg border border-rose-200 bg-rose-50 text-rose-500 flex flex-col justify-center items-center cursor-not-allowed">
                                <span className="text-[11px] font-bold text-center">Bạn bị trùng lịch ở {teacherBusy.roomName || "phòng khác"}</span>
                              </div>
                            )
                          ) : (
                            <div className="w-full h-full">
                              {session.teacherId !== teacherId ? (
                                <div className="w-full h-full min-h-[60px] p-2 rounded-lg border border-slate-200 bg-slate-100 text-slate-400 flex flex-col justify-center items-center cursor-not-allowed">
                                  <span className="text-[11px] font-bold">Đã có người đặt</span>
                                </div>
                              ) : (
                                <button
                                  onClick={() => {
                                    if (session.status === "PENDING" || (session.status === "SCHEDULED" && !session.isCancelRequested)) {
                                      setCancelSession(session);
                                      setCancelReason("");
                                    }
                                  }}
                                  className={`w-full h-full min-h-[60px] p-2 text-left rounded-lg border text-[11px] leading-snug shadow-sm flex flex-col gap-1 transition-all ${
                                    session.status === "PENDING"
                                      ? "bg-amber-100 border-amber-300 text-amber-900 hover:scale-[1.02] cursor-pointer"
                                      : session.isCancelRequested
                                      ? "bg-rose-50 border-rose-200 text-rose-800 cursor-default opacity-80"
                                      : "bg-blue-50 border-blue-200 text-blue-900 hover:scale-[1.02] cursor-pointer"
                                  }`}
                                >
                                  <div className="font-extrabold line-clamp-1">{session.className}</div>
                                  <div className="text-[10px] font-bold mt-auto">
                                    {session.status === "PENDING" ? (
                                      <span className="text-amber-600">Chờ duyệt (Nhấn hủy)</span>
                                    ) : session.isCancelRequested ? (
                                      <span className="text-rose-600 font-bold">Đang chờ duyệt huỷ ca</span>
                                    ) : (
                                      <span className="text-blue-600 font-bold flex flex-col">
                                        <span>Đã duyệt</span>
                                        <span className="text-[9px] text-blue-500 opacity-80">(Nhấn để xin huỷ)</span>
                                      </span>
                                    )}
                                  </div>
                                </button>
                              )}
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

          {/* === MOBILE VIEW === */}
          <div className="block lg:hidden flex flex-col divide-y divide-slate-200">
            {DAYS.map((day) => {
              const dateForCell = addDays(startOfThisWeek, day.id - 1);
              const dateISO = toISODate(dateForCell);
              const isToday = isSameDay(dateForCell, new Date());

              return (
                <div key={day.id} className={`flex flex-col ${isToday ? "bg-blue-50/20" : ""}`}>
                  {/* Header Ngày */}
                  <div className="p-3 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
                    <span className={`font-extrabold text-sm ${isToday ? "text-blue-700" : "text-slate-900"}`}>
                      {day.id <= 6 ? `Thứ ${day.id + 1}` : "Chủ Nhật"}
                    </span>
                    <span className={`text-xs font-semibold ${isToday ? "text-blue-500" : "text-slate-500"}`}>
                      {format(dateForCell, "dd/MM/yyyy")}
                    </span>
                  </div>

                  {/* Các Ca Học */}
                  <div className="flex flex-col divide-y divide-slate-100">
                    {SHIFTS.map((shift) => {
                      const cellSessions = schedule.filter((s) => {
                        return toISODate(s.date) === dateISO && dayOfWeekMon1Sun7(s.date) === day.id && s.slot === shift.id;
                      });

                      const teacherBusySessions = teacherSchedule.filter((s) => {
                        return toISODate(s.date) === dateISO && dayOfWeekMon1Sun7(s.date) === day.id && s.slot === shift.id;
                      });

                      const session = cellSessions.length > 0 ? cellSessions[0] : null;
                      const teacherBusy = teacherBusySessions.length > 0 && (!session || session.id !== teacherBusySessions[0].id) ? teacherBusySessions[0] : null;

                      return (
                        <div key={shift.id} className="p-3 flex gap-3 items-center">
                          {/* Thông tin Ca */}
                          <div className="w-16 shrink-0 flex flex-col pt-1">
                            <span className="font-bold text-slate-800 text-xs">{shift.label}</span>
                            <span className="text-[10px] text-slate-500 font-medium">{shift.time}</span>
                          </div>

                          {/* Lớp / Trạng thái */}
                          <div className="flex-1">
                            {!session ? (
                              !teacherBusy ? (
                                <button
                                  onClick={() => setBookingSlot({ date: dateForCell, slot: shift.id })}
                                  className="w-full h-[40px] rounded border border-dashed border-slate-300 hover:border-blue-400 hover:bg-blue-50/50 flex items-center justify-center gap-2 transition-colors text-slate-400 hover:text-blue-500"
                                >
                                  <CalendarPlus size={14} />
                                  <span className="text-xs font-semibold">Đặt phòng</span>
                                </button>
                              ) : (
                                <div className="w-full p-2 rounded-lg border border-rose-200 bg-rose-50 text-rose-500 flex flex-col justify-center items-center cursor-not-allowed text-xs font-bold text-center">
                                  Bạn bị trùng lịch ở {teacherBusy.roomName || "phòng khác"}
                                </div>
                              )
                            ) : (
                              <div className="w-full">
                                {session.teacherId !== teacherId ? (
                                  <div className="w-full p-2 rounded-lg border border-slate-200 bg-slate-100 text-slate-400 flex flex-col justify-center items-center cursor-not-allowed text-xs font-bold">
                                    Đã có người đặt
                                  </div>
                                ) : (
                                  <button
                                    onClick={() => {
                                      if (session.status === "PENDING" || (session.status === "SCHEDULED" && !session.isCancelRequested)) {
                                        setCancelSession(session);
                                        setCancelReason("");
                                      }
                                    }}
                                    className={`w-full text-left p-2.5 rounded-lg border text-xs shadow-sm flex flex-col gap-1 transition-all ${
                                      session.status === "PENDING"
                                        ? "bg-amber-100 border-amber-300 text-amber-900 active:scale-[0.98]"
                                        : session.isCancelRequested
                                        ? "bg-rose-50 border-rose-200 text-rose-800 cursor-default"
                                        : "bg-blue-50 border-blue-200 text-blue-900 active:scale-[0.98]"
                                    }`}
                                  >
                                    <div className="font-extrabold line-clamp-1">{session.className}</div>
                                    <div className="text-[10px] font-bold mt-1">
                                      {session.status === "PENDING" ? (
                                        <span className="text-amber-600">Chờ duyệt (Nhấn hủy)</span>
                                      ) : session.isCancelRequested ? (
                                        <span className="text-rose-600">Đang chờ duyệt huỷ ca</span>
                                      ) : (
                                        <span className="text-blue-600 flex items-center justify-between">
                                          <span>Đã duyệt</span>
                                          <span className="text-[9px] opacity-70">Nhấn để huỷ</span>
                                        </span>
                                      )}
                                    </div>
                                  </button>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Booking Modal */}
      {bookingSlot && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm px-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl">
            <h3 className="text-xl font-bold text-slate-900 mb-2">Đăng Ký Phòng</h3>
            <p className="text-sm text-slate-500 mb-6">Chọn lớp học bạn muốn dạy trong ca này.</p>
            
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 mb-4 space-y-2 text-sm">
              <div className="flex justify-between border-b pb-2">
                <span className="text-slate-500">Phòng:</span>
                <span className="font-bold text-slate-900">
                  {rooms.find(r => r.id === selectedRoomId)?.name} 
                  <span className="text-blue-600 ml-1">
                    ({Number(rooms.find(r => r.id === selectedRoomId)?.feePerSession || 0).toLocaleString('vi-VN')}đ/Ca)
                  </span>
                </span>
              </div>
              <div className="flex justify-between border-b pb-2">
                <span className="text-slate-500">Ngày:</span>
                <span className="font-bold text-slate-900">{format(bookingSlot.date, "dd/MM/yyyy")}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Ca học:</span>
                <span className="font-bold text-slate-900">Ca {bookingSlot.slot} ({SHIFTS.find(s => s.id === bookingSlot.slot)?.time})</span>
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
                disabled={isProcessing}
                className="flex-1 px-4 py-2.5 bg-slate-100 text-slate-700 font-bold rounded-xl hover:bg-slate-200 transition-colors"
              >
                Hủy
              </button>
              <button
                onClick={handleRequestBooking}
                disabled={isProcessing || !selectedClassId}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Xác nhận
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cancel Modal */}
      {cancelSession && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm px-4">
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
                disabled={isProcessing}
                className="flex-1 px-4 py-2.5 bg-slate-100 text-slate-700 font-bold rounded-xl hover:bg-slate-200 transition-colors"
              >
                Đóng
              </button>
              <button
                onClick={handleCancelRequest}
                disabled={isProcessing}
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
