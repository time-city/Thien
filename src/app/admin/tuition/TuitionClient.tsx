"use client";

import { useMemo, useState, useEffect } from "react";
import { useAuth } from "@/lib/AuthContext";
import { QRCodeSVG } from "qrcode.react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { Loader2, TrendingUp, CreditCard, Wallet, CheckCircle2 } from "lucide-react";
import type { TuitionStudentData } from "@/actions/queries";
import { payTeacherSalary, processStudentTuitionPayment } from "@/actions/mutations";
import CourseReportModal from "../students/CourseReportModal";

export type TeacherFinanceViewData = {
  id: string;
  username: string;
  fullName: string;
  salaryBalance: number;
  totalRoomFee: number;
  totalEarned: number;
};

type TuitionClientProps = {
  initialStudents: TuitionStudentData[];
  initialTeachers: TeacherFinanceViewData[];
};

export default function TuitionClient({
  initialStudents,
  initialTeachers,
}: TuitionClientProps) {
  const { role } = useAuth();
  const router = useRouter();

  const [activeTab, setActiveTab] = useState<"STUDENT" | "TEACHER_SALARY">("STUDENT");

  const [students, setStudents] = useState<TuitionStudentData[]>(initialStudents);
  const [teachers, setTeachers] = useState<TeacherFinanceViewData[]>(initialTeachers);

  // LẮNG NGHE DATA TỪ DATABASE: Khi router.refresh() chạy, data DB mới nhất sẽ được đổ vào đây
  useEffect(() => {
    setStudents(initialStudents);
  }, [initialStudents]);

  useEffect(() => {
    setTeachers(initialTeachers);
  }, [initialTeachers]);

  // States
  const [selectedTeacher, setSelectedTeacher] = useState<TeacherFinanceViewData | null>(null);
  const [isPayingSalary, setIsPayingSalary] = useState(false);
  const studentsWithLowSessions = useMemo(() => {
    return students.filter((s) => 
      s.enrolledCourses.some((c) => c.remainingSessions <= 2 || c.pendingInvoices.length > 0) ||
      (s.allPendingInvoices && s.allPendingInvoices.length > 0)
    );
  }, [students]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(amount);
  };

  const [reportModalOpen, setReportModalOpen] = useState(false);
  const [reportData, setReportData] = useState<{ studentId: string; studentName: string; classId: string; className: string } | null>(null);

  // --- LOGIC THANH TOÁN LƯƠNG ---
  const handlePaySalary = async () => {
    if (!selectedTeacher || selectedTeacher.salaryBalance <= 0) return;
    setIsPayingSalary(true);
    try {
      const res = await payTeacherSalary(selectedTeacher.id, selectedTeacher.salaryBalance);
      if (res.success) {
        toast.success(`Đã thanh toán ${formatCurrency(selectedTeacher.salaryBalance)} cho ${selectedTeacher.fullName}`);

        setSelectedTeacher(null);
        router.refresh(); // Ép tải lại Database để lấy số dư ví = 0đ
      } else {
        toast.error(res.error || "Lỗi thanh toán lương");
      }
    } catch (error) {
      toast.error("Lỗi hệ thống");
    } finally {
      setIsPayingSalary(false);
    }
  };

  if (role !== "SUPER_ADMIN") {
    return <div className="p-8 text-center text-slate-500">Bạn không có quyền truy cập trang này.</div>;
  }

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto font-sans">
      <div className="mb-8">
        <h1 className="text-2xl md:text-3xl font-extrabold text-slate-900 tracking-tight">Quản Lý Tài Chính</h1>
        <p className="text-slate-500 mt-1 text-sm font-medium">Thu học phí học sinh và Thanh toán lương giáo viên.</p>
      </div>

      <div className="flex border-b border-slate-200 mb-6 font-bold text-sm overflow-x-auto hide-scrollbar">
        <button
          onClick={() => setActiveTab("STUDENT")}
          className={`px-6 py-3 border-b-2 transition-colors whitespace-nowrap ${activeTab === "STUDENT" ? "border-blue-600 text-blue-700" : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
        >
          Thu Học Phí Học Sinh
        </button>
        <button
          onClick={() => setActiveTab("TEACHER_SALARY")}
          className={`px-6 py-3 border-b-2 transition-colors whitespace-nowrap ${activeTab === "TEACHER_SALARY" ? "border-blue-600 text-blue-700" : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
        >
          Thanh Toán Lương
        </button>
      </div>

      {/* TAB 1: THU HỌC PHÍ */}
      {activeTab === "STUDENT" && (
        <div className="bg-white border text-center border-slate-200 rounded-xl overflow-hidden shadow-sm">
          <table className="w-full text-left text-sm text-slate-700">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-900">
              <tr>
                <th className="py-3 px-4 font-bold">Học sinh</th>
                <th className="py-3 px-4 font-bold hidden sm:table-cell">Lớp</th>
                <th className="py-3 px-4 font-bold">Môn cảnh báo</th>
                <th className="py-3 px-4 font-bold text-right">Hành động</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {studentsWithLowSessions.map((student) => (
                <tr key={student.id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="py-3 px-4">
                    <div className="font-semibold text-slate-900">{student.fullName}</div>
                    <div className="text-xs text-slate-500">ID: {student.id.substring(0, 8)}</div>
                  </td>
                  <td className="py-3 px-4 hidden sm:table-cell">
                    {student.enrolledCourses[0]?.className ?? (student.allPendingInvoices?.length ? (student.allPendingInvoices[0].isDebt ? "Nợ Cũ" : "Hóa đơn") : "-")}
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex flex-wrap gap-1.5 flex-col">
                      {student.enrolledCourses
                        .filter((c) => c.remainingSessions <= 2 || c.pendingInvoices.length > 0)
                        .map((c) => (
                          <div key={c.enrollmentId} className="flex gap-1 flex-wrap">
                            {c.remainingSessions <= 2 && (
                              <span
                                className="bg-rose-50 text-rose-700 font-bold px-2 py-0.5 rounded text-[11px] border border-rose-100 whitespace-nowrap"
                              >
                                {c.className} ({c.remainingSessions} buổi)
                              </span>
                            )}
                            {c.pendingInvoices.length > 0 && c.pendingInvoices.map(inv => (
                              <span key={inv.id} className={`${inv.status === "UNDERPAID" ? "bg-rose-100 text-rose-700 border-rose-200" : "bg-amber-100 text-amber-700 border-amber-200"} font-bold px-2 py-0.5 rounded text-[11px] border whitespace-nowrap`}>
                                Hóa đơn: {inv.status === "UNDERPAID" ? "THIẾU TIỀN" : "CHỜ T.TOÁN"}
                              </span>
                            ))}
                          </div>
                        ))}
                      
                      {/* Hiển thị các hóa đơn nợ/tổng hợp (không dính trực tiếp với 1 enrollment) */}
                      {student.allPendingInvoices?.map(inv => (
                        <div key={inv.id} className="flex gap-1 flex-wrap">
                          <span className="bg-orange-100 text-orange-700 border-orange-200 font-bold px-2 py-0.5 rounded text-[11px] border whitespace-nowrap">
                            {inv.isDebt ? "Nợ cũ" : "Hóa đơn"}: {new Intl.NumberFormat("vi-VN").format(inv.expectedAmount - inv.amountPaid)}đ
                          </span>
                        </div>
                      ))}
                    </div>
                  </td>
                  <td className="py-3 px-4 text-right">
                    <button
                      onClick={() => {
                        setReportData({ studentId: student.id, studentName: student.fullName, classId: "", className: "" });
                        setReportModalOpen(true);
                      }}
                      className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-1.5 px-4 rounded shadow-sm transition-colors text-xs whitespace-nowrap"
                    >
                      Xử lý Thu Phí
                    </button>
                  </td>
                </tr>
              ))}
              {studentsWithLowSessions.length === 0 && (
                <tr>
                  <td colSpan={4} className="py-10 text-center text-slate-500 font-medium">
                    Không có học sinh nào cạn buổi học cần thu học phí lúc này.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* TAB 2: THANH TOÁN LƯƠNG GIÁO VIÊN (DẠNG LIST) */}
      {activeTab === "TEACHER_SALARY" && (
        <div className="flex flex-col gap-4">
          {teachers.map((teacher) => {
            const hasBalance = teacher.salaryBalance > 0;
            const initial = teacher.fullName.charAt(0).toUpperCase();

            return (
              <div key={teacher.id} className="bg-white border border-slate-200 rounded-2xl p-4 md:p-5 shadow-sm hover:shadow-md transition-all flex flex-col md:flex-row md:items-center gap-4 md:gap-6">

                {/* 1. Thông tin Giáo viên */}
                <div className="flex items-center gap-3 md:w-1/4 shrink-0">
                  <div className="w-10 h-10 rounded-full bg-slate-800 text-white flex items-center justify-center font-bold text-sm shrink-0">
                    {initial}
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-extrabold text-slate-900 truncate text-sm sm:text-base">{teacher.fullName}</h3>
                    <p className="text-slate-500 text-xs font-medium truncate">@{teacher.username}</p>
                  </div>
                </div>

                {/* 2. Cụm Thống Kê (Thu nhập - Phí - Thực nhận) */}
                <div className="grid grid-cols-3 gap-2 sm:gap-4 flex-1">
                  <div className="flex flex-col justify-center p-2 rounded-xl bg-slate-50 border border-slate-100">
                    <span className="text-[10px] sm:text-xs font-bold text-slate-500 flex items-center gap-1 mb-1">
                      <TrendingUp size={12} className="text-emerald-500" /> <span className="truncate">Thu nhập</span>
                    </span>
                    <span className="text-[11px] sm:text-sm font-extrabold text-slate-700 truncate">
                      {formatCurrency(teacher.totalEarned)}
                    </span>
                  </div>

                  <div className="flex flex-col justify-center p-2 rounded-xl bg-slate-50 border border-slate-100">
                    <span className="text-[10px] sm:text-xs font-bold text-slate-500 flex items-center gap-1 mb-1">
                      <CreditCard size={12} className="text-rose-500" /> <span className="truncate">Phí phòng</span>
                    </span>
                    <span className="text-[11px] sm:text-sm font-extrabold text-rose-600 truncate">
                      -{formatCurrency(teacher.totalRoomFee)}
                    </span>
                  </div>

                  <div className="flex flex-col justify-center p-2 rounded-xl bg-blue-50 border border-blue-100">
                    <span className="text-[10px] sm:text-xs font-extrabold text-blue-800 flex items-center gap-1 uppercase mb-1">
                      <Wallet size={12} /> <span className="truncate">Thực nhận</span>
                    </span>
                    <span className="text-[11px] sm:text-sm font-black text-blue-700 truncate">
                      {formatCurrency(teacher.salaryBalance)}
                    </span>
                  </div>
                </div>

                {/* 3. Trạng thái & Nút hành động */}
                <div className="flex flex-row md:flex-col items-center md:items-end justify-between md:justify-center md:w-32 shrink-0 gap-3 border-t md:border-t-0 border-slate-100 pt-3 md:pt-0 mt-1 md:mt-0">
                  {hasBalance ? (
                    <span className="bg-amber-100 text-amber-700 font-extrabold px-2 py-1 rounded text-[10px] uppercase tracking-wider whitespace-nowrap">Cần Trả Lương</span>
                  ) : (
                    <span className="bg-slate-100 text-slate-500 font-extrabold px-2 py-1 rounded text-[10px] uppercase tracking-wider whitespace-nowrap">Đã Tất Toán</span>
                  )}

                  <button
                    onClick={() => setSelectedTeacher(teacher)}
                    disabled={!hasBalance}
                    className={`w-full md:w-auto px-4 py-2 rounded-lg font-bold shadow-sm transition-all text-xs flex items-center justify-center gap-1.5 whitespace-nowrap ${hasBalance ? "bg-slate-900 hover:bg-slate-800 text-white" : "bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200"
                      }`}
                  >
                    Thanh Toán
                  </button>
                </div>
              </div>
            );
          })}
          {teachers.length === 0 && (
            <div className="py-10 text-center bg-white border border-slate-200 rounded-xl shadow-sm text-slate-500 font-medium">
              Chưa có dữ liệu giáo viên.
            </div>
          )}
        </div>
      )}



      {/* ======================================================== */}
      {/* MODAL THANH TOÁN LƯƠNG GIÁO VIÊN */}
      {selectedTeacher && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden flex flex-col animate-in zoom-in-95 duration-200">
            <div className="p-4 md:p-5 border-b border-slate-100 bg-slate-50">
              <h3 className="text-lg font-extrabold text-slate-900">Chi Trả Lương Giáo Viên</h3>
              <p className="text-sm text-slate-500 mt-0.5 font-medium">Người nhận: <span className="font-bold text-slate-700">{selectedTeacher.fullName}</span></p>
            </div>
            <div className="p-6 flex flex-col items-center">
              <div className="mb-6 text-center w-full">
                <p className="text-sm font-semibold text-slate-500 mb-1">Số tiền cần chuyển khoản</p>
                <div className="p-4 bg-blue-50 rounded-xl border border-blue-100 mt-2">
                  <p className="text-3xl font-extrabold text-blue-600 tracking-tight">{formatCurrency(selectedTeacher.salaryBalance)}</p>
                </div>
              </div>
              <div className="w-full flex flex-col items-center p-5 bg-slate-50 rounded-2xl border border-slate-100">
                <p className="text-[11px] font-bold text-slate-500 mb-3 uppercase tracking-widest text-center">Bạn có thể quét QR để CK nhanh <br /> (Nếu GV cung cấp STK)</p>
                <div className="bg-white p-3 rounded-xl shadow-sm border border-slate-200">
                  <QRCodeSVG value={`THANH TOAN LUONG ${selectedTeacher.fullName.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase()}`} size={160} level="H" />
                </div>
              </div>
              <p className="text-xs text-slate-400 mt-4 text-center italic">* Bấm xác nhận bên dưới sau khi bạn đã chuyển khoản thành công để đưa số dư ví giáo viên về 0đ.</p>
            </div>
            <div className="p-4 border-t border-slate-100 flex justify-end gap-3 bg-white">
              <button onClick={() => setSelectedTeacher(null)} disabled={isPayingSalary} className="px-5 py-2.5 rounded-xl font-bold text-sm text-slate-600 hover:bg-slate-100 border border-slate-200 transition-colors w-full sm:w-auto">Hủy</button>
              <button onClick={handlePaySalary} disabled={isPayingSalary} className="px-5 py-2.5 rounded-xl font-bold text-sm bg-slate-900 text-white hover:bg-slate-800 transition-colors shadow-sm flex items-center justify-center gap-2 w-full sm:w-auto">
                {isPayingSalary && <Loader2 size={16} className="animate-spin" />} Xác Nhận Đã Chuyển
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL XUẤT BÁO CÁO */}
      {reportData && (
        <CourseReportModal
          isOpen={reportModalOpen}
          onClose={() => setReportModalOpen(false)}
          studentId={reportData.studentId}
          studentName={reportData.studentName}
        />
      )}
    </div>
  );
}