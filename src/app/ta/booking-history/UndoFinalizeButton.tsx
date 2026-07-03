"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { RotateCcw, Loader2, XCircle, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { undoAttendanceFinalization } from "@/actions/mutations";

export default function UndoFinalizeButton({ sessionId }: { sessionId: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [showModal, setShowModal] = useState(false);

  const handleUndo = () => {
    startTransition(async () => {
      const result = await undoAttendanceFinalization(sessionId);

      if (result.success) {
        toast.success("Đã hoàn tác chốt ca");
        router.refresh();
        return;
      }

      toast.error(result.error || "Không thể hoàn tác chốt ca");
    });
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setShowModal(true)}
        disabled={isPending}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
      >
        {isPending ? <Loader2 size={12} className="animate-spin" /> : <RotateCcw size={12} />}
        Hoàn tác
      </button>

      {showModal && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/55 backdrop-blur-sm px-4">
          <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden">
            <div className="p-5 sm:p-6">
              <div className="flex items-start justify-between gap-4 mb-4">
                <div className="w-11 h-11 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center shrink-0">
                  <AlertTriangle size={22} />
                </div>
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  disabled={isPending}
                  className="text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full p-1.5 transition-colors disabled:opacity-50"
                  aria-label="Đóng"
                >
                  <XCircle size={18} />
                </button>
              </div>

              <h3 className="text-lg sm:text-xl font-extrabold text-slate-900 mb-2">Xác nhận hoàn tác chốt ca</h3>
              <p className="text-sm text-slate-600 leading-6">
                Thao tác này sẽ xóa toàn bộ đánh giá của ca học đã chốt và chỉ hoàn lại 1 buổi cho các học sinh có đánh giá trong chính ca này.
              </p>

              <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 leading-6">
                Chỉ bấm xác nhận nếu bạn chắc chắn cần mở lại ca học này.
              </div>
            </div>

            <div className="px-5 sm:px-6 py-4 border-t border-slate-100 bg-slate-50 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowModal(false)}
                disabled={isPending}
                className="px-4 py-2.5 rounded-xl text-sm font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-100 transition-colors disabled:opacity-50"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowModal(false);
                  handleUndo();
                }}
                disabled={isPending}
                className="px-4 py-2.5 rounded-xl text-sm font-semibold text-white bg-rose-600 hover:bg-rose-700 transition-colors flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
              >
                {isPending ? <Loader2 size={16} className="animate-spin" /> : <RotateCcw size={16} />}
                Xác nhận hoàn tác
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}