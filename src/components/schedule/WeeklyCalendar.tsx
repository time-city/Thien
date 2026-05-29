"use client";

import { useMemo, useState } from "react";
import {
  addDays,
  addWeeks,
  endOfWeek,
  format,
  isSameDay,
  startOfWeek,
} from "date-fns";
import Link from "next/link";
import { MapPin, Trash2, CheckSquare, XSquare } from "lucide-react";
import { toast } from "sonner";
import { deleteBulkSchedules } from "@/actions/schedule";
import ConfirmModal from "@/components/common/ConfirmModal"; // Path chuẩn của ông

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
  date: Date;
  slot: number;
  status: string;
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
  
  // STATE MỚI CHO CHỨC NĂNG XÓA HÀNG LOẠT
  const [isSelectMode, setIsSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  
  // State xử lý Modal Confirm
  const [isDeleting, setIsDeleting] = useState(false);
  const [isConfirmDeleteOpen, setIsConfirmDeleteOpen] = useState(false);

  const { startOfThisWeek } = useMemo(() => {
    const startOfThisWeek = startOfWeek(currentDate, { weekStartsOn: 1 });
    return { startOfThisWeek };
  }, [currentDate]);

  const conflictCounts = useMemo(() => {
    const map = new Map<string, number>();

    for (const s of sessions) {
      const dateISO = toISODate(s.date);
      const room = `Phòng ${((s.slot + s.className.length) % 4) + 1}`;
      const key = `${dateISO}|${s.slot}|${room}`;
      map.set(key, (map.get(key) ?? 0) + 1);
    }

    return map;
  }, [sessions]);

  const weekTitle = useMemo(() => {
    const end = addDays(startOfThisWeek, 6);
    return `${format(startOfThisWeek, "dd/MM")} - ${format(end, "dd/MM/yyyy")}`;
  }, [startOfThisWeek]);

  const isAdmin = userRole === "SUPER_ADMIN";

  // LOGIC XỬ LÝ CHỌN / HỦY CHỌN
  const toggleSelectMode = () => {
    setIsSelectMode(!isSelectMode);
    setSelectedIds(new Set()); // Reset danh sách chọn khi tắt/bật
  };

  const toggleSelection = (id: string) => {
    setSelectedIds((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(id)) newSet.delete(id);
      else newSet.add(id);
      return newSet;
    });
  };
  
  // LOGIC XÓA LỊCH BẰNG MODAL CONFIRM
  const handleDeleteClick = () => {
    if (selectedIds.size === 0) return;
    setIsConfirmDeleteOpen(true); // Mở modal xác nhận
  };

  const executeDelete = async () => {
    setIsDeleting(true);
    const result = await deleteBulkSchedules(Array.from(selectedIds));
    setIsDeleting(false);
    setIsConfirmDeleteOpen(false); // Đóng modal

    if (result.success) {
      toast.success(`Đã xóa thành công ${selectedIds.size} ca học!`);
      setSelectedIds(new Set());
      setIsSelectMode(false);
    } else {
      toast.error(result.error || "Xóa thất bại!");
    }
  };

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto overflow-x-auto">
      <div className="mb-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <h1 className="text-xl font-extrabold tracking-tight text-slate-900 leading-none">
            Quản Lý Lịch Dạy
          </h1>
          <div className="text-[13px] font-bold text-slate-700 bg-slate-100 px-2 py-1 rounded-md">
            Tuần: {weekTitle}
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => setCurrentDate((d) => addWeeks(d, -1))}
            className="h-8 px-3 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-bold text-[13px]"
            disabled={isSelectMode}
          >
           Tuần trước
          </button>

          <button
            type="button"
            onClick={() => setCurrentDate(new Date())}
            className="h-8 px-3 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-bold text-[13px]"
            disabled={isSelectMode}
          >
            Hôm nay
          </button>

          <button
            type="button"
            onClick={() => setCurrentDate((d) => addWeeks(d, 1))}
            className="h-8 px-3 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-bold text-[13px]"
            disabled={isSelectMode}
          >
            Tuần sau
          </button>

          {/* CÁC NÚT DÀNH RIÊNG CHO CHẾ ĐỘ XÓA NỀN ADMIN */}
          {isAdmin && (
            <div className="flex items-center gap-2 ml-2 pl-2 border-l border-slate-200">
              {isSelectMode ? (
                <>
                  <button
                    onClick={toggleSelectMode}
                    className="h-8 px-3 flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold text-[13px] transition-colors"
                  >
                    <XSquare size={14} /> Hủy chọn
                  </button>
                  {selectedIds.size > 0 && (
                    <button
                      onClick={handleDeleteClick}
                      disabled={isDeleting}
                      className="h-8 px-3 flex items-center gap-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 disabled:bg-rose-400 text-white font-bold text-[13px] shadow-sm transition-colors"
                    >
                      <Trash2 size={14} /> 
                      {isDeleting ? "Đang xử lý..." : `Xóa (${selectedIds.size})`}
                    </button>
                  )}
                </>
              ) : (
                <button
                  onClick={toggleSelectMode}
                  className="h-8 px-3 flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white hover:bg-blue-50 hover:text-blue-600 hover:border-blue-200 text-slate-700 font-bold text-[13px] transition-colors"
                >
                  <CheckSquare size={14} /> Chọn nhiều
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* BẢNG LỊCH */}
      <div className={`min-w-[900px] border rounded-xl bg-white shadow-sm overflow-hidden transition-colors ${isSelectMode ? "border-blue-400 ring-2 ring-blue-100" : "border-slate-200"}`}>
        <div className="grid grid-cols-[140px_repeat(7,1fr)] bg-slate-50 border-b border-slate-200">
          <div className="p-3 border-r border-slate-200 flex items-center justify-center font-bold text-slate-600 text-[13px]">
            Ca học
          </div>

          {DAYS.map((d) => {
            const dateForCol = addDays(startOfThisWeek, d.id - 1);
            const isToday = isSameDay(dateForCol, new Date());
            return (
              <div
                key={d.id}
                className={`p-2 border-r border-slate-200 last:border-r-0 text-center flex flex-col justify-center items-center leading-tight gap-0.5 ${
                  isToday ? "bg-blue-50" : ""
                }`}
              >
                <div className="font-extrabold text-slate-900 text-[13px]">
                  {`Thứ ${d.id <= 6 ? d.id + 0 : "CN"}`}
                </div>
                <div className="text-[11px] text-slate-500 font-semibold">
                  {format(dateForCol, "dd/MM")}
                </div>
              </div>
            );
          })}
        </div>

        <div>
          {SHIFTS.map((shift) => (
            <div
              key={shift.id}
              className="grid grid-cols-[140px_repeat(7,1fr)] border-b border-slate-200 last:border-b-0"
            >
              <div className="p-2 border-r border-slate-200 bg-slate-50/50 flex flex-col justify-center items-center gap-0">
                <span className="font-bold text-slate-800 text-[13px] leading-tight">{shift.label}</span>
                <span className="text-[11px] text-slate-500 font-medium leading-tight">{shift.time}</span>
              </div>

              {DAYS.map((day) => {
                const dateForCell = addDays(startOfThisWeek, day.id - 1);
                const dateISO = toISODate(dateForCell);

                const cellSessions: CellSession[] = sessions
                  .filter((s) => {
                    const dISO = toISODate(s.date);
                    const sDayId = dayOfWeekMon1Sun7(s.date);
                    return dISO === dateISO && sDayId === day.id && s.slot === shift.id;
                  })
                  .map((s) => {
                    const room = `Phòng ${((s.slot + s.className.length) % 4) + 1}`;
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
                      teacherId: s.teacherId,
                    };
                  })
                  .sort((a, b) => a.className.localeCompare(b.className));

                return (
                  <div
                    key={day.id}
                    className="p-1.5 border-r last:border-r-0 border-slate-100 min-h-[70px]"
                  >
                    {cellSessions.length === 0 ? (
                      <div className="h-full min-h-[50px] rounded-lg bg-transparent border border-dashed border-slate-200" />
                    ) : (
                      <div className="flex flex-col gap-1.5">
                        {cellSessions.map((ev) => {
                          const isSelected = selectedIds.has(ev.id);
                          
                          // Style của thẻ dựa vào trạng thái Chọn / Lỗi đụng phòng / Bình thường
                          const cardStyle = `p-1.5 rounded border text-[11px] leading-tight shadow-sm flex flex-col gap-0.5 relative transition-all ${
                            isSelectMode ? "cursor-pointer hover:ring-2 hover:ring-blue-300" : "hover:shadow-md"
                          } ${
                            isSelected
                              ? "bg-blue-100 border-blue-500 ring-2 ring-blue-600 z-10"
                              : ev.attendanceConflict
                              ? "border-rose-500 bg-rose-50 text-rose-900"
                              : "border-blue-200 bg-blue-50 text-blue-700"
                          }`;

                          const content = (
                            <>
                              <div className="flex items-center justify-between">
                                <span className={`font-extrabold line-clamp-1 text-[12px] ${isSelected ? "text-blue-900" : ""}`}>
                                  {ev.className}
                                </span>
                              </div>
                              <span className={`font-semibold flex items-center gap-1 ${isSelected ? "text-blue-800" : ev.attendanceConflict ? "text-rose-700" : "text-blue-600"}`}>
                                <MapPin size={10} strokeWidth={2.5} /> {ev.room.replace(/^Phòng\s+/i, "")}
                              </span>
                              <span className={`border-t pt-0.5 mt-0.5 line-clamp-1 ${isSelected ? "border-blue-300 text-blue-800" : "border-blue-200/50 text-blue-600/80"}`}>
                                {ev.teacherFullName.replace(/^(Thầy|Cô)\s+/i, "")}
                              </span>
                            </>
                          );

                          // Nếu đang ở Mode Chọn -> Render Thẻ div có onClick
                          if (isSelectMode) {
                            return (
                              <div key={ev.id} onClick={() => toggleSelection(ev.id)} className={cardStyle}>
                                {content}
                              </div>
                            );
                          }

                          // Nếu ở Mode xem bình thường -> Render Thẻ Link để bấm qua Sơ đồ lớp
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

      {/* Modal Xác nhận Xóa Hàng Loạt */}
      <ConfirmModal
        isOpen={isConfirmDeleteOpen}
        onClose={() => !isDeleting && setIsConfirmDeleteOpen(false)}
        onConfirm={executeDelete}
        title="Xác nhận xóa lịch dạy"
        message={
          <>
            Bạn có chắc chắn muốn xóa <strong>{selectedIds.size} ca học</strong> đã chọn không? Hành động này sẽ xóa hoàn toàn dữ liệu điểm danh liên quan và không thể hoàn tác.
          </>
        }
        confirmText="Xóa dữ liệu"
        cancelText="Hủy bỏ"
        isDestructive={true}
        isLoading={isDeleting}
      />
    </div>
  );
}