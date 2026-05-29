"use client";

import { useState, useEffect } from "react";
import { Plus, X, Calendar as CalendarIcon, Users, Check, Ban } from "lucide-react";
import { createBulkSchedule, getOccupiedPatterns } from "@/actions/schedule";
import { toast } from "sonner";
import ConfirmModal from "@/components/common/ConfirmModal"; // Đảm bảo import chuẩn path

type BulkScheduleModalProps = {
  classes: { id: string; name: string }[];
  teachers: { id: string; fullName: string | null }[];
};

type SchedulePattern = {
  day: number;
  slot: number;
};

export default function BulkScheduleModal({ classes, teachers }: BulkScheduleModalProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const [classId, setClassId] = useState(classes[0]?.id || "");
  const [teacherId, setTeacherId] = useState(teachers[0]?.id || "");
  const [startDate, setStartDate] = useState(new Date().toISOString().split("T")[0]);
  const [weeks, setWeeks] = useState(4);
  
  const [selectedPatterns, setSelectedPatterns] = useState<SchedulePattern[]>([]);
  
  // STATE MỚI: Chứa các ô đã bị chiếm và trạng thái đang quét
  const [occupiedSlots, setOccupiedSlots] = useState<Set<string>>(new Set());
  const [isScanning, setIsScanning] = useState(false);
  
  // STATE MỚI: Dành cho Modal Xác nhận
  const [isConfirmCreateOpen, setIsConfirmCreateOpen] = useState(false);

  // EFFECT QUÉT LỊCH: Chạy mỗi khi đổi Ngày bắt đầu hoặc Số tuần
  useEffect(() => {
    if (!isOpen) return;

    let isMounted = true;
    const scanSchedule = async () => {
      setIsScanning(true);
      const res = await getOccupiedPatterns(startDate, weeks);
      
      if (isMounted) {
        const newSet = new Set<string>();
        res.forEach(item => newSet.add(`${item.day}-${item.slot}`));
        setOccupiedSlots(newSet);
        
        // Nếu ô đang chọn đột nhiên bị chiếm (do đổi ngày), thì tự động gỡ chọn
        setSelectedPatterns(prev => prev.filter(p => !newSet.has(`${p.day}-${p.slot}`)));
        setIsScanning(false);
      }
    };

    // Dùng setTimeout để chống spam API (Debounce)
    const timer = setTimeout(() => scanSchedule(), 300);
    return () => {
      isMounted = false;
      clearTimeout(timer);
    };
  }, [startDate, weeks, isOpen]);

  const handleToggleCell = (day: number, slot: number) => {
    setSelectedPatterns((prev) => {
      const exists = prev.find((p) => p.day === day && p.slot === slot);
      if (exists) {
        return prev.filter((p) => !(p.day === day && p.slot === slot));
      }
      return [...prev, { day, slot }];
    });
  };

  // NHỊP 1: Chặn form và mở Modal Xác nhận
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedPatterns.length === 0) {
      toast.warning("Vui lòng click chọn ít nhất 1 ô lịch học trên bảng lưới!");
      return;
    }
    setIsConfirmCreateOpen(true);
  };

  // NHỊP 2: Thực thi API khi người dùng bấm "Xác nhận tạo" trong Modal
  const executeCreate = async () => {
    setIsLoading(true);
    const result = await createBulkSchedule({
      classId,
      teacherId,
      patterns: selectedPatterns,
      startDate,
      weeks,
    });
    
    setIsLoading(false);
    setIsConfirmCreateOpen(false); // Đóng popup xác nhận
    
    if (result.success) {
      toast.success("Tạo lịch dạy định kỳ thành công!");
      setIsOpen(false); // Đóng luôn form lớn
      setSelectedPatterns([]); 
    } else {
      toast.error(result.error || "Đã xảy ra lỗi khi tạo lịch.");
    }
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
                    <Users size={14}/> Lớp Học
                  </label>
                  <select 
                    value={classId}
                    onChange={(e) => setClassId(e.target.value)}
                    className="w-full h-11 px-3 border border-slate-200 rounded-xl bg-slate-50 text-sm font-semibold focus:ring-2 focus:ring-blue-100 outline-none"
                    required
                  >
                    {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                    <Users size={14}/> Giáo viên
                  </label>
                  <select 
                    value={teacherId}
                    onChange={(e) => setTeacherId(e.target.value)}
                    className="w-full h-11 px-3 border border-slate-200 rounded-xl bg-slate-50 text-sm font-semibold focus:ring-2 focus:ring-blue-100 outline-none"
                    required
                  >
                    {teachers.map(t => <option key={t.id} value={t.id}>{t.fullName}</option>)}
                  </select>
                </div>
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
                    <div className="p-2 text-center text-xs font-bold text-slate-400 border-r border-slate-200">Ca</div>
                    {daysHeader.map(day => (
                      <div key={day.val} className="p-2 text-center text-xs font-bold text-slate-600 border-r border-slate-200 last:border-r-0">
                        {day.label}
                      </div>
                    ))}
                  </div>
                  
                  {slots.map(slot => (
                    <div key={slot} className="grid grid-cols-8 border-b border-slate-200 last:border-b-0">
                      <div className="p-2 flex items-center justify-center text-xs font-bold text-slate-500 border-r border-slate-200 bg-slate-50">
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
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Lặp lại trong (Số tuần)</label>
                  <input 
                    type="number"
                    min="1" max="52"
                    value={weeks}
                    onChange={(e) => setWeeks(Number(e.target.value))}
                    className="w-full h-11 px-3 border border-slate-200 rounded-xl bg-slate-50 text-sm font-semibold focus:ring-2 focus:ring-blue-100 outline-none"
                    required
                  />
                </div>
              </div>

              <button 
                type="submit" 
                disabled={isScanning} // Đổi sang chỉ chặn khi đang quét, load thì form bị chặn bởi Modal rồi
                className="w-full h-12 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-xl font-bold text-base transition-all shadow-sm flex items-center justify-center gap-2"
              >
                Xác Nhận Tạo Lịch ({selectedPatterns.length} ca/tuần)
              </button>
            </form>
          </div>
        </div>
      )}

      {/* MODAL XÁC NHẬN TẠO LỊCH (Nằm độc lập ở ngoài để đè lên Form) */}
      <ConfirmModal
        isOpen={isConfirmCreateOpen}
        onClose={() => !isLoading && setIsConfirmCreateOpen(false)}
        onConfirm={executeCreate}
        title="Xác nhận tạo lịch học"
        message={
          <>
            Bạn đang chuẩn bị tạo lịch cho <strong>{selectedPatterns.length} ca/tuần</strong>, lặp lại trong <strong>{weeks} tuần</strong>.<br/><br/>
            Hệ thống sẽ tự động tạo ra tổng cộng <strong>{selectedPatterns.length * weeks} ca học</strong>. Bạn có chắc chắn muốn tiếp tục?
          </>
        }
        confirmText="Tạo dữ liệu"
        cancelText="Quay lại"
        isDestructive={false}
        isLoading={isLoading}
      />
    </>
  );
}