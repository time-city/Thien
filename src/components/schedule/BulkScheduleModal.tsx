"use client";

import { useState, useEffect } from "react";
import { Plus, X, Calendar as CalendarIcon, Users, Check, Ban, BookOpen, UserCircle, Building2 } from "lucide-react";
import { createBulkSchedule, getOccupiedPatterns } from "@/actions/schedule";
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
};

type SchedulePattern = {
  day: number;
  slot: number;
};

export default function BulkScheduleModal({ classes, rooms = [], teachers = [] }: BulkScheduleModalProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const [classId, setClassId] = useState(classes[0]?.id || "");
  const [roomId, setRoomId] = useState("");
  const [startDate, setStartDate] = useState(new Date().toISOString().split("T")[0]);
  const [endDate, setEndDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 28);
    return d.toISOString().split("T")[0];
  });
  
  const [selectedPatterns, setSelectedPatterns] = useState<SchedulePattern[]>([]);
  
  const [occupiedSlots, setOccupiedSlots] = useState<Set<string>>(new Set());
  const [isScanning, setIsScanning] = useState(false);
  
  const { confirm } = useConfirm();

  // TỰ ĐỘNG TÌM GIÁO VIÊN VÀ MÔN HỌC DỰA VÀO LỚP ĐANG CHỌN
  const isFreelance = classId === "freelance";
  const selectedClassObj = classes.find(c => c.id === classId);
  const [freelanceTeacherId, setFreelanceTeacherId] = useState("");
  
  const assignedTeacherId = isFreelance ? freelanceTeacherId : (selectedClassObj?.teachers?.[0]?.teacherId || null);
  const assignedTeacherName = isFreelance 
    ? (teachers?.find(t => t.id === freelanceTeacherId)?.fullName || "Chưa chọn giáo viên")
    : (selectedClassObj?.teachers?.[0]?.teacherName || "Chưa phân công");

  // Quét lịch trống
  useEffect(() => {
    if (!isOpen || !roomId) return;

    let isMounted = true;
    const scanSchedule = async () => {
      setIsScanning(true);
      const res = await getOccupiedPatterns(startDate, endDate, assignedTeacherId, roomId);
      
      if (isMounted) {
        const newSet = new Set<string>();
        res.forEach(item => newSet.add(`${item.day}-${item.slot}`));
        setOccupiedSlots(newSet);
        
        setSelectedPatterns(prev => prev.filter(p => !newSet.has(`${p.day}-${p.slot}`)));
        setIsScanning(false);
      }
    };

    const timer = setTimeout(() => scanSchedule(), 300);
    return () => {
      isMounted = false;
      clearTimeout(timer);
    };
  }, [startDate, endDate, isOpen, assignedTeacherId, roomId]);

  const handleToggleCell = (day: number, slot: number) => {
    setSelectedPatterns((prev) => {
      const exists = prev.find((p) => p.day === day && p.slot === slot);
      if (exists) {
        return prev.filter((p) => !(p.day === day && p.slot === slot));
      }
      return [...prev, { day, slot }];
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!roomId) {
      toast.warning("Vui lòng chọn phòng học!");
      return;
    }
    if (selectedPatterns.length === 0) {
      toast.warning("Vui lòng click chọn ít nhất 1 ô lịch học trên bảng lưới!");
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
          Bạn đang chuẩn bị tạo lịch {isFreelance ? "thuê phòng tự do" : <>cho lớp <strong>{selectedClassObj?.name}</strong></>} do giáo viên <strong>{assignedTeacherName}</strong> phụ trách tại phòng <strong>{rooms.find(r => r.id === roomId)?.name || "Chưa rõ"}</strong>.<br/><br/>
          Tần suất: <strong>{selectedPatterns.length} ca/tuần</strong>, từ ngày <strong>{new Date(startDate).toLocaleDateString('vi-VN')}</strong> đến ngày <strong>{new Date(endDate).toLocaleDateString('vi-VN')}</strong>.<br/><br/>
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
    { label: "T2", val: 1 }, { label: "T3", val: 2 }, { label: "T4", val: 3 },
    { label: "T5", val: 4 }, { label: "T6", val: 5 }, { label: "T7", val: 6 }, { label: "CN", val: 0 }
  ];
  const slots = [1, 2, 3, 4, 5, 6];

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl font-bold text-sm shadow-sm flex items-center gap-2 transition-all"
      >
        <Plus size={18} />
        Tạo lịch dạy định kỳ
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-2xl rounded-2xl shadow-xl flex flex-col overflow-hidden max-h-[95vh]">
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
                    <BookOpen size={14}/> Chọn Lớp Học
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
                    <UserCircle size={14}/> Giáo viên phụ trách
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
                  ) : (
                    <div className={`w-full h-11 px-3 border border-slate-200 rounded-xl flex items-center text-sm font-semibold ${assignedTeacherId ? "bg-blue-50 text-blue-700 border-blue-200" : "bg-rose-50 text-rose-600 border-rose-200"}`}>
                       {assignedTeacherName}
                    </div>
                  )}
                </div>
              </div>
              
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                  <Building2 size={14}/> Chọn Phòng Học <span className="text-rose-500">*</span>
                </label>
                <select 
                  value={roomId}
                  onChange={(e) => setRoomId(e.target.value)}
                  className="w-full h-11 px-3 border border-slate-200 rounded-xl bg-slate-50 text-sm font-semibold focus:ring-2 focus:ring-blue-100 outline-none cursor-pointer"
                  required
                >
                  <option value="">-- Vui lòng chọn phòng học --</option>
                  {rooms.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                </select>
              </div>

              {/* BẢNG LƯỚI CHỌN LỊCH TRỰC QUAN */}
              <div className="space-y-3 relative">
                <div className="flex justify-between items-end">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                    Click vào các ô dưới đây để chọn lịch học:
                  </label>
                  {isScanning && <span className="text-xs font-bold text-blue-500 animate-pulse">Đang quét phòng trống...</span>}
                </div>

                <div className={`border border-slate-200 rounded-xl overflow-hidden bg-slate-50 transition-opacity ${isScanning ? "opacity-50 pointer-events-none" : ""}`}>
                  <div className="grid grid-cols-8 border-b border-slate-200 bg-slate-100/50">
                    <div className="p-1 sm:p-2 text-center text-[10px] sm:text-xs font-bold text-slate-400 border-r border-slate-200">Ca</div>
                    {daysHeader.map(day => (
                      <div key={day.val} className="p-1 sm:p-2 text-center text-[10px] sm:text-xs font-bold text-slate-600 border-r border-slate-200 last:border-r-0">
                        {day.label}
                      </div>
                    ))}
                  </div>
                  
                  {slots.map(slot => (
                    <div key={slot} className="grid grid-cols-8 border-b border-slate-200 last:border-b-0">
                      <div className="p-1 sm:p-2 flex items-center justify-center text-[10px] sm:text-xs font-bold text-slate-500 border-r border-slate-200 bg-slate-50">
                        Ca {slot}
                      </div>
                      {daysHeader.map(day => {
                        const isOccupied = occupiedSlots.has(`${day.val}-${slot}`);
                        const isSelected = selectedPatterns.some(p => p.day === day.val && p.slot === slot);
                        
                        return (
                          <button
                            key={`${day.val}-${slot}`}
                            type="button"
                            disabled={isOccupied}
                            onClick={() => handleToggleCell(day.val, slot)}
                            title={isOccupied ? "Ca này đã có lớp học khác xí chỗ" : "Click để chọn"}
                            className={`h-10 border-r border-slate-200 last:border-r-0 flex items-center justify-center transition-colors ${
                              isOccupied ? "bg-slate-200/60 cursor-not-allowed text-slate-300" :
                              isSelected ? "bg-blue-600 text-white shadow-inner" : "bg-white hover:bg-blue-50"
                            }`}
                          >
                            {isOccupied ? <Ban size={14} /> : isSelected ? <Check size={16} strokeWidth={3} /> : null}
                          </button>
                        );
                      })}
                    </div>
                  ))}
                </div>
              </div>

              {/* Form Cấu Hình Thời Gian */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                    <CalendarIcon size={14}/> Bắt đầu từ ngày
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
                    <CalendarIcon size={14}/> Đến ngày (Kết thúc)
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
                disabled={isLoading || isScanning}
                className="w-full h-12 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-xl font-bold text-base transition-all shadow-sm flex items-center justify-center gap-2"
              >
                {isLoading ? "Đang xử lý..." : `Xác Nhận Tạo Lịch (${selectedPatterns.length} ca/tuần)`}
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}