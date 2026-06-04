"use client";

import { useState } from "react";
import { X, ArrowRightLeft } from "lucide-react";
import { transferStudentClass } from "@/actions/mutations";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { ClassData } from "@/actions/queries";

export default function TransferClassModal({
  isOpen,
  onClose,
  studentId,
  studentName,
  oldClassId,
  oldClassName,
  availableClasses,
}: {
  isOpen: boolean;
  onClose: () => void;
  studentId: string;
  studentName: string;
  oldClassId: string;
  oldClassName: string;
  availableClasses: ClassData[];
}) {
  const router = useRouter();
  const [newClassId, setNewClassId] = useState("");
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newClassId) {
      toast.warning("Vui lòng chọn lớp muốn chuyển đến");
      return;
    }
    if (newClassId === oldClassId) {
      toast.warning("Lớp mới phải khác lớp hiện tại");
      return;
    }

    setLoading(true);
    const res = await transferStudentClass(studentId, oldClassId, newClassId);
    setLoading(false);

    if (res.success) {
      toast.success("Đổi lớp thành công!");
      router.refresh();
      onClose();
    } else {
      toast.error((res as any).error || "Lỗi khi đổi lớp");
    }
  };

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-md rounded-2xl shadow-xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
        <div className="flex justify-between items-center p-5 border-b border-slate-100 bg-slate-50">
          <h2 className="text-lg font-extrabold text-slate-800 flex items-center gap-2">
            <ArrowRightLeft size={20} className="text-blue-600" /> Chuyển Lớp
          </h2>
          <button onClick={onClose} className="p-1.5 bg-slate-200 hover:bg-slate-300 rounded-full text-slate-600 transition-colors">
            <X size={18} />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-500 uppercase">Học sinh</label>
            <div className="font-semibold text-slate-800 bg-slate-50 p-2 rounded-lg border border-slate-200">
              {studentName}
            </div>
          </div>
          
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-500 uppercase">Từ lớp (Hiện tại)</label>
            <div className="font-semibold text-rose-600 bg-rose-50 p-2 rounded-lg border border-rose-200">
              {oldClassName}
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-500 uppercase">Đến lớp (Mới) *</label>
            <select
              value={newClassId}
              onChange={(e) => setNewClassId(e.target.value)}
              className="w-full h-11 px-3 border border-slate-200 rounded-xl bg-slate-50 text-sm font-semibold focus:ring-2 focus:ring-blue-100 outline-none transition-all cursor-pointer"
              required
            >
              <option value="">-- Chọn lớp học mới --</option>
              {availableClasses.filter(c => c.id !== oldClassId).map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 text-xs text-blue-700 mt-2 leading-relaxed">
            Hệ thống sẽ tự động tính toán số buổi đã học ở lớp cũ, và cấp số buổi còn lại tương ứng cho lớp mới. Phiếu học cũ sẽ được bảo lưu.
          </div>

          <div className="mt-6 pt-4 flex justify-end gap-3 border-t border-slate-100">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-bold text-slate-600 hover:bg-slate-200 bg-slate-100 rounded-lg transition-colors">
              Hủy
            </button>
            <button type="submit" disabled={loading} className="px-5 py-2 min-w-[100px] text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm transition-all disabled:opacity-70 flex justify-center items-center">
              {loading ? "Đang xử lý..." : "Xác Nhận Đổi Lớp"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
