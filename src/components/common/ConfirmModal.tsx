"use client";

import { useConfirmStore } from "@/components/store/useConfirmStore"; // Import store của ông vào đây
import { AlertTriangle, X, Loader2 } from "lucide-react";

export default function GlobalConfirmModal() {
  // Lấy toàn bộ state và hàm từ Zustand ra thay vì dùng Props
  const {
    isOpen,
    title,
    message,
    confirmText,
    cancelText,
    isDestructive,
    onConfirm,
    closeConfirm,
    isLoading,
    setLoading,
  } = useConfirmStore();

  // Nếu không open thì không render gì cả
  if (!isOpen) return null;

  // Hàm xử lý confirm: Đóng modal ngay lập tức để thực hiện Optimistic UI / xử lý ngầm
  const handleConfirm = () => {
    closeConfirm();
    onConfirm();
  };

  // Giữ nguyên 100% giao diện UI của ông
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden flex flex-col">
        <div className="p-6">
          <div className="flex justify-between items-start mb-4">
            <div
              className={`p-3 rounded-full ${
                isDestructive ? "bg-rose-100 text-rose-600" : "bg-blue-100 text-blue-600"
              }`}
            >
              <AlertTriangle size={24} />
            </div>
            <button
              onClick={() => !isLoading && closeConfirm()}
              disabled={isLoading}
              className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors disabled:opacity-50"
            >
              <X size={20} />
            </button>
          </div>
          <h3 className="text-xl font-bold text-slate-900 mb-2">{title}</h3>
          <div className="text-sm text-slate-500 leading-relaxed">{message}</div>
        </div>
        
        <div className="p-4 bg-slate-50 flex justify-end gap-3 border-t border-slate-100">
          <button
            onClick={closeConfirm}
            disabled={isLoading}
            className="px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-200 bg-slate-100 rounded-xl transition-colors disabled:opacity-50"
          >
            {cancelText}
          </button>
          <button
            onClick={handleConfirm}
            disabled={isLoading}
            className={`px-4 py-2.5 text-sm font-semibold text-white rounded-xl transition-colors flex items-center justify-center gap-2 min-w-[110px] disabled:opacity-70 disabled:cursor-not-allowed ${
              isDestructive
                ? "bg-rose-600 hover:bg-rose-700"
                : "bg-blue-600 hover:bg-blue-700"
            }`}
          >
            {isLoading ? (
              <>
                <Loader2 size={16} className="animate-spin" /> Đang xử lý...
              </>
            ) : (
              confirmText
            )}
          </button>
        </div>
      </div>
    </div>
  );
}