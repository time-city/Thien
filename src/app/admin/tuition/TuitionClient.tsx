"use client";

import { useMemo, useState, useEffect } from "react";
import { useAuth } from "@/lib/AuthContext";
import { QRCodeSVG } from "qrcode.react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { Loader2, TrendingUp, CreditCard, Wallet, CheckCircle2, Send, MessageCircle } from "lucide-react";
import type { TuitionStudentData } from "@/actions/queries";
import { payTeacherSalary, processStudentTuitionPayment, markMultipleReportsAsSent } from "@/actions/mutations";
import { getStudentCombinedReport, StudentCombinedReport } from "@/actions/report";
import { toPng } from "html-to-image";
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

  // Checkbox selection
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);
  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectedStudentIds(studentsWithLowSessions.map((s) => s.id));
    } else {
      setSelectedStudentIds([]);
    }
  };
  const handleSelectStudent = (id: string) => {
    setSelectedStudentIds((prev) =>
      prev.includes(id) ? prev.filter((sId) => sId !== id) : [...prev, id]
    );
  };

  // Bulk send logic
  const [isBulkSending, setIsBulkSending] = useState(false);
  const [bulkSendProgress, setBulkSendProgress] = useState({ current: 0, total: 0, currentName: "" });
  const [hiddenReportData, setHiddenReportData] = useState<any>(null); // To render hidden report for capturing
  const [showConfirmBulkSend, setShowConfirmBulkSend] = useState(false);

  const handleBulkSendClick = () => {
    if (selectedStudentIds.length === 0) return toast.error("Vui lòng chọn ít nhất 1 học sinh!");
    setShowConfirmBulkSend(true);
  };

  const startBulkSend = async () => {
    setIsBulkSending(true);
    let count = 0;
    
    for (const studentId of selectedStudentIds) {
      setBulkSendProgress({ current: count, total: selectedStudentIds.length, currentName: "Đang tải dữ liệu..." });
      
      try {
        const data = await getStudentCombinedReport(studentId);
        if (!data || !data.phoneParent) {
          console.warn("Bỏ qua học sinh vì không có dữ liệu hoặc số điện thoại:", studentId);
          count++;
          continue; 
        }
        
        setBulkSendProgress({ current: count, total: selectedStudentIds.length, currentName: data.studentName });
        
        // Set data and wait for DOM to render it
        setHiddenReportData(data);
        await new Promise(r => setTimeout(r, 3000)); // Cần 3 giây để load QR Code VietQR và render Font chữ
        
        const element = document.getElementById("hidden-report-export-area");
        if (element) {
          const dataUrl = await toPng(element, { 
            cacheBust: true, 
            pixelRatio: 2, 
            backgroundColor: "#ffffff",
            style: { transform: "scale(1)", transformOrigin: "top left" }
          });
          
          const res = await fetch(dataUrl);
          const blob = await res.blob();
          const file = new File([blob], `BaoCao_${data.studentName.replace(/\s+/g, "_")}.png`, { type: "image/png" });
          
          const formData = new FormData();
          formData.append("target", data.phoneParent);
          formData.append("image", file);
          formData.append("message", `Trung tâm gửi phụ huynh báo cáo học tập và thanh toán tổng hợp của bé ${data.studentName}`);

          const response = await fetch("/api/zalobot/send-image", { 
            method: "POST", 
            headers: {
              "x-api-key": process.env.NEXT_PUBLIC_ZALO_BOT_API_KEY || ""
            },
            body: formData 
          });
          if (!response.ok) {
             toast.error(`Lỗi gửi báo cáo cho ${data.studentName}`);
          } else {
             const logIds = data.logs.map((l: any) => l.id).filter(Boolean);
             if (logIds.length > 0) {
               await markMultipleReportsAsSent(logIds);
             }
          }
        }
      } catch (err) {
        toast.error(`Lỗi khi tạo ảnh hoặc gửi cho học sinh (ID: ${studentId})`);
      }
      
      count++;
      setBulkSendProgress({ current: count, total: selectedStudentIds.length, currentName: "Chờ..." });
      // Nghỉ 3 giây để tránh bị spam / rate limit của Zalo API
      await new Promise(r => setTimeout(r, 3000));
    }
    
    setIsBulkSending(false);
    setHiddenReportData(null);
    setSelectedStudentIds([]);
    toast.success("Đã hoàn tất quá trình gửi báo cáo Zalo hàng loạt!");
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
    <div className="p-2 md:p-8 max-w-6xl mx-auto font-sans">
      <div className="mb-4 md:mb-8 px-2 md:px-0">
        <h1 className="text-xl md:text-3xl font-extrabold text-slate-900 tracking-tight">Quản Lý Tài Chính</h1>
        <p className="text-slate-500 mt-1 text-xs md:text-sm font-medium">Thu học phí học sinh và Thanh toán lương giáo viên.</p>
      </div>

      <div className="flex border-b border-slate-200 mb-4 md:mb-6 font-bold text-xs md:text-sm overflow-x-auto hide-scrollbar px-2 md:px-0">
        <button
          onClick={() => setActiveTab("STUDENT")}
          className={`px-3 md:px-6 py-2 md:py-3 border-b-2 transition-colors whitespace-nowrap ${activeTab === "STUDENT" ? "border-blue-600 text-blue-700" : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
        >
          Thu Học Phí Học Sinh
        </button>
        <button
          onClick={() => setActiveTab("TEACHER_SALARY")}
          className={`px-3 md:px-6 py-2 md:py-3 border-b-2 transition-colors whitespace-nowrap ${activeTab === "TEACHER_SALARY" ? "border-blue-600 text-blue-700" : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
        >
          Thanh Toán Lương
        </button>
      </div>

      {/* TAB 1: THU HỌC PHÍ */}
      {activeTab === "STUDENT" && (
        <div className="space-y-4">
          <div className="flex justify-between items-center bg-blue-50 p-3 rounded-lg border border-blue-100">
            <div className="text-sm font-medium text-blue-800">
              Đã chọn <span className="font-bold">{selectedStudentIds.length}</span> học sinh
            </div>
            <button
              onClick={handleBulkSendClick}
              disabled={selectedStudentIds.length === 0 || isBulkSending}
              className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white px-4 py-2 rounded-lg font-bold text-sm flex items-center gap-2 transition-colors shadow-sm"
            >
              {isBulkSending ? <Loader2 size={16} className="animate-spin" /> : <MessageCircle size={16} />}
              {isBulkSending ? `Đang gửi (${bulkSendProgress.current}/${bulkSendProgress.total})` : "Gửi Báo Cáo Zalo Hàng Loạt"}
            </button>
          </div>

        <div className="bg-white border text-center border-slate-200 rounded-xl overflow-hidden shadow-sm">
          <table className="w-full text-left text-sm text-slate-700">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-900">
              <tr>
                <th className="py-2 px-2 md:py-3 md:px-4 w-8 md:w-10 text-center">
                  <input
                    type="checkbox"
                    className="w-3.5 h-3.5 md:w-4 md:h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                    checked={selectedStudentIds.length === studentsWithLowSessions.length && studentsWithLowSessions.length > 0}
                    disabled={isBulkSending}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedStudentIds(studentsWithLowSessions.map(s => s.id));
                      } else {
                        setSelectedStudentIds([]);
                      }
                    }}
                  />
                </th>
                <th className="py-2 px-2 md:py-3 md:px-4 font-bold text-xs md:text-sm">Học sinh</th>
                <th className="py-2 px-2 md:py-3 md:px-4 font-bold hidden sm:table-cell text-xs md:text-sm">Lớp</th>
                <th className="py-2 px-2 md:py-3 md:px-4 font-bold text-xs md:text-sm">Môn cảnh báo</th>
                <th className="py-2 px-2 md:py-3 md:px-4 font-bold text-right text-xs md:text-sm">Hành động</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {studentsWithLowSessions.map((student) => (
                <tr key={student.id} className={`hover:bg-slate-50/50 transition-colors ${selectedStudentIds.includes(student.id) ? "bg-blue-50/30" : ""}`}>
                  <td className="py-2 px-2 md:py-3 md:px-4 text-center">
                    <input
                      type="checkbox"
                      className="w-3.5 h-3.5 md:w-4 md:h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                      checked={selectedStudentIds.includes(student.id)}
                      disabled={isBulkSending}
                      onChange={() => handleSelectStudent(student.id)}
                    />
                  </td>
                  <td className="py-2 px-2 md:py-3 md:px-4">
                    <div className="font-semibold text-slate-900 flex flex-wrap items-center gap-1.5 md:gap-2 text-[13px] md:text-sm">
                      {student.fullName}
                      {student.hasLogs && student.hasUnsentReports === false && (
                         <span className="bg-emerald-100 text-emerald-700 text-[9px] md:text-[10px] px-1.5 py-0.5 rounded-full font-bold flex items-center gap-1">
                           <CheckCircle2 size={10} /> Đã gửi
                         </span>
                      )}
                      {!student.hasLogs && (
                         <span className="bg-blue-100 text-blue-700 text-[9px] md:text-[10px] px-1.5 py-0.5 rounded-full font-bold">
                           Chỉ nhắc nợ
                         </span>
                      )}
                    </div>
                    <div className="text-[10px] md:text-xs text-slate-500 mt-0.5">SĐT: {student.phoneParent || <span className="italic text-rose-400">Trống</span>}</div>
                  </td>
                  <td className="py-2 px-2 md:py-3 md:px-4 hidden sm:table-cell text-[13px] md:text-sm">
                    {student.enrolledCourses[0]?.className ?? (student.allPendingInvoices?.length ? (student.allPendingInvoices[0].isDebt ? "Nợ Cũ" : "Hóa đơn") : "-")}
                  </td>
                  <td className="py-2 px-2 md:py-3 md:px-4">
                    <div className="flex flex-wrap gap-1 md:gap-1.5 flex-col">
                      {student.enrolledCourses
                        .filter((c) => c.remainingSessions <= 2 || c.pendingInvoices.length > 0)
                        .map((c) => (
                          <div key={c.enrollmentId} className="flex gap-1 flex-wrap">
                            {c.remainingSessions <= 2 && (
                              <span
                                className="bg-rose-50 text-rose-700 font-bold px-1.5 md:px-2 py-0.5 rounded text-[10px] md:text-[11px] border border-rose-100 whitespace-nowrap"
                              >
                                {c.className} ({c.remainingSessions} buổi)
                              </span>
                            )}
                            {c.pendingInvoices.length > 0 && c.pendingInvoices.map(inv => (
                              <span key={inv.id} className={`${inv.status === "UNDERPAID" ? "bg-rose-100 text-rose-700 border-rose-200" : "bg-amber-100 text-amber-700 border-amber-200"} font-bold px-1.5 md:px-2 py-0.5 rounded text-[10px] md:text-[11px] border whitespace-nowrap`}>
                                {inv.status === "UNDERPAID" ? "THIẾU TIỀN" : "CHỜ T.TOÁN"}
                              </span>
                            ))}
                          </div>
                        ))}
                      
                      {/* Hiển thị các hóa đơn nợ/tổng hợp (không dính trực tiếp với 1 enrollment) */}
                      {student.allPendingInvoices?.map(inv => (
                        <div key={inv.id} className="flex gap-1 flex-wrap">
                          <span className="bg-orange-100 text-orange-700 border-orange-200 font-bold px-1.5 md:px-2 py-0.5 rounded text-[10px] md:text-[11px] border whitespace-nowrap">
                            {inv.isDebt ? "Nợ cũ" : "Hóa đơn"}: {new Intl.NumberFormat("vi-VN").format(inv.expectedAmount - inv.amountPaid)}đ
                          </span>
                        </div>
                      ))}
                    </div>
                  </td>
                  <td className="py-2 px-2 md:py-3 md:px-4 text-right">
                    <button
                      onClick={() => {
                        setReportData({ studentId: student.id, studentName: student.fullName, classId: "", className: "" });
                        setReportModalOpen(true);
                      }}
                      disabled={isBulkSending}
                      className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-1.5 px-2.5 md:px-4 rounded shadow-sm transition-colors text-[11px] md:text-xs whitespace-nowrap"
                    >
                      Xử lý
                    </button>
                  </td>
                </tr>
              ))}
              {studentsWithLowSessions.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-10 text-center text-slate-500 font-medium">
                    Không có học sinh nào cạn buổi học cần thu học phí lúc này.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        </div>
      )}

      {/* TAB 2: THANH TOÁN LƯƠNG GIÁO VIÊN (DẠNG LIST) */}
      {activeTab === "TEACHER_SALARY" && (
        <div className="flex flex-col gap-4">
          {teachers.map((teacher) => {
            const hasBalance = teacher.salaryBalance > 0;
            const initial = teacher.fullName.charAt(0).toUpperCase();

            return (
              <div key={teacher.id} className="bg-white border border-slate-200 rounded-2xl p-3 md:p-5 shadow-sm hover:shadow-md transition-all flex flex-col md:flex-row md:items-center gap-3 md:gap-6">

                {/* 1. Thông tin Giáo viên */}
                <div className="flex items-center gap-2.5 md:gap-3 md:w-1/4 shrink-0">
                  <div className="w-8 h-8 md:w-10 md:h-10 rounded-full bg-slate-800 text-white flex items-center justify-center font-bold text-xs md:text-sm shrink-0">
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
                    disabled={!hasBalance || isPayingSalary}
                    className={`w-full md:w-auto px-4 py-2 rounded-lg font-bold shadow-sm transition-all text-xs flex items-center justify-center gap-1.5 whitespace-nowrap ${hasBalance && !isPayingSalary ? "bg-slate-900 hover:bg-slate-800 text-white" : "bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200"
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

      {/* MODAL XÁC NHẬN GỬI HÀNG LOẠT */}
      {showConfirmBulkSend && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden flex flex-col animate-in zoom-in-95 duration-200">
            <div className="p-4 md:p-5 border-b border-slate-100 bg-slate-50">
              <h3 className="text-lg font-extrabold text-slate-900">Xác nhận gửi báo cáo</h3>
            </div>
            <div className="p-6 text-center text-slate-600 text-sm max-h-[70vh] overflow-y-auto">
              Bạn đã kiểm tra kỹ tình hình học tập và đánh giá của <span className="font-bold text-blue-600">{selectedStudentIds.length} học sinh</span> đã chọn chưa?
              <br /><br />
              
              <div className="text-left bg-slate-50 p-3 rounded-lg border border-slate-200 text-xs mb-4">
                <div className="font-bold mb-2">Danh sách gửi ({selectedStudentIds.length}):</div>
                <ul className="space-y-1 max-h-40 overflow-y-auto pr-2 custom-scrollbar">
                  {students.filter(s => selectedStudentIds.includes(s.id)).map(s => {
                    const alreadySent = s.hasLogs && s.hasUnsentReports === false;
                    const noLogsOnlyDebt = !s.hasLogs;
                    return (
                    <li key={s.id} className="flex justify-between border-b border-slate-100 pb-1 last:border-0 items-center">
                       <span className="font-medium text-left flex gap-1 items-center flex-wrap">
                         {s.fullName}
                         {alreadySent && <span className="text-amber-600 bg-amber-50 px-1 rounded text-[9px] font-bold border border-amber-200">Gửi lại</span>}
                         {noLogsOnlyDebt && <span className="text-blue-600 bg-blue-50 px-1 rounded text-[9px] font-bold border border-blue-200">Nhắc nợ</span>}
                       </span>
                       <span className={`font-mono text-right whitespace-nowrap ${s.phoneParent ? 'text-slate-600' : 'text-rose-500 font-bold'}`}>
                         {s.phoneParent || "Không có SĐT"}
                       </span>
                    </li>
                  )})}
                </ul>
              </div>

              Nếu đã chắc chắn, hệ thống sẽ tự động tổng hợp dữ liệu, tạo ảnh QR code và gửi qua Zalo tới phụ huynh. <br/> <strong className="text-rose-500">Vui lòng không tắt trang trong lúc đang gửi.</strong>
            </div>
            <div className="p-4 border-t border-slate-100 flex justify-end gap-3 bg-white">
              <button 
                onClick={() => setShowConfirmBulkSend(false)} 
                disabled={isBulkSending} 
                className="px-5 py-2.5 rounded-xl font-bold text-sm text-slate-600 hover:bg-slate-100 border border-slate-200 transition-colors w-full sm:w-auto disabled:opacity-50"
              >
                Hủy
              </button>
              <button 
                onClick={() => {
                  setShowConfirmBulkSend(false);
                  toast.info("Bắt đầu gửi báo cáo hàng loạt, vui lòng không đóng trang...");
                  startBulkSend();
                }} 
                disabled={isBulkSending} 
                className="px-5 py-2.5 rounded-xl font-bold text-sm bg-blue-600 text-white hover:bg-blue-700 transition-colors shadow-sm w-full sm:w-auto flex justify-center items-center gap-2 disabled:opacity-50"
              >
                Gửi Báo Cáo
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

      {/* INVISIBLE REPORT RENDERER FOR BULK SENDING */}
      {hiddenReportData && (
        <div className="fixed -left-[9999px] -top-[9999px] opacity-0 pointer-events-none">
          <div id="hidden-report-export-area" className="bg-white w-[800px] overflow-hidden border border-slate-200" style={{ fontFamily: "sans-serif" }}>
            {/* Header Bill */}
            <div className="bg-blue-600 p-6 text-white text-center">
              <h1 className="text-2xl font-black uppercase tracking-wider mb-1">TRUNG TÂM GIÁO DỤC</h1>
              <p className="text-blue-100 text-sm font-medium">BÁO CÁO HỌC TẬP & THANH TOÁN TỔNG HỢP</p>
            </div>

            {/* Info Section */}
            <div className="p-6 border-b border-slate-100">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-slate-500 mb-1 text-xs uppercase font-bold tracking-wider">Học sinh</p>
                  <p className="font-extrabold text-slate-800 text-lg">{hiddenReportData.studentName}</p>
                </div>
                <div>
                  <p className="text-slate-500 mb-1 text-xs uppercase font-bold tracking-wider">Mã Tra Cứu</p>
                  <p className="font-extrabold text-slate-800 text-lg">{hiddenReportData.studentId.substring(0, 8)}</p>
                </div>
              </div>
            </div>
            
            {/* QR Section */}
            <div className="bg-slate-50 p-6 flex items-center justify-between border-t border-slate-100">
              <div className="flex items-center gap-4">
                <div className="p-1 bg-white rounded-xl shadow-sm border border-slate-200">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img 
                    src={`https://qr.sepay.vn/img?bank=MBBank&acc=0700107189999&amount=${hiddenReportData.totalExpectedAmount}&des=${encodeURIComponent(`HT${hiddenReportData.phoneParent}`)}&template=`} 
                    alt="QR Code" 
                    crossOrigin="anonymous" 
                    className="w-24 h-24 object-contain" 
                  />
                </div>
                <div>
                  <p className="font-bold text-slate-800 flex items-center gap-2">
                    Quét mã thanh toán
                    <span className="bg-emerald-100 text-emerald-700 text-[10px] uppercase font-black px-2 py-0.5 rounded-full">
                      VietQR
                    </span>
                  </p>
                  <p className="text-sm text-slate-500 mt-1 mb-2">Học sinh: <span className="font-mono">{hiddenReportData.studentName}</span></p>
                </div>
              </div>
            </div>

            {/* Items Section */}
            <div className="p-6">
              <h3 className="text-sm font-bold text-slate-800 mb-4 uppercase tracking-wider border-l-4 border-blue-500 pl-3">Chi tiết các khoản thu</h3>
              <div className="space-y-3">
                {hiddenReportData.items.map((item: any, idx: number) => (
                  <div key={idx} className="flex justify-between items-center p-3 border border-slate-100 rounded-lg bg-slate-50/50">
                    <div>
                      <p className="font-bold text-slate-800 text-sm">
                        {item.type === "TUITION" ? `Học phí lớp: ${item.className}` : "Thanh toán nợ cũ (Kỳ trước)"}
                      </p>
                      {item.type === "TUITION" && (
                        <p className="text-xs text-slate-500 mt-0.5">Gia hạn thêm {item.sessionsPerPackage} buổi học</p>
                      )}
                    </div>
                    <div className="font-extrabold text-blue-700">
                      {item.amount.toLocaleString('vi-VN')} đ
                    </div>
                  </div>
                ))}
                <div className="flex justify-between items-center pt-3 border-t border-slate-200 mt-3 px-3">
                  <span className="font-bold text-slate-800 uppercase text-sm">Tổng thanh toán (chưa giảm giá):</span>
                  <span className="text-lg font-black text-blue-600">{hiddenReportData.totalExpectedAmount.toLocaleString('vi-VN')} đ</span>
                </div>
              </div>
            </div>

            {/* Logs Section (chỉ hiện nếu có log) */}
            {hiddenReportData.logs.length > 0 && (
              <div className="p-6 pt-0">
                <h3 className="text-sm font-bold text-slate-800 mb-4 uppercase tracking-wider border-l-4 border-emerald-500 pl-3">Tình hình học tập (Các lớp đang học)</h3>
                <div className="overflow-hidden border border-slate-200 rounded-xl">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-slate-50">
                      <tr>
                        <th className="py-3 px-4 font-bold text-slate-600 border-b border-slate-200">Lớp</th>
                        <th className="py-3 px-4 font-bold text-slate-600 border-b border-slate-200 w-24">Ngày</th>
                        <th className="py-3 px-4 font-bold text-slate-600 border-b border-slate-200 text-center">Điểm danh</th>
                        <th className="py-3 px-4 font-bold text-slate-600 border-b border-slate-200 text-center">Bài tập</th>
                        <th className="py-3 px-4 font-bold text-slate-600 border-b border-slate-200">Đánh giá</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {hiddenReportData.logs.slice(-5).map((log: any, i: number) => (
                        <tr key={i} className="hover:bg-slate-50/50">
                          <td className="py-2 px-4 text-slate-700 font-medium text-xs line-clamp-1">
                            {log.className}
                          </td>
                          <td className="py-2 px-4 text-slate-500 text-xs whitespace-nowrap">
                            {new Date(log.date).toLocaleDateString("vi-VN")}
                          </td>
                          <td className="py-2 px-4 text-center">
                            <span className={`text-[10px] font-bold px-2 py-1 rounded-md uppercase ${log.attendanceStatus === "PRESENT" ? "bg-emerald-100 text-emerald-700" :
                                log.attendanceStatus === "ABSENT" ? "bg-rose-100 text-rose-700" : "bg-amber-100 text-amber-700"
                              }`}>
                              {log.attendanceStatus === "PRESENT" ? "Có mặt" : log.attendanceStatus === "ABSENT" ? "Vắng" : "Có phép"}
                            </span>
                          </td>
                          <td className="py-2 px-4 text-center">
                            {log.homeworkStatus ? (
                              <span className={`text-[10px] font-bold px-2 py-1 rounded-md uppercase ${
                                log.homeworkStatus === "GOOD" ? "bg-blue-100 text-blue-700" :
                                log.homeworkStatus === "DONE" ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"
                              }`}>
                                {log.homeworkStatus === "GOOD" ? "Tốt" : log.homeworkStatus === "DONE" ? "Đã làm" : "Chưa làm"}
                              </span>
                            ) : (
                              <span className="text-slate-400 text-xs">-</span>
                            )}
                          </td>
                          <td className="py-2 px-4 text-slate-600 text-xs max-w-[200px] break-words">
                            {log.note || <span className="text-slate-400 italic">Không có</span>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Footer text */}
            <div className="bg-slate-800 text-slate-300 text-xs py-3 px-6 text-center">
              Cảm ơn Quý phụ huynh đã đồng hành cùng Trung tâm!
            </div>
          </div>
        </div>
      )}
    </div>
  );
}