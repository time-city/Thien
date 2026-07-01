"use client";

import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/lib/AuthContext";
import { useRouter, usePathname } from "next/navigation";
import StudentEvaluationModal from "./StudentEvaluationModal"; 
import type { CheckInStudent, UISessionInfo } from "../../app/types";
import Link from "next/link";
import { ArrowLeft, Loader2, CheckCircle2, AlertTriangle } from "lucide-react";
import { saveStudentEvaluation, submitAttendanceAndCalculateFinance } from "@/actions/mutations";
import { getTodayQuickAttendance } from "@/actions/schedule";
import { toast } from "sonner";

export default function TaCheckInClient({
  sessionInfo,
  students,
  currentPage,
  totalPages,
  classId,
  sessionId,
}: {
  sessionInfo: UISessionInfo;
  students: CheckInStudent[];
  currentPage: number;
  totalPages: number;
  classId: string;
  sessionId: string;
}) {
  const { role } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  const [studentsState, setStudentsState] = useState<CheckInStudent[]>(students);
  const [selectedStudent, setSelectedStudent] = useState<CheckInStudent | null>(null);
  const [search, setSearch] = useState<string>("");
  
  // State xử lý loading và hiển thị Modal Chốt ca
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [isSubmittingFinal, setIsSubmittingFinal] = useState(false);

  // Quick Attendance: Ca dạy tiếp theo và trước đó
  const [nextSession, setNextSession] = useState<any>(null);
  const [prevSession, setPrevSession] = useState<any>(null);
  const [currentSession, setCurrentSession] = useState<any>(null);

  useEffect(() => {
    setStudentsState(students);
  }, [students]);

  useEffect(() => {
    getTodayQuickAttendance().then(sessions => {
      // Tìm vị trí ca hiện tại trong danh sách hôm nay
      const currentIndex = sessions.findIndex(s => s.id === sessionId);
      
      if (currentIndex !== -1) {
        setCurrentSession(sessions[currentIndex]);
      }
      
      // Nút "Ca tiếp theo" có thể là ca liền kề sau ca này (nếu có)
      if (currentIndex !== -1 && currentIndex < sessions.length - 1) {
        setNextSession(sessions[currentIndex + 1]);
      } else if (currentIndex === -1) {
        // Nếu ca này không nằm trong hôm nay, gợi ý ca đầu tiên chưa điểm danh của hôm nay
        const pending = sessions.find(s => !s.isAttendanceSubmitted && s.status !== "COMPLETED");
        if (pending) setNextSession(pending);
      }

      // Nút "Ca trước đó" là ca liền trước ca này (nếu có)
      if (currentIndex > 0) {
        setPrevSession(sessions[currentIndex - 1]);
      }
    });
  }, [sessionId]);

  // Hàm lưu đánh giá nháp cho từng học sinh
  const handleQuickUpdate = async (id: string, field: 'attendance' | 'homework', value: string) => {
    const student = studentsState.find(s => s.id === id);
    if (!student) return;
    
    // Bấm lại giá trị cũ -> Hủy chọn
    const newValue = student[field] === value ? null : value;
    
    // Cập nhật giao diện ngay lập tức
    setStudentsState(prev => prev.map(st => st.id === id ? { ...st, [field]: newValue } : st));
    
    try {
      await saveStudentEvaluation({
        classSessionId: sessionId,
        studentId: id,
        attendanceStatus: field === 'attendance' ? (newValue as any) : (student.attendance as any),
        homeworkStatus: field === 'homework' ? (newValue as any) : (student.homework as any),
        note: student.note,
      });
    } catch (err) {
      toast.error("Lỗi khi cập nhật nhanh");
    }
  };

  const handleSaveAssessment = async (id: string, updates: Partial<CheckInStudent>) => {
    try {
      const res = await saveStudentEvaluation({
        classSessionId: sessionId,
        studentId: id,
        attendanceStatus: updates.attendance as any,
        homeworkStatus: updates.homework as any,
        note: updates.note,
      });

      if (res.success) {
        setStudentsState((prev) => prev.map((st) => (st.id === id ? { ...st, ...updates } : st)));
        setSelectedStudent(null);
      } else {
        toast.error(res.error || "Lỗi khi lưu đánh giá");
      }
    } catch (err) {
      toast.error("Đã xảy ra lỗi hệ thống khi lưu đánh giá.");
    }
  };

  // ==========================================
  // HÀM MỞ MODAL XÁC NHẬN CHỐT CA
  // ==========================================
  const handleFinalizeSession = () => {
    // Bắt buộc giáo viên phải điểm danh đủ 100% học sinh mới cho chốt
    const unassessed = studentsState.filter((s) => !s.attendance);
    if (unassessed.length > 0) {
      toast.error(`Vui lòng điểm danh toàn bộ học sinh trước khi chốt ca! (Còn ${unassessed.length} bạn chưa đánh giá)`);
      return;
    }

    // Mở Modal thay vì dùng window.confirm
    setShowConfirmModal(true);
  };

  // ==========================================
  // HÀM THỰC THI GỌI API CHỐT CA (SAU KHI CONFIRM)
  // ==========================================
  const executeFinalize = async () => {
    setIsSubmittingFinal(true);
    try {
      // Gom toàn bộ data của lớp truyền xuống Backend
      const attendanceData = studentsState.map((s) => ({
        studentId: s.id,
        attendanceStatus: s.attendance!,
        homeworkStatus: s.homework || undefined,
        note: s.note,
      }));

      // Gọi Server Action
      const res = await submitAttendanceAndCalculateFinance(
        sessionId,
        sessionInfo.teacherId, // Đảm bảo UISessionInfo truyền xuống có teacherId
        attendanceData
      );

      if (res.success) {
        setShowConfirmModal(false); // Đóng modal
        toast.success(`Chốt ca thành công! Thực nhận: ${res.netIncome?.toLocaleString('vi-VN')}đ`);
        router.push("/schedule");
      } else {
        toast.error(res.error || "Lỗi khi chốt ca");
      }
    } catch (error) {
      toast.error("Đã xảy ra lỗi hệ thống");
    } finally {
      setIsSubmittingFinal(false);
    }
  };

  const normalize = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

  const visibleSortedStudents = useMemo(() => {
    const q = normalize(search.trim());
    if (!q) return studentsState;
    return studentsState.filter((st) => normalize(st.fullName).includes(q));
  }, [studentsState, search]);

  const getAttendanceColor = (att?: string) => {
    switch (att) {
      case "PRESENT": return "bg-emerald-500";
      case "LATE": return "bg-amber-500";
      case "EXCUSED": return "bg-orange-500";
      case "UNEXCUSED": return "bg-rose-500";
      default: return "bg-slate-200";
    }
  };

  const getHomeworkColor = (hw?: string) => {
    if (hw === "GOOD") return "bg-emerald-100 text-emerald-700";
    if (hw === "DONE") return "bg-amber-100 text-amber-700";
    if (hw === "NOT_DONE") return "bg-rose-100 text-rose-700";
    return "bg-slate-100 text-slate-600";
  };

  const handlePageChange = (newPage: number) => {
    if (newPage < 1 || newPage > totalPages) return;
    router.push(`${pathname}?classId=${classId}&sessionId=${sessionId}&page=${newPage}`);
  };

  // Kiểm tra xem đã điểm danh đủ 100% học sinh trên màn hình này chưa
  const allAssessed = studentsState.length > 0 && studentsState.every((s) => s.attendance);

  return (
    <div className="w-full max-w-5xl mx-auto pb-8 font-sans">
      <div className="bg-white border border-slate-200 shadow-sm rounded-xl py-3 px-4 mb-6">
        <div className="mb-4 flex flex-col sm:flex-row gap-3 justify-between items-start sm:items-center">
          <Link
            href="/schedule"
            className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-blue-600 transition-colors"
          >
            <ArrowLeft size={14} />
            Quay lại Lịch Dạy
          </Link>
          
          <div className="flex flex-col sm:flex-row flex-wrap gap-2 items-start sm:items-center">
            {prevSession && (
              <Link
                href={`/ta?classId=${prevSession.classId}&sessionId=${prevSession.id}`}
                className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-600 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 px-3 py-1.5 rounded-full transition-colors shadow-sm"
              >
                ⬅️ Ca trước: {prevSession.className} ({new Date(prevSession.startTime).toLocaleTimeString('vi-VN', {hour: '2-digit', minute:'2-digit'})})
              </Link>
            )}
            
            {currentSession && (
              <div className="inline-flex items-center gap-1.5 text-[13px] font-extrabold text-amber-700 bg-amber-100/80 border border-amber-200 px-4 py-1.5 rounded-full shadow-sm">
                ⭐ Đang dạy: {currentSession.className} ({new Date(currentSession.startTime).toLocaleTimeString('vi-VN', {hour: '2-digit', minute:'2-digit'})} - {new Date(currentSession.endTime).toLocaleTimeString('vi-VN', {hour: '2-digit', minute:'2-digit'})})
              </div>
            )}
            
            {nextSession && (
              <Link
                href={`/ta?classId=${nextSession.classId}&sessionId=${nextSession.id}`}
                className="inline-flex items-center gap-1.5 text-xs font-bold text-indigo-600 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 px-3 py-1.5 rounded-full transition-colors shadow-sm"
              >
                Ca tiếp theo: {nextSession.className} ({new Date(nextSession.startTime).toLocaleTimeString('vi-VN', {hour: '2-digit', minute:'2-digit'})}) ➡️
              </Link>
            )}
          </div>
        </div>
        <div className="flex flex-col lg:flex-row gap-3 items-start lg:items-center justify-between">
          <div>
            <h1 className="text-xl font-extrabold tracking-tight text-slate-900 leading-tight">
              Sơ Đồ Lớp Học & Điểm Danh
            </h1>
            <p className="text-[13px] text-slate-500 font-medium mt-1 leading-tight">
              Lớp: <span className="font-bold text-slate-700">{sessionInfo.className}</span> | 
              GV: <span className="font-bold text-slate-700">{sessionInfo.teacherName}</span> | 
              {new Date(sessionInfo.date).toLocaleDateString('vi-VN')}
            </p>
          </div>

          <div className="w-full lg:w-auto flex items-center gap-3">
            <input
              type="text"
              placeholder="Tìm theo tên học sinh..."
              className="w-full lg:w-64 bg-slate-50 border border-slate-200 rounded-lg h-9 px-3 text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-100"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            
            {/* NÚT MỞ MODAL CHỐT CA */}
            <button
              onClick={handleFinalizeSession}
              disabled={isSubmittingFinal || !allAssessed}
              className={`h-9 px-4 flex items-center justify-center gap-2 text-white text-xs font-bold rounded-lg shadow-sm transition-all whitespace-nowrap ${
                allAssessed 
                  ? "bg-emerald-600 hover:bg-emerald-700" 
                  : "bg-slate-300 cursor-not-allowed"
              }`}
              title={!allAssessed ? "Vui lòng điểm danh đủ học sinh để chốt ca" : "Chốt ca học và nhận lương"}
            >
              <CheckCircle2 size={16} />
              Chốt Ca Học
            </button>
          </div>
        </div>
      </div>
      
      <div className="flex flex-col gap-4">
        {totalPages > 1 && (
          <div className="flex items-center justify-between bg-white px-4 py-2 border border-slate-200 rounded-xl shadow-sm">
             <span className="text-[13px] text-slate-700 font-medium">
                Trang <span className="font-bold text-slate-900">{currentPage}</span> / {totalPages}
             </span>
             <div className="flex gap-1.5">
              {
                currentPage > 1 && (
                  <button 
                    onClick={() => handlePageChange(1)}
                    className="px-2.5 py-1 border border-slate-200 rounded text-[13px] font-bold text-slate-600 hover:bg-slate-50 hidden sm:block"
                  >
                    Trang đầu
                  </button>
                )
              }
                <button 
                  onClick={() => handlePageChange(currentPage - 1)}
                  disabled={currentPage === 1}
                  className="px-2.5 py-1 border border-slate-200 rounded text-[13px] font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Trước
                </button>
                <button 
                  onClick={() => handlePageChange(currentPage + 1)}
                  disabled={currentPage === totalPages}
                  className="px-2.5 py-1 border border-slate-200 rounded text-[13px] font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Sau
                </button>
                 {
                currentPage < totalPages  && (
                  <button 
                    onClick={() => handlePageChange(totalPages)}
                    className="px-2.5 py-1 border border-slate-200 rounded text-[13px] font-bold text-slate-600 hover:bg-slate-50 hidden sm:block"
                  >
                    Trang cuối
                  </button>
                )
              }
             </div>
          </div>
        )}
        
        <div className="bg-white border border-slate-200 rounded-xl overflow-x-auto shadow-sm">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-[10px] sm:text-[11px] uppercase tracking-widest font-extrabold text-slate-500">
                <th className="py-2 px-2 sm:px-3 w-10 sm:w-12 text-center hidden sm:table-cell">STT</th>
                <th className="py-2 px-2 sm:px-3">Học sinh</th>
                <th className="py-2 px-2 sm:px-3 text-center">Điểm danh</th>
                <th className="py-2 px-2 sm:px-3 text-center hidden md:table-cell">Bài tập</th>
                <th className="py-2 px-2 sm:px-3 w-16 sm:w-20 text-center">Khác</th>
              </tr>
            </thead>
            <tbody>
              {visibleSortedStudents.map((student) => {
                const isAssessed = student.attendance || student.homework;
                const nameParts = student.fullName.split(" ");
                const initial = nameParts[nameParts.length - 1].charAt(0).toUpperCase();

                return (
                  <tr
                    key={student.id}
                    className={`border-b last:border-b-0 border-slate-100 transition-colors ${
                      isAssessed ? "bg-slate-50/50" : "hover:bg-slate-50"
                    }`}
                  >
                    <td className="py-2 px-2 sm:px-3 text-center font-bold text-slate-400 text-[13px] hidden sm:table-cell">
                      {student.seat}
                    </td>
                    <td className="py-2 px-2 sm:px-3">
                      <div className="flex items-center gap-2 sm:gap-2.5">
                        <div
                          className={`w-6 h-6 sm:w-7 sm:h-7 rounded-full flex items-center justify-center font-bold text-[10px] sm:text-xs border ${
                            isAssessed
                              ? "bg-slate-800 text-white border-slate-700"
                              : "bg-slate-100 text-slate-500 border-slate-200"
                          }`}
                        >
                          {initial}
                        </div>
                        <div className="flex flex-col justify-center">
                           <div className="font-bold text-slate-800 text-xs sm:text-[13px] leading-none mb-1">{student.fullName}</div>
                           <div className="text-[10px] sm:text-[11px] text-slate-500 font-medium leading-none">Còn {student.remainingSessions} buổi</div>
                        </div>
                      </div>
                    </td>
                    <td className="py-2 px-2 sm:px-3">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          onClick={() => handleQuickUpdate(student.id, 'attendance', 'PRESENT')}
                          className={`px-2 py-1 rounded-[6px] text-[10px] font-bold border transition-colors ${
                            student.attendance === 'PRESENT' ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white text-slate-500 border-slate-200 hover:border-emerald-400 hover:text-emerald-600'
                          }`}
                        >
                          Có mặt
                        </button>
                        <button
                          onClick={() => handleQuickUpdate(student.id, 'attendance', 'LATE')}
                          className={`px-2 py-1 rounded-[6px] text-[10px] font-bold border transition-colors ${
                            student.attendance === 'LATE' ? 'bg-amber-500 text-white border-amber-500' : 'bg-white text-slate-500 border-slate-200 hover:border-amber-400 hover:text-amber-600'
                          }`}
                        >
                          Trễ
                        </button>
                        <button
                          onClick={() => handleQuickUpdate(student.id, 'attendance', 'EXCUSED')}
                          className={`px-2 py-1 rounded-[6px] text-[10px] font-bold border transition-colors ${
                            student.attendance === 'EXCUSED' ? 'bg-blue-500 text-white border-blue-500' : 'bg-white text-slate-500 border-slate-200 hover:border-blue-400 hover:text-blue-600'
                          }`}
                        >
                          Phép
                        </button>
                        <button
                          onClick={() => handleQuickUpdate(student.id, 'attendance', 'UNEXCUSED')}
                          className={`px-2 py-1 rounded-[6px] text-[10px] font-bold border transition-colors ${
                            student.attendance === 'UNEXCUSED' ? 'bg-rose-500 text-white border-rose-500' : 'bg-white text-slate-500 border-slate-200 hover:border-rose-400 hover:text-rose-600'
                          }`}
                        >
                          Vắng
                        </button>
                      </div>
                    </td>
                    <td className="py-2 px-2 sm:px-3 hidden md:table-cell">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          onClick={() => handleQuickUpdate(student.id, 'homework', 'GOOD')}
                          className={`px-2 py-1 rounded-[6px] text-[10px] font-bold border transition-colors ${
                            student.homework === 'GOOD' ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white text-slate-500 border-slate-200 hover:border-emerald-400 hover:text-emerald-600'
                          }`}
                        >
                          Đạt
                        </button>
                        <button
                          onClick={() => handleQuickUpdate(student.id, 'homework', 'DONE')}
                          className={`px-2 py-1 rounded-[6px] text-[10px] font-bold border transition-colors ${
                            student.homework === 'DONE' ? 'bg-amber-500 text-white border-amber-500' : 'bg-white text-slate-500 border-slate-200 hover:border-amber-400 hover:text-amber-600'
                          }`}
                        >
                          Không đạt
                        </button>
                        <button
                          onClick={() => handleQuickUpdate(student.id, 'homework', 'NOT_DONE')}
                          className={`px-2 py-1 rounded-[6px] text-[10px] font-bold border transition-colors ${
                            student.homework === 'NOT_DONE' ? 'bg-rose-600 text-white border-rose-600' : 'bg-white text-slate-500 border-slate-200 hover:border-rose-400 hover:text-rose-600'
                          }`}
                        >
                          Không làm
                        </button>
                      </div>
                    </td>
                    <td className="py-2 px-2 sm:px-3 text-center">
                      <button
                        onClick={() => setSelectedStudent(student)}
                        className={`px-2 py-1 sm:px-3 sm:py-1 border rounded-[6px] text-[10px] sm:text-[11px] font-bold shadow-sm transition-all outline-none whitespace-nowrap ${
                          student.note
                            ? "bg-blue-50 border-blue-200 text-blue-600 hover:bg-blue-100"
                            : "bg-transparent border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50"
                        }`}
                        title="Thêm nhận xét / đánh giá chi tiết"
                      >
                        {student.note ? "Sửa" : "Ghi chú"}
                      </button>
                    </td>
                  </tr>
                );
              })}
              
              {visibleSortedStudents.length === 0 && (
                <tr>
                  <td colSpan={5} className="p-6 text-center text-slate-500 text-sm">
                    Không tìm thấy học sinh nào trong lớp.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {selectedStudent && (
        <AssessmentModal
          student={selectedStudent}
          onClose={() => setSelectedStudent(null)}
          onSave={handleSaveAssessment}
        />
      )}

      {/* ========================================== */}
      {/* MODAL XÁC NHẬN CHỐT CA HỌC */}
      {/* ========================================== */}
      {showConfirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden flex flex-col animate-in zoom-in-95 duration-200">
            <div className="p-6 flex flex-col items-center text-center">
              <div className="w-14 h-14 bg-rose-100 text-rose-600 rounded-full flex items-center justify-center mb-4">
                <AlertTriangle size={28} strokeWidth={2.5} />
              </div>
              <h3 className="text-lg font-extrabold text-slate-900 mb-2">Xác Nhận Chốt Ca</h3>
              <p className="text-[13px] text-slate-500 font-medium leading-relaxed">
                Bạn có chắc chắn muốn chốt ca học này? Hệ thống sẽ tự động <b>trừ phiếu học sinh</b>, <b>tính lương</b> vào ví giáo viên và <b className="text-rose-600">không thể hoàn tác</b>.
              </p>
            </div>
            
            <div className="p-4 border-t border-slate-100 flex gap-3 bg-slate-50">
              <button
                onClick={() => setShowConfirmModal(false)}
                disabled={isSubmittingFinal}
                className="flex-1 px-4 py-2.5 rounded-xl font-bold text-sm text-slate-600 bg-white border border-slate-200 hover:bg-slate-100 transition-colors disabled:opacity-50"
              >
                Hủy
              </button>
              <button
                onClick={executeFinalize}
                disabled={isSubmittingFinal}
                className="flex-1 px-4 py-2.5 rounded-xl font-bold text-sm bg-emerald-600 text-white hover:bg-emerald-700 transition-colors shadow-sm flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
              >
                {isSubmittingFinal ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <CheckCircle2 size={16} />
                )}
                {isSubmittingFinal ? "Đang xử lý..." : "Chốt Ngay"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function AssessmentModal({
  student,
  onClose,
  onSave,
}: {
  student: CheckInStudent;
  onClose: () => void;
  onSave: (id: string, updates: Partial<CheckInStudent>) => void;
}) {
  return (
    <StudentEvaluationModal
      student={{
        id: student.id,
        fullName: student.fullName,
        className: student.className,
        seat: student.seat,
        phone: student.phone,
        parentName: student.parentName,
        parentPhone: student.parentPhone,
        remainingSessions: student.remainingSessions,
        feeStatus: student.feeStatus,
        attendance: student.attendance,
        homework: student.homework,
        note: student.note ?? "",
      }}
      onClose={onClose}
      onSave={(id, updates) =>
        onSave(id, {
          attendance: updates.attendance,
          homework: updates.homework,
          note: updates.note,
        })
      }
    />
  );
}