"use client";

import { useMemo, useState, useEffect } from "react";
import { useAuth } from "@/lib/AuthContext";
import { QRCodeSVG } from "qrcode.react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { Loader2, TrendingUp, CreditCard, Wallet, CheckCircle2 } from "lucide-react";
import type { TuitionStudentData } from "@/actions/queries"; 
import { payTeacherSalary, processStudentTuitionPayment } from "@/actions/mutations";

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
  const [selectedStudent, setSelectedStudent] = useState<TuitionStudentData | null>(null);
  const [selectedCourses, setSelectedCourses] = useState<Set<string>>(new Set());
  const [isSubmittingTuition, setIsSubmittingTuition] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<"BANK_TRANSFER" | "CASH">("BANK_TRANSFER");
  
  const [selectedTeacher, setSelectedTeacher] = useState<TeacherFinanceViewData | null>(null);
  const [isPayingSalary, setIsPayingSalary] = useState(false);

  const studentsWithLowSessions = useMemo(() => {
    return students.filter((s) => s.enrolledCourses.some((c) => c.remainingSessions <= 2));
  }, [students]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(amount);
  };

  const handleToggleCourse = (courseId: string) => {
    setSelectedCourses((prev) => {
      const next = new Set(prev);
      if (next.has(courseId)) next.delete(courseId);
      else next.add(courseId);
      return next;
    });
  };

  const totalFee = useMemo(() => {
    if (!selectedStudent) return 0;
    return selectedStudent.enrolledCourses.reduce((sum, course: any) => {
      if (selectedCourses.has(course.enrollmentId)) return sum + (course.price || 0);
      return sum;
    }, 0);
  }, [selectedStudent, selectedCourses]);

  const getQrCodeString = () => {
    if (!selectedStudent) return "";
    const selectedCourseNames = selectedStudent.enrolledCourses
      .filter(c => selectedCourses.has(c.enrollmentId))
      .map(c => c.className);
    const normalizedCourses = selectedCourseNames
      .map((k) => k.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase())
      .join(" ");
    return `HP ${normalizedCourses} ${selectedStudent.id}`;
  };

  // --- LOGIC THU HỌC PHÍ (CHẠY 100% BẰNG DATABASE) ---
  const handleProcessTuition = async () => {
    if (!selectedStudent || selectedCourses.size === 0) return;
    setIsSubmittingTuition(true);
    try {
      // 1. GỌI MUTATION: Backend sẽ lưu Phiếu thu (PaymentHistory) và cộng số buổi trong DB
      const res = await processStudentTuitionPayment(selectedStudent.id, Array.from(selectedCourses), paymentMethod);
      
      if (res.success) {
        toast.success(`Đã thu ${formatCurrency(totalFee)} của ${selectedStudent.fullName}`);
        
        setSelectedStudent(null);
        setSelectedCourses(new Set());
        setPaymentMethod("BANK_TRANSFER");
        
        // 2. GỌI QUERY MỚI LÊN: Ép Next.js tải lại Database thật để lấy số buổi đã được cộng
        router.refresh();
      } else {
        toast.error(res.error || "Lỗi thu học phí");
      }
    } catch (error) {
      toast.error("Lỗi hệ thống");
    } finally {
      setIsSubmittingTuition(false);
    }
  };

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
          className={`px-6 py-3 border-b-2 transition-colors whitespace-nowrap ${
            activeTab === "STUDENT" ? "border-blue-600 text-blue-700" : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          Thu Học Phí Học Sinh
        </button>
        <button
          onClick={() => setActiveTab("TEACHER_SALARY")}
          className={`px-6 py-3 border-b-2 transition-colors whitespace-nowrap ${
            activeTab === "TEACHER_SALARY" ? "border-blue-600 text-blue-700" : "border-transparent text-slate-500 hover:text-slate-800"
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
                  <td className="py-3 px-4 hidden sm:table-cell">{student.enrolledCourses[0]?.className ?? "-"}</td>
                  <td className="py-3 px-4">
                    <div className="flex flex-wrap gap-1">
                      {student.enrolledCourses
                        .filter((c) => c.remainingSessions <= 2)
                        .map((c) => (
                          <span
                            key={c.enrollmentId}
                            className="bg-rose-50 text-rose-700 font-bold px-2 py-0.5 rounded text-[11px] border border-rose-100 whitespace-nowrap"
                          >
                            {c.className} ({c.remainingSessions} buổi)
                          </span>
                        ))}
                    </div>
                  </td>
                  <td className="py-3 px-4 text-right">
                    <button
                      onClick={() => { setSelectedStudent(student); setSelectedCourses(new Set()); }}
                      className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-1.5 px-3 rounded shadow-sm transition-colors text-xs whitespace-nowrap"
                    >
                      Tạo QR Thu
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
                      <TrendingUp size={12} className="text-emerald-500"/> <span className="truncate">Thu nhập</span>
                    </span>
                    <span className="text-[11px] sm:text-sm font-extrabold text-slate-700 truncate">
                      {formatCurrency(teacher.totalEarned)}
                    </span>
                  </div>
                  
                  <div className="flex flex-col justify-center p-2 rounded-xl bg-slate-50 border border-slate-100">
                    <span className="text-[10px] sm:text-xs font-bold text-slate-500 flex items-center gap-1 mb-1">
                      <CreditCard size={12} className="text-rose-500"/> <span className="truncate">Phí phòng</span>
                    </span>
                    <span className="text-[11px] sm:text-sm font-extrabold text-rose-600 truncate">
                      -{formatCurrency(teacher.totalRoomFee)}
                    </span>
                  </div>
                  
                  <div className="flex flex-col justify-center p-2 rounded-xl bg-blue-50 border border-blue-100">
                    <span className="text-[10px] sm:text-xs font-extrabold text-blue-800 flex items-center gap-1 uppercase mb-1">
                      <Wallet size={12}/> <span className="truncate">Thực nhận</span>
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
                    className={`w-full md:w-auto px-4 py-2 rounded-lg font-bold shadow-sm transition-all text-xs flex items-center justify-center gap-1.5 whitespace-nowrap ${
                      hasBalance ? "bg-slate-900 hover:bg-slate-800 text-white" : "bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200"
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
      {/* MODAL THU HỌC PHÍ */}
      {selectedStudent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200">
            <div className="p-4 md:p-5 border-b border-slate-100 bg-slate-50">
              <h3 className="text-lg font-extrabold text-slate-900">Gộp Học Phí & Gia Hạn</h3>
              <p className="text-sm text-slate-500 mt-0.5 font-medium">Học sinh: <span className="font-bold text-slate-700">{selectedStudent.fullName}</span></p>
            </div>
            <div className="p-4 md:p-6 overflow-y-auto">
              <p className="text-sm font-bold text-slate-700 mb-3">1. Chọn môn học để gia hạn:</p>
              <div className="space-y-2">
                {selectedStudent.enrolledCourses.map((c: any) => {
                  const isLow = c.remainingSessions <= 2;
                  const isSelected = selectedCourses.has(c.enrollmentId);
                  
                  return (
                    <label key={c.enrollmentId} className={`flex items-center justify-between p-3 rounded-xl border cursor-pointer transition-all ${isSelected ? "border-blue-500 bg-blue-50/50" : "border-slate-200 bg-white hover:bg-slate-50"}`}>
                      <div className="flex items-center gap-3">
                        <div className={`w-5 h-5 rounded flex items-center justify-center border transition-colors ${isSelected ? "bg-blue-600 border-blue-600" : "border-slate-300"}`}>
                          {isSelected && <CheckCircle2 size={14} className="text-white" />}
                        </div>
                        <div>
                          <p className="font-bold text-slate-900 text-sm">{c.className}</p>
                          <p className={`text-[11px] font-medium mt-0.5 ${isLow ? "text-rose-600" : "text-slate-500"}`}>Đang còn: {c.remainingSessions} buổi</p>
                        </div>
                      </div>
                      <div className="font-bold text-slate-700 text-sm">{formatCurrency(c.price || 0)}</div>
                      <input type="checkbox" checked={isSelected} onChange={() => handleToggleCourse(c.enrollmentId)} className="sr-only"/>
                    </label>
                  );
                })}
              </div>
              
              <div className="mt-4 pt-4 border-t border-slate-100">
                <p className="text-sm font-bold text-slate-700 mb-2">2. Phương thức thu:</p>
                <div className="flex gap-4">
                  <label className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl border cursor-pointer font-bold text-sm transition-colors ${paymentMethod === "BANK_TRANSFER" ? "bg-blue-50 border-blue-500 text-blue-700" : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"}`}>
                    <input type="radio" name="paymentMethod" checked={paymentMethod === "BANK_TRANSFER"} onChange={() => setPaymentMethod("BANK_TRANSFER")} className="sr-only" />
                    Chuyển Khoản
                  </label>
                  <label className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl border cursor-pointer font-bold text-sm transition-colors ${paymentMethod === "CASH" ? "bg-emerald-50 border-emerald-500 text-emerald-700" : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"}`}>
                    <input type="radio" name="paymentMethod" checked={paymentMethod === "CASH"} onChange={() => setPaymentMethod("CASH")} className="sr-only" />
                    Tiền Mặt
                  </label>
                </div>
              </div>

              <div className="mt-6 pt-4 border-t border-slate-100 flex justify-between items-center">
                <span className="text-slate-500 text-sm font-bold">3. Tổng tiền cần thu:</span>
                <span className="text-2xl font-extrabold text-blue-600 tracking-tight">{formatCurrency(totalFee)}</span>
              </div>
              {selectedCourses.size > 0 && paymentMethod === "BANK_TRANSFER" && (
                <div className="mt-6 flex flex-col items-center p-5 bg-slate-50 rounded-2xl border border-slate-100">
                  <p className="text-[11px] font-bold text-slate-500 mb-3 uppercase tracking-widest">Đưa QR cho học sinh quét</p>
                  <div className="bg-white p-3 rounded-xl shadow-sm border border-slate-200">
                    <QRCodeSVG value={getQrCodeString()} size={160} level="H" />
                  </div>
                  <p className="mt-4 text-xs font-mono font-semibold text-slate-600 bg-white px-3 py-1.5 rounded-md border border-slate-200 text-center w-full truncate">{getQrCodeString()}</p>
                </div>
              )}
            </div>
            <div className="p-4 border-t border-slate-100 flex justify-end gap-3 bg-white">
              <button onClick={() => { setSelectedStudent(null); setSelectedCourses(new Set()); }} className="px-5 py-2.5 rounded-xl font-bold text-sm text-slate-600 hover:bg-slate-100 border border-slate-200 transition-colors w-full sm:w-auto">Đóng</button>
              <button disabled={selectedCourses.size === 0 || isSubmittingTuition} onClick={handleProcessTuition} className="px-5 py-2.5 rounded-xl font-bold text-sm bg-blue-600 text-white hover:bg-blue-700 transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 w-full sm:w-auto">
                {isSubmittingTuition && <Loader2 size={16} className="animate-spin" />} Xác Nhận Đã Thu
              </button>
            </div>
          </div>
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
                <p className="text-[11px] font-bold text-slate-500 mb-3 uppercase tracking-widest text-center">Bạn có thể quét QR để CK nhanh <br/> (Nếu GV cung cấp STK)</p>
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
    </div>
  );
}