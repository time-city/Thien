"use client";

import { useState, useEffect } from "react";
import { format } from "date-fns";
import { vi } from "date-fns/locale";
import { ClipboardList, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { getTodayQuickAttendance } from "@/actions/schedule";

export default function QuickAttendancePanel({ inSidebar = false, onClose }: { inSidebar?: boolean, onClose?: () => void }) {
  const router = useRouter();
  const [todaySessions, setTodaySessions] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  
  useEffect(() => {
    setIsLoading(true);
    getTodayQuickAttendance().then(data => {
      setTodaySessions(data);
      setIsLoading(false);
    });
  }, []);

  const handleQuickAttendance = () => {
    if (todaySessions.length === 0) {
      toast.info("Hôm nay bạn không có ca dạy nào!");
      return;
    }

    // Tìm ca chưa điểm danh gần nhất
    const pendingSession = todaySessions.find(s => !s.isAttendanceSubmitted && s.status !== "COMPLETED");
    
    if (pendingSession) {
      router.push(`/ta?classId=${pendingSession.classId}&sessionId=${pendingSession.id}`);
      if (onClose) onClose();
    } else {
      // Nếu đã điểm danh hết, nhảy tới ca đầu tiên của ngày
      const firstSession = todaySessions[0];
      toast.success("Tuyệt vời! Bạn đã hoàn thành điểm danh tất cả các ca hôm nay.");
      router.push(`/ta?classId=${firstSession.classId}&sessionId=${firstSession.id}`);
      if (onClose) onClose();
    }
  };

  const pendingCount = todaySessions.filter(s => !s.isAttendanceSubmitted && s.status !== "COMPLETED").length;

  return (
    <>
      {inSidebar ? (
        <button 
          onClick={handleQuickAttendance}
          className="flex items-center justify-between w-full gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 text-slate-600 hover:bg-indigo-50 hover:text-indigo-700"
        >
          <div className="flex items-center gap-3">
            <ClipboardList size={18} className="text-slate-400 group-hover:text-indigo-600" />
            Điểm danh nhanh
          </div>
          {isLoading ? (
            <Loader2 size={14} className="animate-spin text-slate-400" />
          ) : pendingCount > 0 && (
            <span className="bg-rose-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow-sm animate-pulse">
              {pendingCount}
            </span>
          )}
        </button>
      ) : (
        <button 
          onClick={handleQuickAttendance}
          className="flex items-center gap-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 px-3 py-1.5 rounded-lg border border-indigo-200 transition-colors font-bold text-xs md:text-sm shadow-sm"
        >
          <ClipboardList size={16} />
          Điểm danh nhanh
          {isLoading ? (
            <Loader2 size={12} className="animate-spin ml-1" />
          ) : pendingCount > 0 && (
            <span className="bg-rose-500 text-white text-[10px] w-4 h-4 flex items-center justify-center rounded-full ml-1">
              {pendingCount}
            </span>
          )}
        </button>
      )}
    </>
  );
}
