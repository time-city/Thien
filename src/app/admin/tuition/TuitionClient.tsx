"use client";

import { useMemo, useState, useEffect, startTransition, useOptimistic } from "react";
import { useAuth } from "@/lib/AuthContext";
import { QRCodeSVG } from "qrcode.react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { Loader2, TrendingUp, CreditCard, Wallet, CheckCircle2, Send, MessageCircle, Download } from "lucide-react";
import type { TuitionStudentData } from "@/actions/queries";
import { processStudentTuitionPayment, markMultipleReportsAsSent } from "@/actions/mutations";
import { settleTeacherBalance, fetchTeachersFinance, getTeacherSalaryDetails } from "@/actions/teacher";
import { getStudentCombinedReport, StudentCombinedReport } from "@/actions/report";
import { toPng } from "html-to-image";
import CourseReportModal from "../students/CourseReportModal";

export type TeacherFinanceViewData = {
  id: string;
  username: string;
  fullName: string;
  phone: string | null;
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
  const [tuitionSubTab, setTuitionSubTab] = useState<"WARNING" | "PAID">("WARNING");

  const [students, setStudents] = useState<TuitionStudentData[]>(initialStudents);
  const [teachers, setTeachers] = useState<TeacherFinanceViewData[]>(initialTeachers);

  const [optimisticTeachers, addOptimisticTeacherUpdate] = useOptimistic(
    teachers,
    (state, updatedTeacherId: string) => {
      return state.map((t) =>
        t.id === updatedTeacherId
          ? { ...t, salaryBalance: 0, totalRoomFee: 0, totalEarned: 0 }
          : t
      );
    }
  );

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

  // Thêm state cho Tháng và Năm
  const currentDate = new Date();
  const [selectedMonth, setSelectedMonth] = useState<number>(currentDate.getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState<number>(currentDate.getFullYear());

  // Trigger load lại dữ liệu giáo viên khi thay đổi Tháng/Năm
  useEffect(() => {
    startTransition(() => {
      fetchTeachersFinance(selectedMonth, selectedYear).then((data) => {
        setTeachers(data);
      });
    });
  }, [selectedMonth, selectedYear]);

  const availableClasses = useMemo(() => {
    const classSet = new Set<string>();
    students.forEach(s => {
      s.enrolledCourses.forEach(c => {
        if (c.className) classSet.add(c.className);
      });
    });
    return Array.from(classSet).sort();
  }, [students]);

  const [searchTerm, setSearchTerm] = useState("");
  const [filterClass, setFilterClass] = useState("ALL");
  const [sortOption, setSortOption] = useState("DEFAULT");

  const processStudents = (studentList: TuitionStudentData[]) => {
    let processed = [...studentList];

    if (filterClass !== "ALL") {
      processed = processed.filter(s => 
        s.enrolledCourses.some(c => c.className === filterClass)
      );
    }

    if (searchTerm) {
      const lowerTerm = searchTerm.toLowerCase();
      processed = processed.filter(s => 
        (s.fullName && s.fullName.toLowerCase().includes(lowerTerm)) ||
        (s.parentName && s.parentName.toLowerCase().includes(lowerTerm)) ||
        (s.phoneStudent && s.phoneStudent.includes(searchTerm)) ||
        (s.phoneParent && s.phoneParent.includes(searchTerm))
      );
    }

    if (sortOption !== "DEFAULT") {
      processed.sort((a, b) => {
        if (sortOption === "FEE_ASC" || sortOption === "FEE_DESC") {
          const getFee = (s: TuitionStudentData) => {
            let total = 0;
            s.enrolledCourses.forEach(c => {
               total += c.pendingInvoices.reduce((acc, inv) => acc + (inv.expectedAmount - inv.amountPaid), 0);
            });
            if (s.allPendingInvoices) {
               total += s.allPendingInvoices.reduce((acc, inv) => acc + (inv.expectedAmount - inv.amountPaid), 0);
            }
            return total;
          };
          const feeA = getFee(a);
          const feeB = getFee(b);
          return sortOption === "FEE_ASC" ? feeA - feeB : feeB - feeA;
        }
        return 0;
      });
    }

    return processed;
  };
  const studentsWithLowSessions = useMemo(() => {
    return students.filter((s) =>
      s.enrolledCourses.some((c) => c.remainingSessions <= 2 || c.pendingInvoices.length > 0) ||
      (s.allPendingInvoices && s.allPendingInvoices.length > 0)
    );
  }, [students]);

  const rawPaidStudents = useMemo(() => {
    return students.filter((s) =>
      !s.enrolledCourses.some((c) => c.remainingSessions <= 2 || c.pendingInvoices.length > 0) &&
      (!s.allPendingInvoices || s.allPendingInvoices.length === 0)
    );
  }, [students]);

  const processedLowSessions = useMemo(() => processStudents(studentsWithLowSessions), [studentsWithLowSessions, searchTerm, sortOption, filterClass]);
  const paidStudents = useMemo(() => processStudents(rawPaidStudents), [rawPaidStudents, searchTerm, sortOption, filterClass]);

  const studentsNotSent = useMemo(() => processedLowSessions.filter(s => !(s.hasLogs && s.hasUnsentReports === false)), [processedLowSessions]);
  const studentsSent = useMemo(() => processedLowSessions.filter(s => s.hasLogs && s.hasUnsentReports === false), [processedLowSessions]);

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

        // Tải trước QR Code thành Base64 để tránh lỗi html-to-image bắt nhầm QR của học sinh trước
        const cleanPhone = data.phoneParent.replace(/\s+/g, '');
        const idSuffix = studentId.slice(-3).toUpperCase();
        const qrDescCode = data.phoneParent ? `HT${cleanPhone}${idSuffix}` : `HT${studentId}`;
        const qrUrl = `https://qr.sepay.vn/img?bank=MBBank&acc=0700107189999&amount=${data.totalExpectedAmount}&des=${encodeURIComponent(qrDescCode)}&template=`;
        try {
          const qrRes = await fetch(qrUrl);
          const qrBlob = await qrRes.blob();
          const qrBase64 = await new Promise<string>((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result as string);
            reader.readAsDataURL(qrBlob);
          });
          (data as any).qrBase64 = qrBase64;
        } catch (e) {
          console.error("Failed to prefetch QR code", e);
        }

        // Set data and wait for DOM to render it
        setHiddenReportData(data);
        await new Promise(r => setTimeout(r, 2000)); // Đợi render Font chữ và giao diện

        const element1 = document.getElementById("hidden-report-export-area-1");
        const element2 = document.getElementById("hidden-report-export-area-2");
        if (element1 && element2) {
          // ẢNH 1 (Chỉ gửi nếu có dữ liệu học tập)
          const hasLogs = data.logs && data.logs.length > 0;
          if (hasLogs) {
            const dataUrl1 = await toPng(element1, {
              cacheBust: true,
              pixelRatio: 2,
              backgroundColor: "#ffffff",
              style: { transform: "scale(1)", transformOrigin: "top left" }
            });
            const res1 = await fetch(dataUrl1);
            const blob1 = await res1.blob();
            const file1 = new File([blob1], `BaoCao_HocTap_${data.studentName.replace(/\s+/g, "_")}.png`, { type: "image/png" });

            const targetPhone = data.phoneParent.trim();
            const formData1 = new FormData();
            formData1.append("target", targetPhone);
            formData1.append("image", file1);

            const imageRes1 = await fetch("/api/zalobot/send-image", {
              method: "POST",
              headers: {
                "x-api-key": process.env.NEXT_PUBLIC_ZALO_BOT_API_KEY || ""
              },
              body: formData1
            });

            if (!imageRes1.ok) {
              const errText = await imageRes1.text().catch(() => "No text");
              console.error("Zalo Bot Image 1 Error:", imageRes1.status, errText);
              if (errText.includes("500") || errText.includes("400")) {
                toast.error(`Lỗi gửi ảnh học tập: Số điện thoại ${targetPhone} chưa đăng ký Zalo hoặc chặn tin nhắn.`, { duration: 6000 });
              } else {
                toast.error(`Lỗi gửi ảnh học tập cho ${data.studentName}`);
              }
              count++;
              continue;
            }
          }

          // ẢNH 2
          await new Promise(r => setTimeout(r, 1000));
          const dataUrl2 = await toPng(element2, {
            cacheBust: true,
            pixelRatio: 2,
            backgroundColor: "#ffffff",
            style: { transform: "scale(1)", transformOrigin: "top left" }
          });
          const res2 = await fetch(dataUrl2);
          const blob2 = await res2.blob();
          const file2 = new File([blob2], `BaoCao_HocPhi_${data.studentName.replace(/\s+/g, "_")}.png`, { type: "image/png" });

          // Generate message format
          let dateStr = "";
          if (hasLogs) {
            const dates = data.logs.map((l: any) => new Date(l.date));
            const minDate = new Date(Math.min(...dates.map(d => d.getTime())));
            const maxDate = new Date(Math.max(...dates.map(d => d.getTime())));
            dateStr = ` (từ ${minDate.getDate()}/${minDate.getMonth() + 1} - ${maxDate.getDate()}/${maxDate.getMonth() + 1})`;
          }
          const classNamesArray = data.items.filter((i: any) => i.type === "TUITION").map((i: any) => i.className);
          const classNames = classNamesArray.length > 0 ? classNamesArray.join("; ") : "Các lớp";
          const formattedPrice = data.totalExpectedAmount.toLocaleString('vi-VN');
          let descStr = `HT${studentId}`;
          if (data.phoneParent) {
            const cleanPhone = data.phoneParent.replace(/\s+/g, '');
            const suffix = studentId.slice(-3).toUpperCase();
            descStr = `HT${cleanPhone}${suffix}`;
          }

          const headerTitle = hasLogs ? `Báo cáo học tập${dateStr}.` : "Thông báo đóng học phí.";

          const message = `
Nông trại Khoa học tự nhiên kính gửi quý phụ huynh: ***${headerTitle}***
• Học sinh: ***${data.studentName}***
• Lớp đang học: ***${classNames}***

Phụ huynh thanh toán học phí (mã QR hoặc tiền mặt):
• Số tiền: ***${formattedPrice} vnđ***
• Nội dung chuyển khoản: ***${descStr}***

_Tin nhắn được thông báo tự động, phụ huynh có thể trao đổi thêm qua Zalo._`.trim();

          const targetPhone = data.phoneParent.trim();
          const formData2 = new FormData();
          formData2.append("target", targetPhone);
          formData2.append("image", file2);

          const imageRes2 = await fetch("/api/zalobot/send-image", {
            method: "POST",
            headers: {
              "x-api-key": process.env.NEXT_PUBLIC_ZALO_BOT_API_KEY || ""
            },
            body: formData2
          });

          if (!imageRes2.ok) {
            const errText = await imageRes2.text().catch(() => "No text");
            console.error("Zalo Bot Image 2 Error:", imageRes2.status, errText);
            if (errText.includes("500") || errText.includes("400") || imageRes2.status === 500) {
              toast.error(`Lỗi gửi ảnh học phí: Số điện thoại ${targetPhone} chưa đăng ký Zalo hoặc chặn tin nhắn.`, { duration: 6000 });
            } else {
              toast.error(`Lỗi gửi ảnh học phí cho ${data.studentName}`);
            }
            count++;
            continue;
          }

          // Nghỉ 2 giây để đảm bảo ảnh đã tới nơi rồi mới gửi text
          await new Promise(r => setTimeout(r, 2000));

          const textRes = await fetch("/api/zalobot/send", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-api-key": process.env.NEXT_PUBLIC_ZALO_BOT_API_KEY || ""
            },
            body: JSON.stringify({
              target: targetPhone,
              message: message
            }),
          });

          if (!textRes.ok) {
            const errText = await textRes.text().catch(() => "No text");
            console.error("Zalo Bot Text Error:", textRes.status, errText);
            toast.error(`Lỗi gửi tin nhắn văn bản cho ${data.studentName}`);
            count++;
            continue;
          }

          const logIds = data.logs ? data.logs.map((l: any) => l.id).filter(Boolean) : [];
          if (logIds.length > 0) {
            await markMultipleReportsAsSent(logIds);
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
    router.refresh();
  };

  // --- LOGIC THANH TOÁN LƯƠNG ---
  const handlePaySalary = () => {
    if (!selectedTeacher || selectedTeacher.salaryBalance <= 0) return;

    const teacherId = selectedTeacher.id;
    const amount = selectedTeacher.salaryBalance;
    const currentName = selectedTeacher.fullName;

    setSelectedTeacher(null);

    startTransition(async () => {
      addOptimisticTeacherUpdate(teacherId);
      try {
        const res = await settleTeacherBalance(teacherId, amount, "PAYOUT_SALARY", undefined, selectedMonth, selectedYear);
        if (res?.success === false) {
          toast.error(res.message || "Lỗi thanh toán lương");
        } else {
          toast.success(`Đã thanh toán ${formatCurrency(amount)} cho ${currentName}`);
          // Refresh from server action
          fetchTeachersFinance(selectedMonth, selectedYear).then(setTeachers);
          router.refresh();
        }
      } catch (error) {
        toast.error("Lỗi hệ thống");
      }
    });
  };

  const [isSendingZaloDebt, setIsSendingZaloDebt] = useState(false);
  const [teacherZaloPhone, setTeacherZaloPhone] = useState("");
  const [roomRentals, setRoomRentals] = useState<any[]>([]);
  const [teachingSessions, setTeachingSessions] = useState<any[]>([]);
  const [isLoadingRentalDetails, setIsLoadingRentalDetails] = useState(false);

  // Load chi tiết hóa đơn khi chọn giáo viên
  useEffect(() => {
    if (selectedTeacher) {
      setIsLoadingRentalDetails(true);
      getTeacherSalaryDetails(selectedTeacher.id, selectedMonth, selectedYear).then(data => {
        setRoomRentals(data.roomRentals);
        setTeachingSessions(data.teachingSessions);
        setIsLoadingRentalDetails(false);
      }).catch(() => {
        setIsLoadingRentalDetails(false);
        toast.error("Không thể tải chi tiết hóa đơn");
      });
    } else {
      setRoomRentals([]);
      setTeachingSessions([]);
    }
  }, [selectedTeacher, selectedMonth, selectedYear]);

  const handleDownloadRentalBill = async () => {
    const el = document.getElementById("hidden-room-rental-bill");
    if (!el) return;
    try {
      const dataUrl = await toPng(el, { cacheBust: true, backgroundColor: "#ffffff", pixelRatio: 2 });
      const a = document.createElement("a");
      a.href = dataUrl;
      const prefix = selectedTeacher?.salaryBalance && selectedTeacher.salaryBalance < 0 ? "HoaDon_Phong" : "Phieu_Luong";
      a.download = `${prefix}_${selectedTeacher?.fullName.replace(/\s+/g, "_")}_T${selectedMonth}.png`;
      a.click();
      toast.success("Đã tải xuống hóa đơn");
    } catch (err) {
      toast.error("Lỗi khi tải hóa đơn");
    }
  };

  const handleCollectDebtManual = () => {
    if (!selectedTeacher || selectedTeacher.salaryBalance >= 0) return;

    const teacherId = selectedTeacher.id;
    const amount = Math.abs(selectedTeacher.salaryBalance);
    const currentName = selectedTeacher.fullName;

    setSelectedTeacher(null);

    startTransition(async () => {
      addOptimisticTeacherUpdate(teacherId);
      try {
        const res = await settleTeacherBalance(teacherId, amount, "COLLECT_RENTAL", undefined, selectedMonth, selectedYear);
        if (res?.success === false) {
          toast.error(res.message || "Lỗi thu tiền");
        } else {
          toast.success(`Đã thu ${formatCurrency(amount)} tiền mặt từ ${currentName}`);
          fetchTeachersFinance(selectedMonth, selectedYear).then(setTeachers);
          router.refresh();
        }
      } catch (error) {
        toast.error("Lỗi hệ thống");
      }
    });
  };

  const handleSendZaloTeacher = async () => {
    if (!selectedTeacher || !teacherZaloPhone) return;
    setIsSendingZaloDebt(true);
    try {
      await new Promise(r => setTimeout(r, 1000)); // Cần 1 giây để load QR Code VietQR
      
      const isNegative = selectedTeacher.salaryBalance < 0;
      const elementId = "hidden-room-rental-bill";
      const element = document.getElementById(elementId);
      
      if (element) {
        const dataUrl = await toPng(element, {
          cacheBust: true,
          pixelRatio: 2,
          backgroundColor: "#ffffff",
          style: { transform: "scale(1)", transformOrigin: "top left" }
        });

        const res = await fetch(dataUrl);
        const blob = await res.blob();
        const prefix = isNegative ? "ThuTien" : "PhieuLuong";
        const file = new File([blob], `${prefix}_${selectedTeacher.username}.png`, { type: "image/png" });

        const formData = new FormData();
        formData.append("target", teacherZaloPhone);
        formData.append("image", file);
        
        let msg = "";
        if (isNegative) {
          msg = `Trung tâm gửi mã thanh toán cấn trừ tiền phòng / lương bị âm. Bạn vui lòng quét mã này để thanh toán.\nSố tiền: ${new Intl.NumberFormat("vi-VN").format(Math.abs(selectedTeacher.salaryBalance))}đ\nNội dung CK: HT ${selectedTeacher.phone || teacherZaloPhone || selectedTeacher.username}`;
        } else {
          msg = `Trung tâm thanh toán lương tháng ${selectedMonth} năm ${selectedYear} cho giáo viên. Kèm theo Bảng kê chi tiết. Xin cảm ơn bạn đã đồng hành!`;
        }
        formData.append("message", msg);

        const response = await fetch("/api/zalobot/send-image", {
          method: "POST",
          headers: {
            "x-api-key": process.env.NEXT_PUBLIC_ZALO_BOT_API_KEY || ""
          },
          body: formData
        });
        
        if (!response.ok) {
          const errText = await response.text().catch(() => "No text");
          if (errText.includes("500") || errText.includes("400")) {
            toast.error(`Lỗi: Số điện thoại ${teacherZaloPhone} chưa đăng ký Zalo hoặc chặn tin nhắn.`, { duration: 6000 });
          } else {
            toast.error(`Lỗi gửi Zalo cho ${selectedTeacher.fullName}`);
          }
        } else {
          toast.success(`Đã gửi Zalo ${isNegative ? "mã thu tiền" : "báo cáo lương"} cho: ${teacherZaloPhone}`);
          if (!isNegative) {
            handlePaySalary(); // Tự động xác nhận đã chuyển sau khi gửi Zalo báo cáo
          }
        }
      }
    } catch (err) {
      toast.error(`Lỗi tạo ảnh QR hoặc gửi Zalo`);
    } finally {
      setIsSendingZaloDebt(false);
    }
  };

  const renderStudentTable = (list: TuitionStudentData[], type: "WARNING" | "PAID") => (
    <table className="w-full text-left text-sm text-slate-700">
      <thead className="bg-slate-50 border-b border-slate-200 text-slate-900">
        <tr>
          <th className="py-2 px-2 md:py-3 md:px-4 w-8 md:w-10 text-center">
            <input
              type="checkbox"
              className="w-3.5 h-3.5 md:w-4 md:h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
              checked={list.length > 0 && list.every(s => selectedStudentIds.includes(s.id))}
              disabled={isBulkSending}
              onChange={(e) => {
                if (e.target.checked) {
                  const newIds = list.map(s => s.id);
                  setSelectedStudentIds(Array.from(new Set([...selectedStudentIds, ...newIds])));
                } else {
                  setSelectedStudentIds(selectedStudentIds.filter(id => !list.find(s => s.id === id)));
                }
              }}
            />
          </th>
          <th className="py-2 px-2 md:py-3 md:px-4 font-bold text-xs md:text-sm">Học sinh</th>
          <th className="py-2 px-2 md:py-3 md:px-4 font-bold hidden sm:table-cell text-xs md:text-sm">Lớp</th>
          <th className="py-2 px-2 md:py-3 md:px-4 font-bold text-xs md:text-sm">
            {type === "WARNING" ? "Môn cảnh báo" : "Thông tin thẻ học"}
          </th>
          <th className="py-2 px-2 md:py-3 md:px-4 font-bold text-right text-xs md:text-sm">Hành động</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-slate-100">
        {list.map((student) => (
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
                {type === "WARNING" && student.hasLogs && student.hasUnsentReports === false && (
                  <span className="bg-emerald-100 text-emerald-700 text-[9px] md:text-[10px] px-1.5 py-0.5 rounded-full font-bold flex items-center gap-1">
                    <CheckCircle2 size={10} /> Đã gửi {student.lastReportedAt ? `(${new Date(student.lastReportedAt).toLocaleString("vi-VN", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit", year: "numeric" })})` : ''}
                  </span>
                )}
                {type === "WARNING" && !student.hasLogs && (
                  <span className="bg-blue-100 text-blue-700 text-[9px] md:text-[10px] px-1.5 py-0.5 rounded-full font-bold">
                    Chỉ nhắc nợ
                  </span>
                )}
              </div>
              <div className="text-[10px] md:text-xs text-slate-500 mt-0.5">SĐT: {student.phoneParent || <span className="italic text-rose-400">Trống</span>}</div>
            </td>
            <td className="py-2 px-2 md:py-3 md:px-4 hidden sm:table-cell text-[13px] md:text-sm">
              {student.enrolledCourses.length > 0
                ? student.enrolledCourses.map((c) => c.className).join(", ")
                : (student.allPendingInvoices?.length ? (student.allPendingInvoices[0].isDebt ? "Nợ Cũ" : "Hóa đơn") : "-")}
            </td>
            <td className="py-2 px-2 md:py-3 md:px-4">
              <div className="flex flex-wrap gap-1 md:gap-1.5 flex-col">
                {type === "WARNING" ? (
                  <>
                    {student.enrolledCourses
                      .filter((c) => c.remainingSessions <= 2)
                      .map((c) => (
                        <div key={c.enrollmentId} className="flex gap-1 flex-wrap">
                          <span
                            className="bg-rose-50 text-rose-700 font-bold px-1.5 md:px-2 py-0.5 rounded text-[10px] md:text-[11px] border border-rose-100 whitespace-nowrap"
                          >
                            {c.className} ({c.remainingSessions} buổi)
                          </span>
                        </div>
                      ))}
                  </>
                ) : (
                  <>
                    {student.enrolledCourses.map((c) => (
                      <div key={c.enrollmentId} className="flex gap-1 flex-wrap">
                        <span className="bg-emerald-50 text-emerald-700 font-bold px-1.5 md:px-2 py-0.5 rounded text-[10px] md:text-[11px] border border-emerald-200 whitespace-nowrap">
                          {c.className}: Còn {c.remainingSessions} phiếu
                        </span>
                      </div>
                    ))}
                  </>
                )}
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
        {list.length === 0 && (
          <tr>
            <td colSpan={5} className="py-10 text-center text-slate-500 font-medium">
              Không có học sinh nào trong danh sách này.
            </td>
          </tr>
        )}
      </tbody>
    </table>
  );

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
          <div className="flex gap-4 border-b border-slate-200 px-2 md:px-0 mb-4">
            <button 
              onClick={() => setTuitionSubTab("WARNING")}
              className={`py-2 border-b-2 font-bold text-sm transition-colors whitespace-nowrap ${tuitionSubTab === "WARNING" ? "border-amber-500 text-amber-700" : "border-transparent text-slate-500 hover:text-slate-800"}`}
            >
              Cần nhắc nhở / Thu phí ({studentsWithLowSessions.length})
            </button>
            <button 
              onClick={() => setTuitionSubTab("PAID")}
              className={`py-2 border-b-2 font-bold text-sm transition-colors whitespace-nowrap ${tuitionSubTab === "PAID" ? "border-emerald-500 text-emerald-700" : "border-transparent text-slate-500 hover:text-slate-800"}`}
            >
              Học sinh đã thanh toán / An toàn ({rawPaidStudents.length})
            </button>
          </div>

          {/* Thanh Filter & Sort */}
          <div className="flex flex-col sm:flex-row gap-3 px-2 md:px-0 mb-4 items-center">
            <input
              type="text"
              placeholder="Tìm kiếm Tên HS, Phụ huynh, SĐT..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full sm:flex-1 p-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
            <select
              value={filterClass}
              onChange={(e) => setFilterClass(e.target.value)}
              className="w-full sm:w-auto p-2 border border-slate-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="ALL">Tất cả lớp</option>
              {availableClasses.map(cls => (
                <option key={cls} value={cls}>{cls}</option>
              ))}
            </select>
          </div>

          {tuitionSubTab === "WARNING" && (
            <>
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

              {/* BẢNG CHƯA GỬI */}
              <div className="bg-white border text-center border-slate-200 rounded-xl overflow-hidden shadow-sm mb-6">
                <div className="bg-amber-50 border-b border-amber-100 p-3 text-left font-bold text-amber-800 text-sm flex justify-between items-center">
                  <span>Cần nhắc nhở / Gửi báo cáo ({studentsNotSent.length})</span>
                </div>
                {renderStudentTable(studentsNotSent, "WARNING")}
              </div>

              {/* BẢNG ĐÃ GỬI */}
              {studentsSent.length > 0 && (
                <div className="bg-white border text-center border-slate-200 rounded-xl overflow-hidden shadow-sm">
                  <div className="bg-emerald-50 border-b border-emerald-100 p-3 text-left font-bold text-emerald-800 text-sm">
                    Đã gửi báo cáo gần đây ({studentsSent.length})
                  </div>
                  {renderStudentTable(studentsSent, "WARNING")}
                </div>
              )}
            </>
          )}

          {tuitionSubTab === "PAID" && (
            <div className="bg-white border text-center border-slate-200 rounded-xl overflow-hidden shadow-sm">
              <div className="bg-emerald-50 border-b border-emerald-100 p-3 text-left font-bold text-emerald-800 text-sm flex justify-between items-center">
                <span>Danh sách học sinh an toàn ({paidStudents.length})</span>
              </div>
              {renderStudentTable(paidStudents, "PAID")}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: THANH TOÁN LƯƠNG GIÁO VIÊN (DẠNG LIST) */}
      {activeTab === "TEACHER_SALARY" && (
        <div className="flex flex-col gap-4">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-white p-4 rounded-2xl border border-slate-200 shadow-sm gap-4">
            <h2 className="text-lg font-bold text-slate-800">Lương Giáo Viên</h2>
            <div className="flex items-center gap-2">
              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(Number(e.target.value))}
                className="bg-slate-50 border border-slate-200 text-slate-800 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block p-2 font-semibold"
              >
                {Array.from({ length: 12 }).map((_, i) => (
                  <option key={i + 1} value={i + 1}>
                    Tháng {i + 1}
                  </option>
                ))}
              </select>
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(Number(e.target.value))}
                className="bg-slate-50 border border-slate-200 text-slate-800 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block p-2 font-semibold"
              >
                {[currentDate.getFullYear() - 1, currentDate.getFullYear(), currentDate.getFullYear() + 1].map((y) => (
                  <option key={y} value={y}>
                    Năm {y}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {optimisticTeachers.map((teacher) => {
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
                  ) : teacher.salaryBalance < 0 ? (
                    <span className="bg-rose-100 text-rose-700 font-extrabold px-2 py-1 rounded text-[10px] uppercase tracking-wider whitespace-nowrap">Thực Nhận Âm</span>
                  ) : (
                    <span className="bg-slate-100 text-slate-500 font-extrabold px-2 py-1 rounded text-[10px] uppercase tracking-wider whitespace-nowrap">Đã Tất Toán</span>
                  )}

                  <button
                    onClick={() => {
                      setSelectedTeacher(teacher);
                      const initialPhone = (teacher.phone || teacher.username).replace(/\D/g, '');
                      setTeacherZaloPhone(initialPhone);
                    }}
                    disabled={teacher.salaryBalance === 0}
                    className={`w-full md:w-auto px-4 py-2 rounded-lg font-bold shadow-sm transition-all text-xs flex items-center justify-center gap-1.5 whitespace-nowrap ${hasBalance
                      ? "bg-slate-900 hover:bg-slate-800 text-white"
                      : teacher.salaryBalance < 0
                        ? "bg-rose-600 hover:bg-rose-700 text-white"
                        : "bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200"
                      }`}
                  >
                    {teacher.salaryBalance < 0 ? "Thu Tiền" : "Thanh Toán"}
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
      {/* MODAL THANH TOÁN LƯƠNG HOẶC THU TIỀN GIÁO VIÊN */}
      {selectedTeacher && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200" onClick={() => setSelectedTeacher(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden flex flex-col animate-in zoom-in-95 duration-200" onClick={(e) => e.stopPropagation()}>
            <div className="p-4 md:p-5 border-b border-slate-100 bg-slate-50">
              <h3 className="text-lg font-extrabold text-slate-900">
                {selectedTeacher.salaryBalance < 0 ? "Thu Phí Phòng (Giáo Viên)" : "Chi Trả Lương Giáo Viên"}
              </h3>
              <p className="text-sm text-slate-500 mt-0.5 font-medium">Người nhận: <span className="font-bold text-slate-700">{selectedTeacher.fullName}</span></p>
            </div>
            <div className="p-6 flex flex-col items-center">
              <div className="mb-2 text-center w-full">
                <p className="text-sm font-semibold text-slate-500 mb-1">
                  {selectedTeacher.salaryBalance < 0 ? "Số tiền giáo viên cần đóng" : "Số tiền cần thanh toán"}
                </p>
                <div className={`p-4 rounded-xl border mt-2 ${selectedTeacher.salaryBalance < 0 ? "bg-rose-50 border-rose-100" : "bg-blue-50 border-blue-100"}`}>
                  <p className={`text-3xl font-extrabold tracking-tight ${selectedTeacher.salaryBalance < 0 ? "text-rose-600" : "text-blue-600"}`}>
                    {formatCurrency(Math.abs(selectedTeacher.salaryBalance))}
                  </p>
                </div>
              </div>

              <div className="w-full mt-4 text-left">
                <label className="block text-xs font-bold text-slate-700 mb-1">Gửi Zalo (Bắt buộc nhập SĐT)</label>
                {!selectedTeacher.phone && (
                  <div className="text-[11px] text-amber-600 bg-amber-50 p-2 rounded-lg border border-amber-200 mb-2 font-medium">
                    ⚠️ Giáo viên này chưa cập nhật SĐT. Vui lòng nhập SĐT bằng số để tiếp tục gửi Zalo.
                  </div>
                )}
                <div className="flex gap-2">
                  <input
                    type="tel"
                    value={teacherZaloPhone}
                    onChange={e => setTeacherZaloPhone(e.target.value.replace(/\D/g, ''))}
                    placeholder="Nhập SĐT Zalo GV..."
                    className={`flex-1 text-sm border rounded px-2 py-1.5 focus:outline-none focus:border-blue-500 ${!selectedTeacher.phone && !teacherZaloPhone ? "border-rose-300 bg-rose-50" : "border-slate-200 bg-white"}`}
                  />
                  <button
                    onClick={handleSendZaloTeacher}
                    disabled={isSendingZaloDebt || !teacherZaloPhone}
                    className="bg-[#0068FF] hover:bg-blue-700 text-white px-3 py-1.5 rounded font-bold text-xs flex items-center gap-1 disabled:opacity-50 transition-colors shrink-0"
                  >
                    {isSendingZaloDebt ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />} 
                    {selectedTeacher.salaryBalance < 0 ? "Gửi Zalo" : "Gửi Báo Cáo Zalo"}
                  </button>
                </div>
                {selectedTeacher.salaryBalance < 0 ? (
                  <p className="text-[10px] text-slate-400 mt-1 italic">* Tin nhắn Zalo sẽ chứa mã QR VietQR tự động khớp thanh toán qua Webhook.</p>
                ) : (
                  <p className="text-[10px] text-slate-400 mt-1 italic">* Tin nhắn Zalo sẽ gửi kèm Bảng Kê Lương chi tiết và tự động chốt lương thành công.</p>
                )}
              </div>
              
              {/* Nút Xuất Hóa Đơn luôn hiện cho Giáo viên, bất kể âm dương để in Bảng Kê Lương / Phí */}
              <div className="mt-6 flex flex-col items-center w-full">
                <button 
                  onClick={handleDownloadRentalBill}
                  disabled={isLoadingRentalDetails || (roomRentals.length === 0 && teachingSessions.length === 0)}
                  className="w-full bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-2 rounded-lg font-bold text-xs flex items-center justify-center gap-2 transition-colors border border-slate-300 disabled:opacity-50"
                >
                  {isLoadingRentalDetails ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
                  Xuất Bảng Kê Chi Tiết (Tải Ảnh)
                </button>
              </div>
            </div>
            <div className="p-4 border-t border-slate-100 flex justify-end gap-3 bg-white">
              <button onClick={() => setSelectedTeacher(null)} className="px-5 py-2.5 rounded-xl font-bold text-sm text-slate-600 hover:bg-slate-100 border border-slate-200 transition-colors w-full sm:w-auto">Hủy</button>

              {selectedTeacher.salaryBalance < 0 ? (
                <button onClick={handleCollectDebtManual} className="px-5 py-2.5 rounded-xl font-bold text-sm bg-rose-600 text-white hover:bg-rose-700 transition-colors shadow-sm flex items-center justify-center gap-2 w-full sm:w-auto">
                  Đã Thu Tiền Mặt
                </button>
              ) : (
                <button onClick={handlePaySalary} className="px-5 py-2.5 rounded-xl font-bold text-sm bg-slate-900 text-white hover:bg-slate-800 transition-colors shadow-sm flex items-center justify-center gap-2 w-full sm:w-auto">
                  Xác Nhận Đã Chuyển
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ẨN: HÓA ĐƠN TIỀN PHÒNG / BẢNG KÊ LƯƠNG ĐỂ RENDER IMAGE */}
      {selectedTeacher && (roomRentals.length > 0 || teachingSessions.length > 0) && (
        <div style={{ position: "fixed", top: "-9999px", left: "-9999px", zIndex: -9999 }}>
          <div id="hidden-room-rental-bill" className="bg-white p-6 w-[700px] border border-slate-200" style={{ fontFamily: "sans-serif" }}>
            <div className="text-center mb-6 border-b pb-4 border-slate-200 text-slate-800">
              <h1 className={`text-2xl font-black uppercase mb-1 ${selectedTeacher.salaryBalance < 0 ? "text-rose-600" : "text-blue-600"}`}>
                {selectedTeacher.salaryBalance < 0 ? "Phiếu Thu Tiền Phòng" : "Bảng Kê Lương & Phí"}
              </h1>
              <p className="text-sm font-semibold">Tháng {selectedMonth} năm {selectedYear}</p>
            </div>
            <div className="mb-4 text-sm text-slate-800 flex justify-between">
              <div>
                <p><strong>Giáo viên:</strong> {selectedTeacher.fullName}</p>
                <p><strong>Số điện thoại:</strong> {selectedTeacher.phone || "Không có"}</p>
              </div>
            </div>

            {/* BẢNG CA DẠY */}
            {teachingSessions.length > 0 && (
              <div className="mb-6">
                <h3 className="text-sm font-bold text-slate-800 mb-2 uppercase tracking-wider border-l-4 border-blue-500 pl-2">Chi tiết ca dạy</h3>
                <table className="w-full text-left text-xs border-collapse border border-slate-300">
                  <thead>
                    <tr className="bg-slate-100 text-slate-700">
                      <th className="border border-slate-300 p-2">Ngày</th>
                      <th className="border border-slate-300 p-2">Lớp học</th>
                      <th className="border border-slate-300 p-2 text-center">Giờ</th>
                      <th className="border border-slate-300 p-2 text-right">Lương/ca</th>
                    </tr>
                  </thead>
                  <tbody className="text-slate-800 font-medium">
                    {teachingSessions.map((item, idx) => (
                      <tr key={idx} className="border-b border-slate-300">
                        <td className="border border-slate-300 p-2">{new Date(item.date).toLocaleDateString('vi-VN')}</td>
                        <td className="border border-slate-300 p-2">{item.className}</td>
                        <td className="border border-slate-300 p-2 text-center">
                          {new Date(item.startTime).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })} - {new Date(item.endTime).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                        </td>
                        <td className="border border-slate-300 p-2 text-right text-blue-600">{item.salaryPerSession.toLocaleString('vi-VN')}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="font-bold bg-blue-50 text-blue-700">
                      <td colSpan={3} className="border border-slate-300 p-2 text-right uppercase">Tổng Lương Dạy:</td>
                      <td className="border border-slate-300 p-2 text-right text-sm">{teachingSessions.reduce((sum, s) => sum + s.salaryPerSession, 0).toLocaleString('vi-VN')}đ</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}

            {/* BẢNG PHÍ PHÒNG */}
            {roomRentals.length > 0 && (
              <div className="mb-6">
                <h3 className="text-sm font-bold text-slate-800 mb-2 uppercase tracking-wider border-l-4 border-rose-500 pl-2">Chi tiết phí thuê phòng</h3>
                <table className="w-full text-left text-xs border-collapse border border-slate-300">
                  <thead>
                    <tr className="bg-slate-100 text-slate-700">
                      <th className="border border-slate-300 p-2">Ngày</th>
                      <th className="border border-slate-300 p-2">Phòng</th>
                      <th className="border border-slate-300 p-2 text-center">Giờ</th>
                      <th className="border border-slate-300 p-2 text-center">Số giờ</th>
                      <th className="border border-slate-300 p-2 text-right">Đơn giá</th>
                      <th className="border border-slate-300 p-2 text-right">Thành tiền</th>
                    </tr>
                  </thead>
                  <tbody className="text-slate-800 font-medium">
                    {roomRentals.map((item, idx) => (
                      <tr key={idx} className="border-b border-slate-300">
                        <td className="border border-slate-300 p-2">{new Date(item.date).toLocaleDateString('vi-VN')}</td>
                        <td className="border border-slate-300 p-2">{item.roomName}</td>
                        <td className="border border-slate-300 p-2 text-center">
                          {new Date(item.startTime).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })} - {new Date(item.endTime).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                        </td>
                        <td className="border border-slate-300 p-2 text-center">{item.durationHours}h</td>
                        <td className="border border-slate-300 p-2 text-right">{item.unitPrice.toLocaleString('vi-VN')}</td>
                        <td className="border border-slate-300 p-2 text-right text-rose-600">{item.feeCalculated.toLocaleString('vi-VN')}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="font-bold bg-rose-50 text-rose-700">
                      <td colSpan={5} className="border border-slate-300 p-2 text-right uppercase">Tổng Phí Phòng:</td>
                      <td className="border border-slate-300 p-2 text-right text-sm">{roomRentals.reduce((sum, r) => sum + r.feeCalculated, 0).toLocaleString('vi-VN')}đ</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}

            <div className={`p-4 mt-4 text-right rounded-lg border ${selectedTeacher.salaryBalance < 0 ? "bg-rose-50 border-rose-200" : "bg-emerald-50 border-emerald-200"}`}>
              <span className="font-bold text-slate-700 uppercase mr-4">
                {selectedTeacher.salaryBalance < 0 ? "Số tiền giáo viên cần đóng:" : "Thực nhận của giáo viên:"}
              </span>
              <span className={`text-xl font-black ${selectedTeacher.salaryBalance < 0 ? "text-rose-600" : "text-emerald-600"}`}>
                {Math.abs(selectedTeacher.salaryBalance).toLocaleString('vi-VN')}đ
              </span>
            </div>

            {selectedTeacher.salaryBalance < 0 && (
              <div className="mt-6 pt-6 border-t border-slate-200">
                <div className="flex flex-col items-center">
                  <h3 className="font-bold text-slate-800 mb-3 uppercase tracking-wider text-sm">Quét mã thanh toán tiền phòng</h3>
                  <div className="p-2 bg-white rounded-xl shadow-sm border border-slate-200 mb-3">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={`https://qr.sepay.vn/img?bank=MBBank&acc=0700107189999&amount=${Math.abs(selectedTeacher.salaryBalance)}&des=${encodeURIComponent(`HT ${selectedTeacher.phone || teacherZaloPhone || selectedTeacher.username}`)}&template=`}
                      alt="QR Code"
                      crossOrigin="anonymous"
                      className="w-40 h-40 object-contain"
                    />
                  </div>
                  <div className="text-center w-full">
                    <p className="text-xs text-slate-500 mb-1">Nội dung chuyển khoản (bắt buộc):</p>
                    <p className="text-lg font-bold text-slate-900 tracking-widest bg-slate-50 border border-slate-100 py-2 rounded-lg">
                      HT {selectedTeacher.phone || teacherZaloPhone || selectedTeacher.username}
                    </p>
                  </div>
                </div>
              </div>
            )}

            <div className="text-center text-xs italic text-slate-500 mt-6 pt-4 border-t border-slate-100">
              Cảm ơn giáo viên đã đồng hành cùng Nông trại Khoa học tự nhiên!
            </div>
          </div>
        </div>
      )}

      {/* MODAL XÁC NHẬN GỬI HÀNG LOẠT */}
      {showConfirmBulkSend && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm animate-in fade-in duration-200" onClick={() => setShowConfirmBulkSend(false)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden flex flex-col animate-in zoom-in-95 duration-200" onClick={(e) => e.stopPropagation()}>
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
                    )
                  })}
                </ul>
              </div>

              Nếu đã chắc chắn, hệ thống sẽ tự động tổng hợp dữ liệu, tạo ảnh QR code và gửi qua Zalo tới phụ huynh. <br /> <strong className="text-rose-500">Vui lòng không tắt trang trong lúc đang gửi.</strong>
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
          classId={reportData.classId}
          studentName={reportData.studentName}
          className={reportData.className}
          onSuccess={() => router.refresh()}
        />
      )}

      {/* INVISIBLE REPORT RENDERER FOR BULK SEND */}
      {hiddenReportData && (
        <div className="fixed -left-[9999px] -top-[9999px] opacity-0 pointer-events-none flex flex-col gap-8">
          {/* Ảnh 1: Thông tin và Lịch sử học tập */}
          <div id="hidden-report-export-area-1" className="bg-white w-[800px] overflow-hidden border border-slate-200" style={{ fontFamily: "sans-serif" }}>
            {/* Header Bill */}
            <div className="bg-blue-600 p-6 text-white text-center">
              <h1 className="text-2xl font-black uppercase tracking-wider mb-1">Farm Edu</h1>
              <p className="text-blue-100 text-sm font-medium">BÁO CÁO HỌC TẬP</p>
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

            {/* Logs Section (chỉ hiện nếu có log) */}
            {hiddenReportData.logs.length > 0 && (
              <div className="p-6 border-b border-slate-100">
                <h3 className="text-sm font-bold text-slate-800 mb-4 uppercase tracking-wider border-l-4 border-emerald-500 pl-3">Tình hình học tập (Các lớp đang học)</h3>
                <div className="overflow-hidden border border-slate-200 rounded-xl">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-slate-50">
                      <tr>
                        <th className="py-3 px-4 font-bold text-slate-600 border-b border-slate-200 whitespace-nowrap">Lớp</th>
                        <th className="py-3 px-4 font-bold text-slate-600 border-b border-slate-200 whitespace-nowrap">Ngày</th>
                        <th className="py-3 px-4 font-bold text-slate-600 border-b border-slate-200 text-center whitespace-nowrap">Điểm danh</th>
                        <th className="py-3 px-4 font-bold text-slate-600 border-b border-slate-200 text-center whitespace-nowrap">Bài tập</th>
                        <th className="py-3 pl-4 pr-8 font-bold text-slate-600 border-b border-slate-200 whitespace-nowrap text-left">Đánh giá</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {hiddenReportData.logs.map((log: any, i: number) => (
                        <tr key={i} className="hover:bg-slate-50/50">
                          <td className="py-2 px-4 text-slate-700 font-medium text-xs align-top">
                            <div className="line-clamp-1">{log.className}</div>
                          </td>
                          <td className="py-2 px-4 text-slate-500 text-xs whitespace-nowrap align-top">
                            {new Date(log.date).toLocaleDateString("vi-VN")}
                          </td>
                          <td className="py-2 px-4 text-center whitespace-nowrap align-top">
                            <span className={`text-[10px] font-bold px-2 py-1 rounded-md uppercase ${log.attendanceStatus === "PRESENT" ? "bg-emerald-100 text-emerald-700" :
                              log.attendanceStatus === "ABSENT" ? "bg-rose-100 text-rose-700" : "bg-amber-100 text-amber-700"
                              }`}>
                              {log.attendanceStatus === "PRESENT" ? "Có mặt" : log.attendanceStatus === "ABSENT" ? "Vắng" : "Có phép"}
                            </span>
                          </td>
                          <td className="py-2 px-4 text-center whitespace-nowrap align-top">
                            {log.homeworkStatus ? (
                              <span className={`text-[10px] font-bold px-2 py-1 rounded-md uppercase ${log.homeworkStatus === "GOOD" ? "bg-emerald-100 text-emerald-700" :
                                log.homeworkStatus === "DONE" ? "bg-amber-100 text-amber-700" : "bg-rose-100 text-rose-700"
                                }`}>
                                {log.homeworkStatus === "GOOD" ? "Đạt" : log.homeworkStatus === "DONE" ? "Không đạt" : "Không làm"}
                              </span>
                            ) : (
                              <span className="text-slate-400 text-xs">-</span>
                            )}
                          </td>
                          <td className="py-2 pl-4 pr-6 text-slate-600 text-xs whitespace-pre-wrap break-all align-top">
                            {log.note || <span className="text-slate-400 italic">Không có</span>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="text-xs text-center text-slate-500 mt-2 font-medium">
                  Tổng số buổi chưa báo cáo: {hiddenReportData.logs.length} buổi
                </p>
              </div>
            )}
          </div>

          {/* Ảnh 2: Chi tiết khoản thu và mã QR */}
          <div id="hidden-report-export-area-2" className="bg-white w-[800px] overflow-hidden border border-slate-200" style={{ fontFamily: "sans-serif" }}>
            <div className="bg-blue-600 p-4 text-white text-center">
              <h2 className="text-lg font-black uppercase tracking-wider mb-1">CHI TIẾT HỌC PHÍ</h2>
              <p className="text-blue-100 text-xs font-medium">Học sinh: {hiddenReportData.studentName}</p>
            </div>
            {/* 2 Columns: Items & QR */}
            <div className="p-6 flex flex-row gap-6 items-stretch">
              {/* Items Section */}
              <div className="w-1/2">
                <h3 className="text-sm font-bold text-slate-800 mb-4 uppercase tracking-wider border-l-4 border-blue-500 pl-3">Các khoản thu</h3>
                <div className="space-y-3">
                  {hiddenReportData.items.map((item: any, idx: number) => (
                    <div key={idx} className="flex justify-between items-center p-3 border border-slate-100 rounded-lg bg-slate-50/50">
                      <div>
                        <p className="font-bold text-slate-800 text-sm">
                          {item.type === "TUITION" ? `Học phí lớp: ${item.className} (Phiếu ${item.voucherNumber})` : "Thanh toán nợ cũ (Kỳ trước)"}
                        </p>
                        {item.type === "TUITION" && (
                          <p className="text-xs text-slate-500 mt-0.5">Gia hạn thêm {item.sessionsPerPackage} buổi học</p>
                        )}
                      </div>
                      <div className="font-extrabold text-blue-700 whitespace-nowrap ml-2">
                        {item.amount.toLocaleString('vi-VN')} đ
                      </div>
                    </div>
                  ))}
                  <div className="flex justify-between items-center pt-3 border-t border-slate-200 mt-3 px-3">
                    <span className="font-bold text-slate-800 uppercase text-sm">Tổng thu:</span>
                    <span className="text-lg font-black text-blue-600">{hiddenReportData.totalExpectedAmount.toLocaleString('vi-VN')} đ</span>
                  </div>
                </div>
              </div>

              {/* QR Section */}
              <div className="w-1/2 bg-slate-50 p-6 flex flex-col items-center justify-center border border-slate-200 rounded-xl">
                <div className="p-2 bg-white rounded-xl shadow-sm border border-slate-200 mb-3">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={hiddenReportData.qrBase64 || `https://qr.sepay.vn/img?bank=MBBank&acc=0700107189999&amount=${hiddenReportData.totalExpectedAmount}&des=${encodeURIComponent(hiddenReportData.phoneParent ? `HT${hiddenReportData.phoneParent.replace(/\s+/g, '')}${hiddenReportData.studentId.slice(-3).toUpperCase()}` : `HT${hiddenReportData.studentId}`)}&template=`}
                    alt="QR Code"
                    crossOrigin="anonymous"
                    className="w-40 h-40 object-contain"
                    key={hiddenReportData.studentId}
                  />
                </div>
                <p className="font-bold text-slate-800 flex items-center gap-2">
                  Quét mã thanh toán
                  <span className="bg-emerald-100 text-emerald-700 text-[10px] uppercase font-black px-2 py-0.5 rounded-full">
                    VietQR
                  </span>
                </p>
                <p className="text-sm text-slate-500 mt-1 mb-1">Học sinh: <span className="font-mono">{hiddenReportData.studentName}</span></p>
                <p className="text-xs text-slate-400 mb-2">Nội dung CK: <span className="font-mono font-bold text-slate-600">{hiddenReportData.phoneParent ? `HT${hiddenReportData.phoneParent.replace(/\s+/g, '')}${hiddenReportData.studentId.slice(-3).toUpperCase()}` : `HT${hiddenReportData.studentId}`}</span></p>
              </div>
            </div>

            {/* Footer text */}
            <div className="bg-slate-800 text-slate-300 text-xs py-3 px-6 text-center">
              Cảm ơn Quý phụ huynh!
            </div>
          </div>
        </div>
      )}

    </div>
  );
}