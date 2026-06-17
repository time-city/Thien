"use client";

import { useMemo, useState, useOptimistic, startTransition } from "react";
import {
  addDays,
  addWeeks,
  format,
  isSameDay,
  startOfWeek,
} from "date-fns";
import Link from "next/link";
import { MapPin, Trash2, CheckSquare, XSquare, ChevronLeft, ChevronRight, Loader2, XCircle, CheckCircle } from "lucide-react";
import { toast } from "sonner";
import { deleteBulkSchedules, deleteSchedule } from "@/actions/schedule";
import { approveSessionRequest, rejectSessionRequest } from "@/actions/mutations";
import { useConfirm } from "@/hooks/useconfirm"; 
import { useRouter } from "next/navigation";

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

type Role = "SUPER_ADMIN" | "TEACHER";

type ScheduleSession = {
  id: string;
  classId: string;
  className: string;
  teacherId: string;
  teacherFullName: string;
  roomName: string | null;
  date: Date;
  slot: number;
  status: string;
  isAttendanceSubmitted?: boolean;
  pending?: boolean;
};

type WeeklyCalendarProps = {
  userRole: Role;
  sessions: ScheduleSession[];
};

type CellSession = {
  id: string;
  classId: string;
  className: string;
  teacherFullName: string;
  room: string;
  dateISO: string;
  slot: number;
  attendanceConflict: boolean;
  teacherId: string;
  isCompleted?: boolean;
  isPending?: boolean;
};

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

