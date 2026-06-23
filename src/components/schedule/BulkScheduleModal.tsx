"use client";

import { useState, useEffect } from "react";
import { Plus, X, Calendar as CalendarIcon, BookOpen, UserCircle, Building2, Trash2 } from "lucide-react";
import { createBulkSchedule } from "@/actions/schedule";
import { toast } from "sonner";
import { useConfirm } from "@/hooks/useconfirm";

// Bổ sung kiểu dữ liệu cho chính xác với dữ liệu Lớp học trả về từ DB
type ClassItem = {
  id: string;
  name: string;
  teachers?: { teacherId: string; teacherName: string }[];
};

type BulkScheduleModalProps = {
  classes: ClassItem[];
  teachers?: { id: string; fullName: string }[];
  rooms?: { id: string; name: string }[];
  defaultData?: { roomId?: string; startTime?: string; endTime?: string; day?: number; date?: string };
  isOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  showTriggerButton?: boolean;
};

type SchedulePattern = {
  day: number;
  startTimeString: string;
  endTimeString: string;
};

export default function BulkScheduleModal({
  classes,
  rooms = [],
  teachers = [],
  defaultData,
  isOpen: controlledIsOpen,
  onOpenChange,
  showTriggerButton = true
}: BulkScheduleModalProps) {
  const [internalIsOpen, setInternalIsOpen] = useState(false);
  const isOpen = controlledIsOpen !== undefined ? controlledIsOpen : internalIsOpen;
  const setIsOpen = (open: boolean) => {
    if (onOpenChange) onOpenChange(open);
    setInternalIsOpen(open);
  };
  const [isLoading, setIsLoading] = useState(false);



  const [classId, setClassId] = useState(classes[0]?.id || "");
  const [roomId, setRoomId] = useState(defaultData?.roomId || "");
  const [startDate, setStartDate] = useState(new Date().toISOString().split("T")[0]);
  const [endDate, setEndDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 28);
    return d.toISOString().split("T")[0];
  });

  const [selectedPatterns, setSelectedPatterns] = useState<SchedulePattern[]>([]);

  // Current input for adding a pattern
  const [currentDay, setCurrentDay] = useState<number>(1);
  const [currentStartTime, setCurrentStartTime] = useState("08:00");
  const [currentEndTime, setCurrentEndTime] = useState("10:00");

  const { confirm } = useConfirm();

  // TỰ ĐỘNG TÌM GIÁO VIÊN VÀ MÔN HỌC DỰA VÀO LỚP ĐANG CHỌN
  const isFreelance = classId === "freelance";
  const selectedClassObj = classes.find(c => c.id === classId);
  const [freelanceTeacherId, setFreelanceTeacherId] = useState("");
  const [selectedClassTeacherId, setSelectedClassTeacherId] = useState("");

  // Tự động gán giáo viên đầu tiên khi chọn lớp
  useEffect(() => {
    if (!isFreelance && selectedClassObj?.teachers?.length) {
      setSelectedClassTeacherId(selectedClassObj.teachers[0].teacherId);
    } else {
      setSelectedClassTeacherId("");
    }
  }, [classId, selectedClassObj]);

  // Đồng bộ thông tin từ defaultData khi kéo thả tạo lịch
  useEffect(() => {
    if (defaultData && isOpen) {
      if (defaultData.roomId) {
        setRoomId(defaultData.roomId);
      }
      if (defaultData.date) {
        setStartDate(defaultData.date);
        const d = new Date(defaultData.date);
        d.setDate(d.getDate() + 28);
        setEndDate(d.toISOString().split("T")[0]);
      }
      if (defaultData.day !== undefined && defaultData.startTime && defaultData.endTime) {
        setCurrentDay(defaultData.day);
        setCurrentStartTime(defaultData.startTime);
        setCurrentEndTime(defaultData.endTime);
        setSelectedPatterns([
          {
            day: defaultData.day,
            startTimeString: defaultData.startTime,
            endTimeString: defaultData.endTime,
          }
        ]);
      }
    }
  }, [defaultData, isOpen]);

  const assignedTeacherId = isFreelance ? freelanceTeacherId : selectedClassTeacherId;
  const assignedTeacherName = isFreelance
    ? (teachers?.find(t => t.id === freelanceTeacherId)?.fullName || "Chưa chọn giáo viên")
    : (selectedClassObj?.teachers?.find(t => t.teacherId === selectedClassTeacherId)?.teacherName || "Chưa phân công");

  const handleAddPattern = () => {
    if (currentStartTime >= currentEndTime) {
      toast.error("Giờ kết thúc phải lớn hơn giờ bắt đầu");
      return;
    }

    // Check overlap
    const hasOverlap = selectedPatterns.some(p => {
      if (p.day !== currentDay) return false;
      return currentStartTime < p.endTimeString && currentEndTime > p.startTimeString;
    });

    if (hasOverlap) {
      toast.error("Khung giờ này bị trùng với lịch đã chọn!");
      return;
    }

    setSelectedPatterns([...selectedPatterns, { day: currentDay, startTimeString: currentStartTime, endTimeString: currentEndTime }]);
  };

  const handleRemovePattern = (index: number) => {
    setSelectedPatterns(selectedPatterns.filter((_, i) => i !== index));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!roomId) {
      toast.warning("Vui lòng chọn phòng học!");
      return;
    }
    if (selectedPatterns.length === 0) {
      toast.warning("Vui lòng thêm ít nhất 1 khung giờ!");
      return;
    }

    if (new Date(startDate) > new Date(endDate)) {
      toast.error("Ngày kết thúc phải sau hoặc bằng ngày bắt đầu!");
      return;
    }

    if (!assignedTeacherId) {
      toast.error("Lớp học này chưa được phân công giáo viên! Vui lòng vào Cấu hình đào tạo để phân công.");
      return;
    }

    confirm({
      title: "Xác nhận tạo lịch học",
      message: (
        <>
          Bạn đang chuẩn bị tạo lịch {isFreelance ? "thuê phòng tự do" : <>cho lớp <strong>{selectedClassObj?.name}</strong></>} do giáo viên <strong>{assignedTeacherName}</strong> phụ trách tại phòng <strong>{rooms.find(r => r.id === roomId)?.name || "Chưa rõ"}</strong>.<br /><br />
          Tần suất: <strong>{selectedPatterns.length} buổi/tuần</strong>, từ ngày <strong>{new Date(startDate).toLocaleDateString('vi-VN')}</strong> đến ngày <strong>{new Date(endDate).toLocaleDateString('vi-VN')}</strong>.<br /><br />
          Bạn có chắc chắn muốn tiếp tục?
        </>
      ),
      confirmText: "Tạo dữ liệu",
      cancelText: "Quay lại",
      isDestructive: false,
      onConfirm: async () => {
        setIsLoading(true);
        const result = await createBulkSchedule({
          classId: isFreelance ? null : classId,
          teacherId: assignedTeacherId, // Lấy ID giáo viên đã được trích xuất tự động
          roomId,
          patterns: selectedPatterns,
          startDate,
          endDate,
        });

        setIsLoading(false);

        if (result.success) {
          toast.success("Tạo lịch dạy định kỳ thành công!");
          setIsOpen(false);
          setSelectedPatterns([]);
          window.location.reload(); // Ép reload để refetch data lịch mới nhất
        } else {
          toast.error(result.error || "Đã xảy ra lỗi khi tạo lịch.");
        }
      }
    });
  };

  const daysHeader = [
    { label: "Thứ 2", val: 1 }, { label: "Thứ 3", val: 2 }, { label: "Thứ 4", val: 3 },
    { label: "Thứ 5", val: 4 }, { label: "Thứ 6", val: 5 }, { label: "Thứ 7", val: 6 }, { label: "Chủ Nhật", val: 0 }
  ];

  return (
    <>
      {showTriggerButton && (
        <button
          onClick={() => setIsOpen(true)}
          className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl font-bold text-sm shadow-sm flex items-center gap-2 transition-all"
        >
          <Plus size={18} />
          Tạo lịch dạy định kỳ
        </button>
      )}

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 animate-in fade-in duration-200" onClick={() => setIsOpen(false)}>
          <div className="bg-white w-full max-w-2xl rounded-2xl shadow-xl flex flex-col overflow-hidden max-h-[95vh]" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center p-5 border-b border-slate-100 bg-slate-50">
              <h2 className="text-lg font-extrabold text-slate-800">Tạo Lịch Dạy Định Kỳ</h2>
              <button
                onClick={() => setIsOpen(false)}
                className="p-1.5 bg-slate-200 hover:bg-slate-300 rounded-full text-slate-600 transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-6">

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                    <BookOpen size={14} /> Chọn Lớp Học
                  </label>
                  <select
                    value={classId}
                    onChange={(e) => {
                      setClassId(e.target.value);
                      if (e.target.value !== "freelance") setFreelanceTeacherId("");
                    }}
                    className="w-full h-11 px-3 border border-slate-200 rounded-xl bg-slate-50 text-sm font-semibold focus:ring-2 focus:ring-blue-100 outline-none cursor-pointer"
                    required
                  >
                    <option value="freelance" className="font-bold text-blue-700 bg-blue-50">🌟 Lớp Tự Do (Thuê phòng)</option>
                    {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>

                {/* Ô GIÁO VIÊN TRỞ THÀNH READ-ONLY */}
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                    <UserCircle size={14} /> Giáo viên phụ trách
                  </label>
                  {isFreelance ? (
                    <select
                      value={freelanceTeacherId}
                      onChange={(e) => setFreelanceTeacherId(e.target.value)}
                      className="w-full h-11 px-3 border border-slate-200 rounded-xl bg-slate-50 text-sm font-semibold focus:ring-2 focus:ring-blue-100 outline-none cursor-pointer"
                      required
                    >
                      <option value="">-- Chọn Giáo Viên --</option>
                      {teachers?.map(t => <option key={t.id} value={t.id}>{t.fullName}</option>)}
                    </select>
                  ) : (selectedClassObj?.teachers && selectedClassObj.teachers.length > 1) ? (
                    <select
                      value={selectedClassTeacherId}
                      onChange={(e) => setSelectedClassTeacherId(e.target.value)}
                      className="w-full h-11 px-3 border border-slate-200 rounded-xl bg-blue-50 text-blue-700 border-blue-200 text-sm font-semibold focus:ring-2 focus:ring-blue-100 outline-none cursor-pointer"
                      required
                    >
                      {selectedClassObj.teachers.map(t => (
                        <option key={t.teacherId} value={t.teacherId}>{t.teacherName}</option>
                      ))}
                    </select>
                  ) : (
                    <div className={`w-full h-11 px-3 border border-slate-200 rounded-xl flex items-center text-sm font-semibold ${assignedTeacherId ? "bg-blue-50 text-blue-700 border-blue-200" : "bg-rose-50 text-rose-600 border-rose-200"}`}>
                      {assignedTeacherName}
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                  <Building2 size={14} /> Phòng Học <span className="text-rose-500">*</span>
                </label>
                {defaultData?.roomId ? (
                  <div className="w-full h-11 px-3 border border-blue-200 rounded-xl bg-blue-50 text-blue-700 flex items-center text-sm font-semibold shadow-sm">
                    {rooms.find(r => r.id === roomId)?.name || "Chưa xác định"}
                  </div>
                ) : (
                  <select
                    value={roomId}
                    onChange={(e) => setRoomId(e.target.value)}
                    className="w-full h-11 px-3 border border-slate-200 rounded-xl bg-slate-50 text-sm font-semibold focus:ring-2 focus:ring-blue-100 outline-none cursor-pointer"
                    required
                  >
                    <option value="">-- Vui lòng chọn phòng học --</option>
                    {rooms.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                  </select>
                )}
              </div>

              {/* LỊCH HỌC TRONG TUẦN */}
              <div className="space-y-3">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                  <CalendarIcon size={14} /> Khung giờ trong tuần
                </label>

                <div className="border border-slate-200 rounded-xl p-4 bg-slate-50 space-y-4">
                  <div className="flex flex-col sm:flex-row gap-3 items-end">
                    <div className="w-full sm:w-1/3">
                      <label className="text-[11px] font-bold text-slate-500 uppercase mb-1 block">Thứ</label>
                      <select
                        value={currentDay}
                        onChange={(e) => setCurrentDay(Number(e.target.value))}
                        className="w-full h-10 px-3 border border-slate-300 rounded-lg text-sm"
                      >
                        {daysHeader.map(d => (
                          <option key={d.val} value={d.val}>{d.label}</option>
                        ))}
                      </select>
                    </div>
                    <div className="w-full sm:w-1/3">
                      <label className="text-[11px] font-bold text-slate-500 uppercase mb-1 block">Từ giờ</label>
                      <input
                        type="time"
                        value={currentStartTime}
                        onChange={(e) => setCurrentStartTime(e.target.value)}
                        className="w-full h-10 px-3 border border-slate-300 rounded-lg text-sm"
                      />
                    </div>
                    <div className="w-full sm:w-1/3">
                      <label className="text-[11px] font-bold text-slate-500 uppercase mb-1 block">Đến giờ</label>
                      <input
                        type="time"
                        value={currentEndTime}
                        onChange={(e) => setCurrentEndTime(e.target.value)}
                        className="w-full h-10 px-3 border border-slate-300 rounded-lg text-sm"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={handleAddPattern}
                      className="h-10 px-4 bg-blue-100 text-blue-700 hover:bg-blue-200 rounded-lg font-bold text-sm shrink-0 whitespace-nowrap"
                    >
                      Thêm
                    </button>
                  </div>

                  {selectedPatterns.length > 0 && (
                    <div className="flex flex-wrap gap-2 pt-2">
                      {selectedPatterns.map((p, idx) => (
                        <div key={idx} className="bg-white border border-blue-200 text-blue-800 text-xs font-bold px-3 py-1.5 rounded-lg flex items-center gap-2 shadow-sm">
                          <span>{daysHeader.find(d => d.val === p.day)?.label}: {p.startTimeString} - {p.endTimeString}</span>
                          <button
                            type="button"
                            onClick={() => handleRemovePattern(idx)}
                            className="text-slate-400 hover:text-rose-500 transition-colors"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                  {selectedPatterns.length === 0 && (
                    <div className="text-sm text-slate-400 italic py-2">
                      Chưa có khung giờ nào được chọn.
                    </div>
                  )}
                </div>
              </div>

              {/* Form Cấu Hình Thời Gian */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                    <CalendarIcon size={14} /> Bắt đầu từ ngày
                  </label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full h-11 px-3 border border-slate-200 rounded-xl bg-slate-50 text-sm font-semibold focus:ring-2 focus:ring-blue-100 outline-none cursor-pointer"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                    <CalendarIcon size={14} /> Đến ngày (Kết thúc)
                  </label>
                  <input
                    type="date"
                    value={endDate}
                    min={startDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full h-11 px-3 border border-slate-200 rounded-xl bg-slate-50 text-sm font-semibold focus:ring-2 focus:ring-blue-100 outline-none cursor-pointer"
                    required
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full h-12 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-xl font-bold text-base transition-all shadow-sm flex items-center justify-center gap-2"
              >
                {isLoading ? "Đang xử lý..." : `Xác Nhận Tạo Lịch (${selectedPatterns.length} buổi/tuần)`}
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}