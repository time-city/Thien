"use client";
import { useMemo, useState } from "react";
import {
  Phone,
  User,
  Users,
  ClipboardList,
  DollarSign,
  X,
  CreditCard
} from "lucide-react";

export type Attendance = "PRESENT" | "LATE" | "EXCUSED" | "UNEXCUSED";
export type Homework = "GOOD" | "DONE" | "NOT_DONE";

export type StudentEvaluationModalStudent = {
  id: string;
  fullName: string;
  className: string;
  seat?: string;
  phone?: string | null;
  parentName?: string | null;
  parentPhone?: string | null;
  remainingSessions?: number | null;
  feeStatus?: string | null; // Cột này chứa 'PAID', 'UNPAID', 'OVERDUE'
  attendance?: Attendance;
  homework?: Homework;
  note?: string | null;
};

function initialsFromName(fullName: string) {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? parts[parts.length - 1][0] : "";
  return (first + last).toUpperCase();
}

export default function StudentEvaluationModal({
  student,
  onClose,
  onSave,
}: {
  student: StudentEvaluationModalStudent;
  onClose: () => void;
  onSave: (
    id: string,
    updates: {
      attendance: Attendance;
      homework: Homework;
      note: string;
    }
  ) => Promise<void> | void;
}) {
  const [attendance, setAttendance] = useState<Attendance>(
    student.attendance ?? "PRESENT"
  );
  const [homework, setHomework] = useState<Homework>(
    student.homework ?? "DONE"
  );
  const [note, setNote] = useState<string>(student.note ?? "");
  const [isSaving, setIsSaving] = useState(false);

  const avatarInitials = useMemo(
    () => initialsFromName(student.fullName),
    [student.fullName]
  );

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onSave(student.id, { attendance, homework, note });
    } finally {
      setIsSaving(false);
    }
  };

  // Hệ thống màu cho học phí (Giữ nguyên từ DB Enum)
  const renderFeeStatus = (status: string | null | undefined) => {
    switch (status) {
      case "PAID":
        return <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold bg-emerald-100 text-emerald-700 border border-emerald-200"><Check size={12}/> Đã thanh toán</span>;
      case "UNPAID":
        return <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold bg-amber-100 text-amber-700 border border-amber-200"><AlertTriangle size={12}/> Chưa đóng</span>;
      case "OVERDUE":
        return <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold bg-rose-100 text-rose-700 border border-rose-200"><Ban size={12}/> Quá hạn</span>;
      default:
        return <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-bold bg-slate-100 text-slate-600 border border-slate-200">Không rõ</span>;
    }
  };

  const attendanceButton = {
    PRESENT: { label: "Có mặt", bg: "bg-emerald-600", border: "border-emerald-600" },
    LATE: { label: "Trễ", bg: "bg-amber-500", border: "border-amber-500" },
    EXCUSED: { label: "Phép", bg: "bg-orange-500", border: "border-orange-500" },
    UNEXCUSED: { label: "Vắng", bg: "bg-rose-600", border: "border-rose-600" },
  } as const;

  const homeworkButton = {
    GOOD: { label: "Tốt", bg: "bg-emerald-600", border: "border-emerald-600" },
    DONE: { label: "Đạt", bg: "bg-amber-500", border: "border-amber-500" },
    NOT_DONE: { label: "Không", bg: "bg-rose-600", border: "border-rose-600" },
  } as const;

  const DetailRow = ({
    icon: Icon,
    label,
    value,
  }: {
    icon: React.ComponentType<{ size?: number; className?: string }>;
    label: string;
    value?: string | null;
  }) => (
    <div className="flex items-start gap-2.5">
      <div className="mt-0.5 text-slate-400">
        <Icon size={14} />
      </div>
      <div>
        <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 leading-none mb-1">
          {label}
        </div>
        <div className="text-[13px] font-semibold text-slate-700 leading-tight">
          {value || <span className="text-slate-300">-</span>}
        </div>
      </div>
    </div>
  );

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="absolute inset-0 z-[-1]" onClick={onClose} />

      <div className="relative bg-white w-full max-w-[700px] rounded-2xl shadow-2xl overflow-hidden border border-slate-200 animate-in zoom-in-95 duration-200">
        
        {/* Header (Minimalist) */}
        <div className="flex items-center justify-between px-5 py-3.5 bg-slate-50 border-b border-slate-200">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-xs shadow-inner">
              {avatarInitials}
            </div>
            <div>
              <h2 className="text-[15px] font-bold text-slate-900 leading-tight">{student.fullName}</h2>
              <p className="text-[11px] font-semibold text-slate-500">{student.className}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full hover:bg-slate-200 text-slate-500 transition-colors flex items-center justify-center"
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="grid grid-cols-1 md:grid-cols-5 bg-white">
          
          {/* Left Column: Student Info (2/5 width) */}
          <div className="md:col-span-2 border-r border-slate-100 p-5 bg-slate-50/50 flex flex-col gap-6">
            
            <div className="flex flex-col gap-4">
              <DetailRow icon={Phone} label="SĐT học sinh" value={student.phone} />
              <DetailRow icon={User} label="Tên phụ huynh" value={student.parentName} />
              <DetailRow icon={Users} label="SĐT phụ huynh" value={student.parentPhone} />
            </div>

            {(student.remainingSessions != null || student.feeStatus) && (
              <div className="pt-5 border-t border-slate-200 flex flex-col gap-3">
                {student.remainingSessions != null && (
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5"><ClipboardList size={14}/> Buổi còn lại</span>
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-md ${student.remainingSessions <= 2 ? "bg-rose-100 text-rose-700" : "bg-slate-200 text-slate-700"}`}>
                      {student.remainingSessions} buổi
                    </span>
                  </div>
                )}
                
                {student.feeStatus && (
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5"><CreditCard size={14}/> Học phí</span>
                    {/* GỌI HÀM RENDER MÀU Ở ĐÂY */}
                    {renderFeeStatus(student.feeStatus)}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Right Column: Evaluation Form (3/5 width) */}
          <div className="md:col-span-3 p-5 flex flex-col gap-5">
            
            {/* Attendance Group */}
            <div>
              <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-2.5 block">
                Trạng thái Điểm danh
              </label>
              <div className="grid grid-cols-4 gap-2">
                {(Object.keys(attendanceButton) as Attendance[]).map((k) => {
                  const meta = attendanceButton[k];
                  const active = attendance === k;
                  return (
                    <button
                      key={k}
                      onClick={() => setAttendance(k)}
                      className={`h-9 rounded-lg border text-[13px] font-bold transition-all ${
                        active
                          ? `${meta.bg} ${meta.border} text-white shadow-sm`
                          : "bg-white border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50"
                      }`}
                    >
                      {meta.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Homework Group */}
            <div>
              <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-2.5 block">
                Bài tập về nhà
              </label>
              <div className="grid grid-cols-3 gap-2">
                {(Object.keys(homeworkButton) as Homework[]).map((k) => {
                  const meta = homeworkButton[k];
                  const active = homework === k;
                  return (
                    <button
                      key={k}
                      onClick={() => setHomework(k)}
                      className={`h-9 rounded-lg border text-[13px] font-bold transition-all ${
                        active
                          ? `${meta.bg} ${meta.border} text-white shadow-sm`
                          : "bg-white border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50"
                      }`}
                    >
                      {meta.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Note Textarea */}
            <div className="flex-1 flex flex-col">
              <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-2 block">
                Ghi chú (Tùy chọn)
              </label>
              <textarea
                className="flex-1 min-h-[80px] bg-white border border-slate-200 rounded-xl p-3 text-[13px] text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 resize-none transition-shadow"
                placeholder="Nhập nhận xét về buổi học..."
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end gap-3">
          <button
            onClick={onClose}
            disabled={isSaving}
            className="px-4 py-2 text-[13px] font-bold text-slate-600 hover:bg-slate-200 bg-slate-100 rounded-lg transition-colors disabled:opacity-50"
          >
            Hủy
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="min-w-[120px] h-9 bg-blue-600 text-white font-bold text-[13px] rounded-lg transition-all hover:bg-blue-700 shadow-sm flex items-center justify-center disabled:opacity-70 disabled:cursor-not-allowed"
          >
            {isSaving ? "Đang lưu..." : "Lưu Đánh Giá"}
          </button>
        </div>

      </div>
    </div>
  );
}

// Icon helper cho feeStatus
import { Check, AlertTriangle, Ban } from "lucide-react";