export default function WeeklyCalendar({ userRole, sessions }: WeeklyCalendarProps) {
  const [currentDate, setCurrentDate] = useState<Date>(() => new Date());
  const [isSelectMode, setIsSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const { confirm } = useConfirm();
  const [isDeleting, setIsDeleting] = useState(false); 
  const router = useRouter();

  const [deleteModalState, setDeleteModalState] = useState<{
    isOpen: boolean;
    type: "SINGLE" | "BULK";
    sessionId?: string;
  }>({ isOpen: false, type: "SINGLE" });

  // Optimistic UI State
  const [optimisticSessions, addOptimisticSession] = useOptimistic(
    sessions as ScheduleSession[],
    (state, action: { type: "DELETE_MANY" | "APPROVE" | "REJECT"; payload: string[] | string }) => {
      switch (action.type) {
        case "DELETE_MANY":
          return state.filter(s => !(action.payload as string[]).includes(s.id));
        case "APPROVE":
          return state.map(s => s.id === action.payload ? { ...s, status: "COMPLETED", pending: true } : s);
        case "REJECT":
          return state.map(s => s.id === action.payload ? { ...s, status: "REJECTED", pending: true } : s);
        default:
          return state;
      }
    }
  );

  // Approve Modal State
  const [selectedPendingSession, setSelectedPendingSession] = useState<CellSession | null>(null);

  const { startOfThisWeek } = useMemo(() => {
    return { startOfThisWeek: startOfWeek(currentDate, { weekStartsOn: 1 }) };
  }, [currentDate]);

  const conflictCounts = useMemo(() => {
    const map = new Map<string, number>();
    for (const s of optimisticSessions) {
      if (s.status === "CANCELLED" || s.status === "REJECTED") continue;
      const dateISO = toISODate(s.date);
      const room = s.roomName || "Chưa xếp phòng";
      const key = `${dateISO}|${s.slot}|${room}`;
      map.set(key, (map.get(key) ?? 0) + 1);
    }
    return map;
  }, [optimisticSessions]);

  const weekTitle = useMemo(() => {
    const end = addDays(startOfThisWeek, 6);
    return `${format(startOfThisWeek, "dd/MM")} - ${format(end, "dd/MM/yyyy")}`;
  }, [startOfThisWeek]);

  const isAdmin = userRole === "SUPER_ADMIN";

  const toggleSelectMode = () => {
    setIsSelectMode(!isSelectMode);
    setSelectedIds(new Set()); 
  };

  const toggleSelection = (id: string) => {
    setSelectedIds((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(id)) newSet.delete(id);
      else newSet.add(id);
      return newSet;
    });
  };
  
  const handleDeleteClick = () => {
    if (selectedIds.size === 0) return;
    setDeleteModalState({ isOpen: true, type: "BULK" });
  };

  const executeDelete = async (mode: "SINGLE" | "FOLLOWING") => {
    setIsDeleting(true);
    startTransition(async () => {
      try {
        let result;
        if (deleteModalState.type === "BULK") {
          const idsToDelete = Array.from(selectedIds);
          if (mode === "SINGLE") {
            addOptimisticSession({ type: "DELETE_MANY", payload: idsToDelete });
          }
          result = await deleteBulkSchedules(idsToDelete, mode);
          if (result.success) {
            toast.success(`Đã xóa thành công ${idsToDelete.length} ca học!`);
            setSelectedIds(new Set());
            setIsSelectMode(false);
          }
        } else if (deleteModalState.type === "SINGLE" && deleteModalState.sessionId) {
          if (mode === "SINGLE") {
            addOptimisticSession({ type: "DELETE_MANY", payload: [deleteModalState.sessionId] });
          }
          result = await deleteSchedule(deleteModalState.sessionId, mode);
          if (result.success) {
            toast.success(`Đã xóa thành công ca học!`);
          }
        }

        if (result?.success) {
          window.dispatchEvent(new Event("schedule-updated"));
          router.refresh();
        } else {
          toast.error(result?.error || "Xóa thất bại!");
        }
      } finally {
        setIsDeleting(false);
        setDeleteModalState({ isOpen: false, type: "SINGLE" });
      }
    });
  };

  const handleApprove = () => {
    if (!selectedPendingSession) return;
    const currentSelected = selectedPendingSession;
    setSelectedPendingSession(null);

    startTransition(async () => {
      addOptimisticSession({ type: "APPROVE", payload: currentSelected.id });

      const result = await approveSessionRequest(currentSelected.id);

      if (result.success) {
        if ("deductedFee" in result && result.deductedFee) {
          toast.success(`Đã duyệt! Đã thu phí phòng: ${result.deductedFee.toLocaleString("vi-VN")}đ`);
        } else {
          toast.success("Đã duyệt lịch học!");
        }
        window.dispatchEvent(new Event("schedule-updated"));
        router.refresh();
      } else {
        toast.error(result.error || "Có lỗi xảy ra");
      }
    });
  };

  const handleReject = () => {
    if (!selectedPendingSession) return;
    const currentSelected = selectedPendingSession;
    setSelectedPendingSession(null);

    startTransition(async () => {
      addOptimisticSession({ type: "REJECT", payload: currentSelected.id });

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

  return (
    <div className="p-3 md:p-6 w-full mx-auto">
      {/* HEADER SECTION */}
      <div className="mb-6 flex flex-col xl:flex-row xl:items-center justify-between gap-4">
        
        {/* Title & Week Info */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <h1 className="text-xl md:text-2xl font-extrabold tracking-tight text-slate-900 leading-none">
            Quản Lý Lịch Dạy
          </h1>
          <div className="inline-flex items-center gap-1.5 text-sm font-bold text-slate-700 bg-white border border-slate-200 px-3 py-1.5 rounded-lg shadow-sm">
            <span className="text-slate-400">Tuần:</span> {weekTitle}
          </div>
        </div>

        {/* Controls */}
        <div className="flex flex-wrap items-center gap-2">
          
          {/* Navigation */}
          <div className="flex items-center bg-white border border-slate-200 rounded-lg p-1 shadow-sm">
             <button
              onClick={() => setCurrentDate((d) => addWeeks(d, -1))}
              disabled={isSelectMode}
              className="p-1.5 rounded hover:bg-slate-100 text-slate-600 disabled:opacity-50 transition-colors"
              title="Tuần trước"
            >
             <ChevronLeft size={18} />
            </button>
            <button
              onClick={() => setCurrentDate(new Date())}
              disabled={isSelectMode}
              className="px-3 py-1.5 text-[13px] font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50 transition-colors"
            >
              Hôm nay
            </button>
             <button
              onClick={() => setCurrentDate((d) => addWeeks(d, 1))}
              disabled={isSelectMode}
              className="p-1.5 rounded hover:bg-slate-100 text-slate-600 disabled:opacity-50 transition-colors"
               title="Tuần sau"
            >
              <ChevronRight size={18} />
            </button>
          </div>

          {/* Admin Actions */}
          {isAdmin && (
            <div className="flex items-center gap-2">
              {isSelectMode ? (
                <>
                  <button
                    onClick={toggleSelectMode}
                    className="h-[34px] px-3 flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold text-[13px] transition-colors"
                  >
                    <XSquare size={14} /> <span className="hidden sm:inline">Hủy chọn</span>
                  </button>
                  {selectedIds.size > 0 && (
                    <button
                      onClick={handleDeleteClick}
                      disabled={isDeleting}
                      className="h-[34px] px-3 flex items-center gap-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 disabled:bg-rose-400 text-white font-bold text-[13px] shadow-sm transition-colors"
                    >
                      <Trash2 size={14} /> 
                      {isDeleting ? "Đang xử lý..." : <span className="hidden sm:inline">{`Xóa (${selectedIds.size})`}</span>}
                      {!isDeleting && <span className="sm:hidden">{selectedIds.size}</span>}
                    </button>
                  )}
                </>
              ) : (
                <button
                  onClick={toggleSelectMode}
                  className="h-[34px] px-3 flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white hover:bg-blue-50 hover:text-blue-600 hover:border-blue-200 text-slate-700 font-bold text-[13px] shadow-sm transition-colors"
                >
                  <CheckSquare size={14} /> <span className="hidden sm:inline">Chọn nhiều</span>
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* CALENDAR GRID CONTAINER 
        - Desktop: Bảng ngang (hidden trên mobile)
        - Mobile: Dạng danh sách dọc (hidden trên desktop)
      */}
      <div className={`w-full border rounded-xl bg-white shadow-sm transition-colors ${isSelectMode ? "border-blue-400 ring-2 ring-blue-100" : "border-slate-200"}`}>
        
        {/* === DESKTOP VIEW === */}
        <div className="hidden lg:block w-full overflow-x-auto scrollbar-thin scrollbar-thumb-slate-300 scrollbar-track-slate-100">
          <div className="min-w-[900px]">
          
          {/* HEADER ROW (Các ngày trong tuần) */}
          <div className="grid grid-cols-[80px_repeat(7,1fr)] sm:grid-cols-[100px_repeat(7,1fr)] bg-slate-50 border-b border-slate-200">
            <div className="p-2 sm:p-3 border-r border-slate-200 flex items-center justify-center font-bold text-slate-500 text-[11px] sm:text-[13px] uppercase tracking-wider">
              Ca học
            </div>

            {DAYS.map((d) => {
              const dateForCol = addDays(startOfThisWeek, d.id - 1);
              const isToday = isSameDay(dateForCol, new Date());
              return (
                <div
                  key={d.id}
                  className={`p-2 border-r border-slate-200 last:border-r-0 text-center flex flex-col justify-center items-center leading-tight gap-0.5 ${
                    isToday ? "bg-blue-50/50" : ""
                  }`}
                >
                  <div className={`font-extrabold text-[12px] sm:text-[13px] ${isToday ? "text-blue-700" : "text-slate-900"}`}>
                    {d.id <= 6 ? `Thứ ${d.id + 1}` : "Chủ Nhật"}
                  </div>
                  <div className={`text-[11px] font-semibold ${isToday ? "text-blue-500" : "text-slate-500"}`}>
                    {format(dateForCol, "dd/MM")}
                  </div>
                </div>
              );
            })}
          </div>

          {/* BODY ROWS (Các ca học) */}
          <div>
            {SHIFTS.map((shift) => (
              <div
                key={shift.id}
                className="grid grid-cols-[80px_repeat(7,1fr)] sm:grid-cols-[100px_repeat(7,1fr)] border-b border-slate-200 last:border-b-0"
              >
                {/* Cột thời gian của ca học */}
                <div className="p-2 border-r border-slate-200 bg-slate-50/30 flex flex-col justify-center items-center gap-0.5">
                  <span className="font-bold text-slate-800 text-[12px] sm:text-[13px] leading-tight">{shift.label}</span>
                  <span className="text-[10px] sm:text-[11px] text-slate-500 font-medium leading-tight text-center">{shift.time}</span>
                </div>

                {/* Các ô (Cells) chứa lớp học tương ứng với ngày và ca */}
                {DAYS.map((day) => {
                  const dateForCell = addDays(startOfThisWeek, day.id - 1);
                  const dateISO = toISODate(dateForCell);
                  const isToday = isSameDay(dateForCell, new Date());

                  const cellSessions: CellSession[] = sessions
                    .filter((s) => {
                      const dISO = toISODate(s.date);
                      const sDayId = dayOfWeekMon1Sun7(s.date);
                      return dISO === dateISO && sDayId === day.id && s.slot === shift.id;
                    })
                    .map((s) => {
                      const room = s.roomName || "Chưa xếp phòng";
                      const key = `${dateISO}|${s.slot}|${room}`;
                      const attendanceConflict = (conflictCounts.get(key) ?? 0) > 1;

                      return {
                        id: s.id,
                        classId: s.classId,
                        className: s.className,
                        teacherFullName: s.teacherFullName,
                        room,
                        dateISO,
                        slot: s.slot,
                        attendanceConflict,
                        isCompleted: Boolean((s as any).isAttendanceSubmitted) || s.status === "COMPLETED",
                        isPending: s.pending || s.status === "PENDING",
                        teacherId: s.teacherId,
                      };
                    })
                    .sort((a, b) => a.className.localeCompare(b.className));

                  return (
                    <div
                      key={day.id}
                      className={`p-1.5 border-r border-slate-100 last:border-r-0 min-h-[80px] ${isToday ? "bg-blue-50/20" : ""}`}
                    >
                      {cellSessions.length === 0 ? (
                        // Render vùng trống đứt nét mờ nhẹ khi không có lớp
                        <div className="h-full min-h-[60px] rounded border border-transparent hover:border-slate-200 hover:bg-slate-50/50 transition-colors" />
                      ) : (
                        <div className="flex flex-col gap-1.5 h-full">
                          {cellSessions.map((ev) => {
                            const isSelected = selectedIds.has(ev.id);
                            
                            const cardStyle = `p-1.5 sm:p-2 rounded-lg border text-[10px] sm:text-[11px] leading-snug shadow-sm flex flex-col gap-0.5 relative transition-all duration-200 ${
                              isSelectMode ? "cursor-pointer hover:scale-[1.02]" : "hover:shadow-md hover:-translate-y-0.5"
                            } ${
                              isSelected
                                ? "bg-blue-600 border-blue-600 text-white z-10 shadow-blue-500/30"
                                : ev.isPending
                                ? "bg-amber-100 border-amber-300 text-amber-900"
                                : ev.isCompleted
                                ? "border-slate-100 bg-slate-50 text-slate-400"
                                : ev.attendanceConflict
                                ? "border-rose-300 bg-rose-50 text-rose-900"
                                : "border-slate-200 bg-white text-slate-700"
                            }`;

                            const content = (
                              <>
                                <div className="flex items-start justify-between gap-1">
                                  <span className={`font-extrabold line-clamp-2 ${isSelected ? "text-white" : ev.isCompleted ? "text-slate-400" : "text-slate-900"}`}>
                                    {ev.className}
                                  </span>
                                  {ev.isPending && <Loader2 size={12} className="animate-spin text-slate-400 shrink-0" />}
                                  {isAdmin && !isSelectMode && !ev.isPending && !ev.isCompleted && (
                                    <button
                                      onClick={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        setDeleteModalState({ isOpen: true, type: "SINGLE", sessionId: ev.id });
                                      }}
                                      className="p-1 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-md transition-colors shrink-0"
                                      title="Xóa ca học"
                                    >
                                      <Trash2 size={12} />
                                    </button>
                                  )}
                                </div>
                                <span className={`font-semibold flex items-center gap-1 mt-0.5 ${isSelected ? "text-blue-100" : ev.isCompleted ? "text-slate-400" : ev.attendanceConflict ? "text-rose-600" : "text-blue-600"}`}>
                                  <MapPin size={10} strokeWidth={2.5} className="shrink-0" /> {ev.room}
                                </span>
                                <span className={`border-t pt-1 mt-1 line-clamp-1 font-medium ${isSelected ? "border-blue-400/50 text-blue-100" : ev.isCompleted ? "border-transparent text-slate-400" : "border-slate-100 text-slate-500"}`}>
                                  {ev.teacherFullName}
                                </span>
                              </>
                            );

                            if (isSelectMode) {
                              return (
                                <div key={ev.id} onClick={() => toggleSelection(ev.id)} className={`${cardStyle} ${ev.isPending ? "opacity-50 pointer-events-none" : ""}`}>
                                  {content}
                                </div>
                              );
                            }

                            if (isAdmin && ev.isPending) {
                              return (
                                <button disabled={ev.isPending} key={ev.id} onClick={() => setSelectedPendingSession(ev)} className={`${cardStyle} text-left ${ev.isPending ? "opacity-50 pointer-events-none" : ""}`}>
                                  {content}
                                </button>
                              );
                            }

                            if (ev.classId === "freelance" || !ev.classId) {
                              return (
                                <div key={ev.id} className={`${cardStyle} cursor-default`}>
                                  {content}
                                </div>
                              );
                            }

                            const href = `/ta/?classId=${encodeURIComponent(ev.classId)}&sessionId=${encodeURIComponent(ev.id)}&date=${encodeURIComponent(ev.dateISO)}`;
                            return (
                              <Link key={ev.id} href={href} className={cardStyle}>
                                {content}
                              </Link>
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
                    const cellSessions: CellSession[] = sessions
                      .filter((s) => {
                        const dISO = toISODate(s.date);
                        const sDayId = dayOfWeekMon1Sun7(s.date);
                        return dISO === dateISO && sDayId === day.id && s.slot === shift.id;
                      })
                      .map((s) => {
                        const room = s.roomName || "Chưa xếp phòng";
                        const key = `${dateISO}|${s.slot}|${room}`;
                        const attendanceConflict = (conflictCounts.get(key) ?? 0) > 1;
                        return {
                          id: s.id,
                          classId: s.classId,
                          className: s.className,
                          teacherFullName: s.teacherFullName,
                          room,
                          dateISO,
                          slot: s.slot,
                          attendanceConflict,
                          isCompleted: Boolean((s as any).isAttendanceSubmitted) || s.status === "COMPLETED",
                          isPending: s.status === "PENDING",
                          teacherId: s.teacherId,
                        };
                      })
                      .sort((a, b) => a.className.localeCompare(b.className));

                    if (cellSessions.length === 0) {
                      return null; // Có thể ẩn ca trống trên mobile cho gọn, hoặc hiện "Trống"
                    }

                    return (
                      <div key={shift.id} className="p-3 flex gap-3">
                        {/* Thông tin Ca */}
                        <div className="w-16 shrink-0 flex flex-col pt-1">
                          <span className="font-bold text-slate-800 text-xs">{shift.label}</span>
                          <span className="text-[10px] text-slate-500 font-medium">{shift.time}</span>
                        </div>

                        {/* Danh sách lớp */}
                        <div className="flex-1 flex flex-col gap-2">
                          {cellSessions.map((ev) => {
                            const isSelected = selectedIds.has(ev.id);
                            const cardStyle = `p-2.5 rounded-lg border text-xs shadow-sm flex flex-col gap-1 relative transition-all duration-200 ${
                              isSelectMode ? "cursor-pointer active:scale-[0.98]" : "active:scale-[0.98]"
                            } ${
                              isSelected
                                ? "bg-blue-600 border-blue-600 text-white z-10 shadow-blue-500/30"
                                : ev.isPending
                                ? "bg-amber-100 border-amber-300 text-amber-900"
                                : ev.isCompleted
                                ? "border-slate-100 bg-slate-50 text-slate-400"
                                : ev.attendanceConflict
                                ? "border-rose-300 bg-rose-50 text-rose-900"
                                : "border-slate-200 bg-white text-slate-700"
                            }`;

                            const content = (
                              <>
                                <div className="flex items-start justify-between gap-1">
                                  <span className={`font-extrabold line-clamp-2 ${isSelected ? "text-white" : ev.isCompleted ? "text-slate-400" : "text-slate-900"}`}>
                                    {ev.className}
                                  </span>
                                  {isAdmin && !isSelectMode && !ev.isPending && !ev.isCompleted && (
                                    <button
                                      onClick={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        setDeleteModalState({ isOpen: true, type: "SINGLE", sessionId: ev.id });
                                      }}
                                      className="p-1 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-md transition-colors shrink-0"
                                      title="Xóa ca học"
                                    >
                                      <Trash2 size={12} />
                                    </button>
                                  )}
                                </div>
                                <span className={`font-semibold flex items-center gap-1 mt-0.5 ${isSelected ? "text-blue-100" : ev.isCompleted ? "text-slate-400" : ev.attendanceConflict ? "text-rose-600" : "text-blue-600"}`}>
                                  <MapPin size={12} strokeWidth={2.5} className="shrink-0" /> {ev.room}
                                </span>
                                <span className={`border-t pt-1.5 mt-1 line-clamp-1 font-medium ${isSelected ? "border-blue-400/50 text-blue-100" : ev.isCompleted ? "border-transparent text-slate-400" : "border-slate-100 text-slate-500"}`}>
                                  {ev.teacherFullName}
                                </span>
                              </>
                            );

                            if (isSelectMode) {
                              return (
                                <div key={ev.id} onClick={() => toggleSelection(ev.id)} className={`${cardStyle} ${ev.isPending ? "opacity-50 pointer-events-none" : ""}`}>
                                  {content}
                                </div>
                              );
                            }

                            if (isAdmin && ev.isPending) {
                              return (
                                <button disabled={ev.isPending} key={ev.id} onClick={() => setSelectedPendingSession(ev)} className={`${cardStyle} text-left ${ev.isPending ? "opacity-50 pointer-events-none" : ""}`}>
                                  {content}
                                </button>
                              );
                            }

                            if (ev.classId === "freelance" || !ev.classId) {
                              return (
                                <div key={ev.id} className={`${cardStyle} cursor-default`}>
                                  {content}
                                </div>
                              );
                            }

                            const href = `/ta/?classId=${encodeURIComponent(ev.classId)}&sessionId=${encodeURIComponent(ev.id)}&date=${encodeURIComponent(ev.dateISO)}`;
                            return (
                              <Link key={ev.id} href={href} className={cardStyle}>
                                {content}
                              </Link>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                  {/* Nếu không có ca học nào trong ngày thì báo trống */}
                  {SHIFTS.every(shift => {
                    return sessions.filter((s) => {
                      const dISO = toISODate(s.date);
                      const sDayId = dayOfWeekMon1Sun7(s.date);
                      return dISO === dateISO && sDayId === day.id && s.slot === shift.id;
                    }).length === 0;
                  }) && (
                    <div className="p-4 text-center text-sm text-slate-400 font-medium">
                      Không có lịch dạy
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Approve/Reject Modal */}
      {selectedPendingSession && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm px-4" onClick={() => setSelectedPendingSession(null)}>
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-xl font-bold text-slate-900 mb-2">Duyệt Ca Học</h3>
            <p className="text-sm text-slate-500 mb-6">Xác nhận duyệt hoặc từ chối đăng ký này.</p>
            
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 mb-6 space-y-2 text-sm">
              <div className="flex justify-between border-b pb-2">
                <span className="text-slate-500">Giáo viên:</span>
                <span className="font-bold text-slate-900">{selectedPendingSession.teacherFullName}</span>
              </div>
              <div className="flex justify-between border-b pb-2">
                <span className="text-slate-500">Lớp học:</span>
                <span className="font-bold text-slate-900">{selectedPendingSession.className}</span>
              </div>
              <div className="flex justify-between border-b pb-2">
                <span className="text-slate-500">Ngày:</span>
                <span className="font-bold text-slate-900">{format(new Date(selectedPendingSession.dateISO), "dd/MM/yyyy")}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Ca học:</span>
                <span className="font-bold text-slate-900">Ca {selectedPendingSession.slot} ({SHIFTS.find(s => s.id === selectedPendingSession.slot)?.time})</span>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setSelectedPendingSession(null)}
                className="flex-1 px-4 py-2 bg-slate-100 text-slate-700 font-bold rounded-xl hover:bg-slate-200 transition-colors"
              >
                Đóng
              </button>
              <button
                onClick={handleReject}
                className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2 bg-rose-100 text-rose-700 font-bold rounded-xl hover:bg-rose-200 transition-colors"
              >
                <XCircle size={16} /> Từ chối
              </button>
              <button
                onClick={handleApprove}
                className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 transition-colors"
              >
                <CheckCircle size={16} /> Duyệt
              </button>
            </div>
          </div>
        </div>
      )}
      {/* === MODAL XÓA LỊCH === */}
      {deleteModalState.isOpen && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm" onClick={() => setDeleteModalState({ isOpen: false, type: "SINGLE" })}>
          <div className="bg-white w-[95%] max-w-md rounded-2xl shadow-xl border border-slate-200 p-5" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-extrabold text-slate-800">
                {deleteModalState.type === "BULK" ? `Xóa ${selectedIds.size} ca học` : "Xóa ca học"}
              </h2>
              <button
                onClick={() => setDeleteModalState({ isOpen: false, type: "SINGLE" })}
                className="p-1.5 bg-slate-100 hover:bg-slate-200 rounded-full text-slate-600 transition-colors"
              >
                <XSquare size={18} />
              </button>
            </div>
            
            <p className="text-sm text-slate-600 mb-6 leading-relaxed">
              Bạn có muốn xóa thêm các ca học lặp lại tiếp theo của cùng lớp học và giáo viên này không?
            </p>

            <div className="flex flex-col gap-3">
              <button
                disabled={isDeleting}
                onClick={() => executeDelete("SINGLE")}
                className="w-full flex flex-col items-center justify-center gap-1 py-3 px-4 rounded-xl border-2 border-slate-200 hover:border-blue-500 hover:bg-blue-50 transition-colors text-slate-700 hover:text-blue-700 font-bold disabled:opacity-50 relative"
              >
                <span>Chỉ xóa {deleteModalState.type === "BULK" ? "các ca đã chọn" : "ca này"}</span>
                <span className="text-xs font-normal opacity-80">Không ảnh hưởng đến lịch trong tương lai</span>
                {isDeleting && <Loader2 size={16} className="animate-spin absolute right-4" />}
              </button>
              
              <button
                disabled={isDeleting}
                onClick={() => executeDelete("FOLLOWING")}
                className="w-full flex flex-col items-center justify-center gap-1 py-3 px-4 rounded-xl border-2 border-slate-200 hover:border-rose-500 hover:bg-rose-50 transition-colors text-slate-700 hover:text-rose-700 font-bold disabled:opacity-50 relative"
              >
                <span>Xóa {deleteModalState.type === "BULK" ? "các ca này" : "ca này"} và các ca tiếp theo</span>
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