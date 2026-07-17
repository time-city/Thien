"use client";

import { useState, useEffect } from "react";
import { X, Download, FileText, Loader2, Banknote, CreditCard, Send, AlertTriangle } from "lucide-react";
import { getStudentCombinedReport, StudentCombinedReport, markReportAsSent } from "@/actions/report";
import { processStudentPayment, applyDiscount } from "@/actions/invoice";
import { CurrencyInput } from "@/components/ui/CurrencyInput";
import { toast } from "sonner";
import { toPng, toBlob } from "html-to-image";

const injectGlobalCSS = (element: HTMLElement) => {
  let css = "";
  for (let i = 0; i < document.styleSheets.length; i++) {
    try {
      const sheet = document.styleSheets[i];
      if (sheet.cssRules) {
        for (let j = 0; j < sheet.cssRules.length; j++) {
          css += sheet.cssRules[j].cssText;
        }
      }
    } catch (e) {
      // Bỏ qua lỗi đọc cssRules do CORS
    }
  }
  const styleTag = document.createElement("style");
  styleTag.innerHTML = css;
  element.insertBefore(styleTag, element.firstChild);
  return styleTag;
};

export default function CourseReportModal({
  isOpen,
  onClose,
  studentId,
  studentName,
  classId,
  className,
  onSuccess,
  autoSend
}: {
  isOpen: boolean;
  onClose: () => void;
  studentId: string;
  studentName: string;
  classId?: string;
  className?: string;
  onSuccess?: () => void;
  autoSend?: boolean;
}) {
  const [report, setReport] = useState<StudentCombinedReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [discountAmountStr, setDiscountAmountStr] = useState<string>("");
  const [exporting, setExporting] = useState(false);

  // Zalo Sending States
  const [confirmSendOpen, setConfirmSendOpen] = useState(false);
  const [sendingZalo, setSendingZalo] = useState(false);

  const [isProcessing, setIsProcessing] = useState(false);
  const [isProcessingTransfer, setIsProcessingTransfer] = useState(false);
  const [isApplyingDiscount, setIsApplyingDiscount] = useState(false);
  const [cashAmount, setCashAmount] = useState<string>("");
  const [transferAmount, setTransferAmount] = useState<string>("");
  const [initialDebt, setInitialDebt] = useState<number>(0);

  const fetchReport = async () => {
    setLoading(true);
    try {
      const data = await getStudentCombinedReport(studentId);
      setReport(data);
      if (data) {
        setInitialDebt(data.totalExpectedAmount);
      }
    } catch (e) {
      toast.error("Không thể tải báo cáo học tập");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!isOpen) return;

    // Reset state khi mở modal cho học sinh mới
    setCashAmount("");
    setTransferAmount("");
    setDiscountAmountStr("");
    setReport(null);

    fetchReport();
  }, [isOpen, studentId]);

  useEffect(() => {
    if (!isOpen || initialDebt <= 0) return;

    // Polling database để kiểm tra trạng thái thanh toán từ Webhook
    const interval = setInterval(async () => {
      try {
        const debt = await import("@/actions/invoice").then(m => m.getTotalDebt(studentId));

        if (debt <= 0) {
          clearInterval(interval);
          toast.success("Thanh toán thành công toàn bộ nợ qua mã QR!");
          onClose(); // Đóng modal tự động
          window.location.reload(); // Refresh toàn trang cho chắc chắn ăn dữ liệu
        } else if (debt < initialDebt) {
          // Bắt được giao dịch chuyển thiếu tiền (UNDERPAID) -> Xử lý như tiền mặt
          clearInterval(interval);
          toast.success(`Đã nhận thanh toán một phần qua mã QR! Còn nợ: ${debt.toLocaleString("vi-VN")} đ`);
          onClose();
          window.location.reload();
        }
      } catch (e) {
        // Im lặng bỏ qua nếu lỗi mạng
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [isOpen, studentId, initialDebt, onClose]);

  // Tự động gửi Zalo nếu có cờ autoSend
  useEffect(() => {
    if (autoSend && report && !sendingZalo && !exporting) {
      if (!report.phoneParent) {
        toast.error("Không thể gửi tự động vì chưa có Số điện thoại Phụ huynh!");
        return;
      }
      toast.loading("Đang tự động xuất ảnh và gửi Zalo...", { id: "auto-send" });
      const timer = setTimeout(() => {
        handleSendZalo();
      }, 2500);
      return () => clearTimeout(timer);
    }
  }, [autoSend, report]);

  if (!isOpen) return null;

  const handleExportPng = async () => {
    const element1 = document.getElementById("report-export-area-1");
    const element2 = document.getElementById("report-export-area-2");
    if (!element1 || !element2 || !report) return;

    setExporting(true);
    const styleTag = injectGlobalCSS(element1); // Both share the same global CSS
    try {
      const dataUrl1 = await toPng(element1, {
        cacheBust: true,
        pixelRatio: 2,
        backgroundColor: "#ffffff",
        style: { transform: "scale(1)", transformOrigin: "top left" }
      });
      const dataUrl2 = await toPng(element2, {
        cacheBust: true,
        pixelRatio: 2,
        backgroundColor: "#ffffff",
        style: { transform: "scale(1)", transformOrigin: "top left" }
      });

      const link1 = document.createElement("a");
      link1.download = `BaoCao_HocTap_${studentName.replace(/\s+/g, "_")}.png`;
      link1.href = dataUrl1;
      link1.click();

      const link2 = document.createElement("a");
      link2.download = `BaoCao_HocPhi_${studentName.replace(/\s+/g, "_")}.png`;
      link2.href = dataUrl2;
      link2.click();

      // Đánh dấu đã báo cáo
      if (report && report.logs.length > 0) {
        await markReportAsSent(report.logs.map(l => l.id));
      }

      toast.success("Đã tải ảnh báo cáo thành công!");
    } catch (err) {
      toast.error("Lỗi khi xuất ảnh PNG. Vui lòng thử lại!");
    } finally {
      styleTag.remove();
      setExporting(false);
    }
  };

  const handleSendZalo = async () => {
    const element1 = document.getElementById("report-export-area-1");
    const element2 = document.getElementById("report-export-area-2");
    if (!element1 || !element2 || !report) return;

    if (!report.phoneParent) {
      toast.error("Học sinh này chưa có số điện thoại phụ huynh!");
      setConfirmSendOpen(false);
      return;
    }

    setSendingZalo(true);
    const styleTag = injectGlobalCSS(element1);
    try {
      const dataUrl1 = await toPng(element1, {
        cacheBust: true,
        pixelRatio: 2,
        backgroundColor: "#ffffff",
        style: { transform: "scale(1)", transformOrigin: "top left" }
      });
      const dataUrl2 = await toPng(element2, {
        cacheBust: true,
        pixelRatio: 2,
        backgroundColor: "#ffffff",
        style: { transform: "scale(1)", transformOrigin: "top left" }
      });

      const res1 = await fetch(dataUrl1);
      const blob1 = await res1.blob();

      const res2 = await fetch(dataUrl2);
      const blob2 = await res2.blob();

      const file1 = new File([blob1], `BaoCao_HocTap_${studentName.replace(/\s+/g, "_")}.png`, { type: "image/png" });
      const file2 = new File([blob2], `BaoCao_HocPhi_${studentName.replace(/\s+/g, "_")}.png`, { type: "image/png" });

      const targetPhone = report.phoneParent.trim();

      let dateStr = "";
      const hasLogs = report.logs && report.logs.length > 0;
      if (hasLogs) {
        const dates = report.logs.map(l => new Date(l.date));
        const minDate = new Date(Math.min(...dates.map(d => d.getTime())));
        const maxDate = new Date(Math.max(...dates.map(d => d.getTime())));
        dateStr = ` (từ ${minDate.getDate()}/${minDate.getMonth() + 1} - ${maxDate.getDate()}/${maxDate.getMonth() + 1})`;
      }

      const classNamesArray = report.items.filter(i => i.type === "TUITION").map(i => i.className);
      const classNames = classNamesArray.length > 0 ? classNamesArray.join("; ") : "Các lớp";

      const formattedPrice = finalPrice.toLocaleString('vi-VN');
      let descStr = `HT${studentId}`;
      if (report?.phoneParent) {
        const cleanPhone = report.phoneParent.replace(/\s+/g, '');
        const suffix = studentId.slice(-3).toUpperCase();
        descStr = `HT${cleanPhone}${suffix}`;
      }

      const headerTitle = hasLogs ? `Báo cáo học tập${dateStr}.` : "Thông báo đóng học phí.";

      const message = `
Nông trại Khoa học tự nhiên kính gửi quý phụ huynh: ***${headerTitle}***
• Học sinh: ***${studentName}***
• Lớp đang học: ***${classNames}***

Phụ huynh thanh toán học phí (mã QR hoặc tiền mặt):
• Số tiền: ***${formattedPrice} vnđ***
• Nội dung chuyển khoản: ***${descStr}***

_Tin nhắn được thông báo tự động, phụ huynh có thể trao đổi thêm qua Zalo._`.trim();

      // Send Image 1 (Chỉ gửi nếu có dữ liệu học tập)
      if (hasLogs) {
        const formData1 = new FormData();
        formData1.append("target", targetPhone);
        formData1.append("image", file1);
        const imageRes1 = await fetch("/api/zalobot/send-image", {
          method: "POST",
          headers: { "x-api-key": process.env.NEXT_PUBLIC_ZALO_BOT_API_KEY || "" },
          body: formData1,
        });

        if (!imageRes1.ok) {
          throw new Error(`Lỗi gửi ảnh 1 (${imageRes1.status})`);
        }
      }

      // Send Image 2 (QR)
      await new Promise(r => setTimeout(r, 1000));
      const formData2 = new FormData();
      formData2.append("target", targetPhone);
      formData2.append("image", file2);

      const imageRes2 = await fetch("/api/zalobot/send-image", {
        method: "POST",
        headers: { "x-api-key": process.env.NEXT_PUBLIC_ZALO_BOT_API_KEY || "" },
        body: formData2,
      });

      if (!imageRes2.ok) {
        const errText = await imageRes2.text().catch(() => "No text");
        console.error("Zalo Bot Image 2 Error:", imageRes2.status, errText);
        throw new Error(`Lỗi gửi ảnh 2 (${imageRes2.status}): ${errText.substring(0, 100)}`);
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
        const errText = await textRes.text().catch(() => "Không thể đọc lỗi");
        console.error("LỖI GỬI TEXT TỪ ZALO BOT SERVER:", textRes.status, errText);
        throw new Error(`Text API Failed: ${textRes.status}`);
      }

      if (report.logs && report.logs.length > 0) {
        await markReportAsSent(report.logs.map(l => l.id));
      }

      toast.success("Đã gửi báo cáo qua Zalo thành công!");
      toast.dismiss("auto-send");
      setConfirmSendOpen(false);
      // Tự động load lại báo cáo để những log vừa gửi biến mất
      await fetchReport();
      onSuccess?.();
      if (autoSend) {
        onClose();
      }
    } catch (error: any) {
      console.error("CHI TIẾT LỖI ZALO:", error);
      const msg = error?.message || "";

      // Nếu là lỗi từ Zalo API trả về
      if (msg.includes("500") || msg.includes("400") || msg.includes("API Failed") || msg.includes("Lỗi gửi ảnh")) {
        toast.error(`Không thể gửi Zalo: Số điện thoại ${report?.phoneParent} chưa đăng ký Zalo hoặc chặn tin nhắn từ người lạ.`, { duration: 6000 });
      } else {
        toast.error(`Lỗi hệ thống: ${msg || "Vui lòng kiểm tra lại Zalo Bot."}`);
      }
      toast.dismiss("auto-send");
    } finally {
      styleTag.remove();
      setSendingZalo(false);
    }
  };

  const handleSendReminder = async () => {
    if (!report || !report.phoneParent) {
      toast.error("Học sinh này chưa có số điện thoại phụ huynh!");
      return;
    }

    const element2 = document.getElementById("report-export-area-2");
    if (!element2) {
      toast.error("Không tìm thấy mã QR để xuất.");
      return;
    }

    const classNamesArray = report.items.filter(i => i.type === "TUITION").map(i => i.className);
    const classNames = classNamesArray.length > 0 ? classNamesArray.join("; ") : "Tổng hợp";

    const message = `***NHẮC BÁO HỌC PHÍ***
Nông trại Khoa học tự nhiên ***CHƯA NHẬN*** học phí học sinh: ***${studentName}***
Lớp: ***${classNames}***

_Phụ huynh đã nộp nhưng hệ thống chưa cập nhật, vui lòng nhắn tin xác nhận để được kiểm tra lại tình trạng học phí._`;

    const styleTag = injectGlobalCSS(element2);
    try {
      setSendingZalo(true);

      // Chụp ảnh phiếu thu (có mã QR)
      const dataUrl2 = await toPng(element2, {
        cacheBust: true,
        pixelRatio: 2,
        backgroundColor: "#ffffff",
        style: { transform: "scale(1)", transformOrigin: "top left" }
      });

      const res2 = await fetch(dataUrl2);
      const blob2 = await res2.blob();
      const file2 = new File([blob2], `BaoCao_HocPhi_${studentName.replace(/\s+/g, "_")}.png`, { type: "image/png" });

      const formData2 = new FormData();
      formData2.append("target", report.phoneParent);
      formData2.append("image", file2);

      // Gửi ảnh QR cùng với nội dung nhắc nợ
      const imageRes2 = await fetch("/api/zalobot/send-image", {
        method: "POST",
        headers: { "x-api-key": process.env.NEXT_PUBLIC_ZALO_BOT_API_KEY || "" },
        body: formData2,
      });

      if (!imageRes2.ok) {
        throw new Error("Lỗi khi gửi ảnh QR Zalo");
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
          target: report.phoneParent,
          message: message
        }),
      });

      if (!textRes.ok) {
        throw new Error("Lỗi khi gửi Text Zalo nhắc nợ");
      }

      toast.success("Đã gửi tin nhắn nhắc nợ và mã QR thành công!");
    } catch (e: any) {
      toast.error(e.message || "Lỗi kết nối Zalo");
    } finally {
      styleTag.remove();
      setSendingZalo(false);
    }
  };

  const originalPrice = report ? report.totalExpectedAmount : 0;
  const discountAmount = Number(discountAmountStr) || 0;
  const finalPrice = Math.max(0, originalPrice - discountAmount);

  // Generate VietQR URL sử dụng phoneParent thay vì studentId/invoiceId
  let descString = `HT${studentId}`;
  if (report?.phoneParent) {
    const cleanPhone = report.phoneParent.replace(/\s+/g, '');
    const suffix = studentId.slice(-3).toUpperCase();
    descString = `HT${cleanPhone}${suffix}`;
  }
  const qrUrl = `https://qr.sepay.vn/img?bank=MBBank&acc=0700107189999&amount=${finalPrice}&des=${encodeURIComponent(descString)}&template=`;

  // Log ra console để tiện việc test Webhook
  console.log(`[DEBUG QR] Nội dung quét: ${descString} | Số tiền: ${finalPrice}`);

  const handleDownloadQr = async () => {
    try {
      const response = await fetch(qrUrl);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `QR_${studentName.replace(/\s+/g, "_")}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      toast.error("Không thể tải mã QR");
    }
  };

  const handlePayCash = async () => {
    const amount = cashAmount === "" ? 0 : Number(cashAmount);
    if (isNaN(amount) || amount < 0 || (amount === 0 && finalPrice > 0)) return toast.error("Số tiền không hợp lệ");

    setIsProcessing(true);
    try {
      const res = await processStudentPayment(studentId, amount, "CASH");
      if (res.success) {
        toast.success("Đã xác nhận thanh toán & cộng buổi học!");
        await fetchReport();
        onSuccess?.();
      } else {
        toast.error(res.message || "Lỗi thu tiền mặt");
      }
    } catch (e) {
      toast.error("Lỗi khi xác nhận tiền mặt");
    } finally {
      setIsProcessing(false);
    }
  };

  const handlePayTransfer = async () => {
    const amount = transferAmount === "" ? 0 : Number(transferAmount);
    if (isNaN(amount) || amount < 0 || (amount === 0 && finalPrice > 0)) return toast.error("Số tiền không hợp lệ");

    setIsProcessingTransfer(true);
    try {
      const res = await processStudentPayment(studentId, amount, "BANK_TRANSFER");
      if (res.success) {
        toast.success("Đã xác nhận chuyển khoản & cộng buổi học!");
        await fetchReport();
        onSuccess?.();
      } else {
        toast.error(res.message || "Lỗi xác nhận chuyển khoản");
      }
    } catch (e) {
      toast.error("Lỗi khi xác nhận chuyển khoản");
    } finally {
      setIsProcessingTransfer(false);
    }
  };

  const handleApplyDiscount = async () => {
    if (discountAmount <= 0) return toast.error("Vui lòng nhập số tiền khấu hao hợp lệ");
    setIsApplyingDiscount(true);
    try {
      const res = await applyDiscount(studentId, discountAmount);
      if (res.success) {
        toast.success("Đã áp dụng giảm giá vào hóa đơn!");
        setDiscountAmountStr("");
        await fetchReport(); // Refresh the report to show new expected amount
      } else {
        toast.error(res.message || "Lỗi áp dụng giảm giá");
      }
    } catch (e) {
      toast.error("Lỗi hệ thống khi áp dụng giảm giá");
    } finally {
      setIsApplyingDiscount(false);
    }
  };


  return (
    <div
      className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="bg-white w-full max-w-4xl rounded-2xl shadow-xl flex flex-col md:flex-row overflow-hidden animate-in zoom-in-95 duration-200 max-h-[90vh] md:h-[90vh] overflow-y-auto md:overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >

        {/* Phần Control Panel */}
        <div className="w-full md:w-1/3 bg-slate-50 border-b md:border-b-0 md:border-r border-slate-200 p-3 md:p-5 flex flex-col md:h-full shrink-0 md:overflow-y-auto min-h-0">
          <div className="flex justify-between items-center mb-2 md:mb-6">
            <h2 className="text-sm md:text-lg font-extrabold text-slate-800 flex items-center gap-1.5 md:gap-2">
              <FileText className="text-blue-600 w-4 h-4 md:w-5 md:h-5" /> Thanh Toán
            </h2>
            <button onClick={onClose} disabled={loading} className="p-1.5 bg-slate-200 hover:bg-slate-300 rounded-full text-slate-600 transition-colors md:hidden disabled:opacity-50 disabled:cursor-not-allowed">
              <X size={16} />
            </button>
          </div>

          <div className="space-y-2.5 md:space-y-4 flex-1">
            <div className="space-y-1">
              <label className="text-[10px] md:text-xs font-bold text-slate-500 uppercase">Khấu hao / Giảm giá (VNĐ)</label>
              <div className="flex gap-2">
                <CurrencyInput
                  placeholder="Nhập số tiền..."
                  value={discountAmountStr}
                  onChange={(val) => setDiscountAmountStr(val.toString())}
                  className="flex-1 w-full h-8 md:h-11 px-2.5 md:px-3 border border-slate-200 rounded-md md:rounded-xl bg-white text-[11px] md:text-sm font-semibold focus:ring-2 focus:ring-blue-100 outline-none transition-all"
                />
                <button
                  onClick={handleApplyDiscount}
                  disabled={isApplyingDiscount || !discountAmount || loading}
                  className="h-8 md:h-11 px-3 md:px-4 whitespace-nowrap w-fit bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-md md:rounded-xl font-bold text-[10px] md:text-sm transition-colors flex items-center justify-center"
                >
                  {isApplyingDiscount ? <Loader2 size={14} className="animate-spin md:w-4 md:h-4" /> : "Xác nhận"}
                </button>
              </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-md md:rounded-xl p-2.5 md:p-4 space-y-1.5 md:space-y-3">
              <div className="flex justify-between items-center text-[11px] md:text-sm">
                <span className="text-slate-500 font-medium">Tổng phí gốc:</span>
                <span className="font-bold text-slate-700">{originalPrice.toLocaleString('vi-VN')} đ</span>
              </div>
              <div className="flex justify-between items-center text-[11px] md:text-sm text-emerald-600">
                <span className="font-medium">Giảm trừ:</span>
                <span className="font-bold">-{(discountAmount).toLocaleString('vi-VN')} đ</span>
              </div>
              <div className="pt-1.5 md:pt-3 border-t border-slate-100 flex justify-between items-center">
                <span className="text-xs md:text-sm font-bold text-slate-800">Thực nhận:</span>
                <span className="text-sm md:text-lg font-extrabold text-blue-600">{finalPrice.toLocaleString('vi-VN')} đ</span>
              </div>
            </div>

            <div className="bg-emerald-50 border border-emerald-200 rounded-md md:rounded-xl p-2.5 md:p-4 mt-2.5 md:mt-4">
              <label className="text-[9px] md:text-xs font-bold text-emerald-700 uppercase mb-1.5 md:mb-2 block">Xác Nhận Thu Tiền Mặt</label>
              <div className="flex gap-2">
                <CurrencyInput
                  placeholder="Nhập số tiền..."
                  value={cashAmount}
                  onChange={(val) => setCashAmount(val.toString())}
                  className="flex-1 w-full h-8 md:h-10 px-2.5 md:px-3 border border-emerald-200 rounded-md md:rounded-lg text-[11px] md:text-sm outline-none focus:border-emerald-400"
                />
                <button
                  onClick={handlePayCash}
                  disabled={isProcessing || loading || (finalPrice > 0 && !cashAmount)}
                  className="h-8 md:h-10 px-3 md:px-4 whitespace-nowrap w-fit bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-md md:rounded-lg font-bold text-[10px] md:text-sm transition-colors flex items-center justify-center"
                >
                  {isProcessing ? <Loader2 size={14} className="animate-spin md:w-4 md:h-4" /> : "Xác nhận"}
                </button>
              </div>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-md md:rounded-xl p-2.5 md:p-4 mt-2.5 md:mt-4">
              <label className="text-[9px] md:text-xs font-bold text-blue-700 uppercase mb-1.5 md:mb-2 block">Xác Nhận Chuyển Khoản Thủ Công</label>
              <div className="flex gap-2">
                <CurrencyInput
                  placeholder="Nhập số tiền..."
                  value={transferAmount}
                  onChange={(val) => setTransferAmount(val.toString())}
                  className="flex-1 w-full h-8 md:h-10 px-2.5 md:px-3 border border-blue-200 rounded-md md:rounded-lg text-[11px] md:text-sm outline-none focus:border-blue-400"
                />
                <button
                  onClick={handlePayTransfer}
                  disabled={isProcessingTransfer || loading || (finalPrice > 0 && !transferAmount)}
                  className="h-8 md:h-10 px-3 md:px-4 whitespace-nowrap w-fit bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-md md:rounded-lg font-bold text-[10px] md:text-sm transition-colors flex items-center justify-center"
                >
                  {isProcessingTransfer ? <Loader2 size={14} className="animate-spin md:w-4 md:h-4" /> : "Xác nhận"}
                </button>
              </div>
            </div>

            <div className="bg-blue-50 text-blue-700 text-[9px] md:text-xs p-2 md:p-3 rounded-md md:rounded-xl border border-blue-100 leading-tight md:leading-relaxed mt-1 md:mt-0">
              Bấm "Tạo Mã QR" chốt tiền để quét mã, hoặc thu tiền mặt.
            </div>
          </div>

          <div className="mt-2.5 md:mt-6 pt-2.5 md:pt-4 border-t border-slate-200">
            {!report?.phoneParent ? (
              <button
                disabled
                className="w-full h-8 md:h-12 mb-1.5 md:mb-3 text-white rounded-md md:rounded-xl font-bold text-[11px] md:text-sm transition-all shadow-sm flex items-center justify-center gap-1.5 md:gap-2 bg-slate-400 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Send className="w-3.5 h-3.5 md:w-[18px] md:h-[18px]" />
                Cập nhật SĐT Phụ huynh để gửi Zalo
              </button>
            ) : (
              <>
                <button
                  onClick={() => setConfirmSendOpen(true)}
                  disabled={loading || !report}
                  className="w-full h-8 md:h-12 mb-1.5 md:mb-3 text-white rounded-md md:rounded-xl font-bold text-[11px] md:text-sm transition-all shadow-sm flex items-center justify-center gap-1.5 md:gap-2 disabled:opacity-50 disabled:cursor-not-allowed bg-green-600 hover:bg-green-700"
                >
                  <Send className="w-3.5 h-3.5 md:w-[18px] md:h-[18px]" />
                  Gửi báo cáo qua Zalo
                </button>
                <button
                  onClick={handleSendReminder}
                  disabled={loading || !report || sendingZalo}
                  className="w-full h-8 md:h-12 mb-1.5 md:mb-3 text-white rounded-md md:rounded-xl font-bold text-[11px] md:text-sm transition-all shadow-sm flex items-center justify-center gap-1.5 md:gap-2 disabled:opacity-50 disabled:cursor-not-allowed bg-orange-500 hover:bg-orange-600"
                >
                  {sendingZalo ? <Loader2 size={14} className="animate-spin md:w-4 md:h-4" /> : <Send className="w-3.5 h-3.5 md:w-[18px] md:h-[18px]" />}
                  Nhắc lại phụ huynh (Zalo)
                </button>
              </>
            )}
            <button
              onClick={handleExportPng}
              disabled={loading || exporting || !report}
              className="w-full h-8 md:h-12 bg-blue-600 hover:bg-blue-700 text-white rounded-md md:rounded-xl font-bold text-[11px] md:text-sm transition-all shadow-sm flex items-center justify-center gap-1.5 md:gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
            >
              {exporting ? <Loader2 size={14} className="animate-spin md:w-4 md:h-4" /> : <Download className="w-3.5 h-3.5 md:w-[18px] md:h-[18px]" />}
              {exporting ? "Đang xuất ảnh..." : "Tải báo cáo ảnh (PNG)"}
            </button>
            <button onClick={onClose} disabled={loading} className="w-full mt-1.5 md:mt-3 h-8 md:h-10 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-md md:rounded-xl font-bold text-[11px] md:text-sm transition-all hidden md:block disabled:opacity-50 disabled:cursor-not-allowed">
              Đóng
            </button>
          </div>
        </div>

        {/* Phần Preview Export */}
        <div className="w-full md:w-2/3 bg-slate-200 p-4 md:h-full flex-1 overflow-y-auto min-h-0">
          {loading ? (
            <div className="flex flex-col items-center justify-center h-64 text-slate-500">
              <Loader2 size={32} className="animate-spin mb-4 text-blue-500" />
              <p className="font-medium">Đang tải dữ liệu tổng hợp...</p>
            </div>
          ) : !report ? (
            <div className="flex flex-col items-center justify-center h-64 text-slate-500">
              <p className="font-medium">Không có dữ liệu báo cáo cho học sinh này.</p>
            </div>
          ) : (
            <div className="w-full max-w-[800px] mx-auto space-y-4">
              {/* Ảnh 1: Thông tin và Lịch sử học tập */}
              <div id="report-export-area-1" className="bg-white w-full shadow-sm rounded-lg overflow-hidden border border-slate-200">
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
                      <p className="font-extrabold text-slate-800 text-lg">{report.studentName}</p>
                    </div>
                    <div>
                      <p className="text-slate-500 mb-1 text-xs uppercase font-bold tracking-wider">Mã Tra Cứu</p>
                      <p className="font-extrabold text-slate-800 text-lg">{report.studentId.substring(0, 8)}</p>
                    </div>
                  </div>
                </div>

                {/* Logs Section (chỉ hiện nếu có log) */}
                {report.logs.length > 0 && (
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
                          {report.logs.map((log, i) => (
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
                      Tổng số buổi chưa báo cáo: {report.logs.length} buổi
                    </p>
                  </div>
                )}
              </div>

              {/* Ảnh 2: Thanh toán học phí */}
              <div id="report-export-area-2" className="bg-white w-full shadow-sm rounded-lg overflow-hidden border border-slate-200">
                <div className="bg-blue-600 p-4 text-white text-center">
                  <h2 className="text-lg font-black uppercase tracking-wider mb-1">CHI TIẾT HỌC PHÍ</h2>
                  <p className="text-blue-100 text-xs font-medium">Học sinh: {report.studentName}</p>
                </div>
                {/* 2 Columns: Items & QR */}
                <div className="p-6 flex flex-row gap-6 items-stretch">
                  {/* Items Section */}
                  <div className="w-1/2">
                    <h3 className="text-sm font-bold text-slate-800 mb-4 uppercase tracking-wider border-l-4 border-blue-500 pl-3">Các khoản thu</h3>
                    <div className="space-y-3">
                      {report.items.map((item, idx) => (
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
                        <span className="text-lg font-black text-blue-600">{finalPrice.toLocaleString('vi-VN')} đ</span>
                      </div>
                    </div>
                  </div>

                  {/* QR Section */}
                  <div className="w-1/2 bg-slate-50 p-6 flex flex-col items-center justify-center border border-slate-200 rounded-xl">
                    <div className="p-2 bg-white rounded-xl shadow-sm border border-slate-200 shrink-0 mb-3">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={qrUrl} alt="QR Code" crossOrigin="anonymous" className="w-40 h-40 object-contain" />
                    </div>
                    <p className="font-bold text-slate-800 flex items-center gap-2">
                      Quét mã thanh toán
                      <span className="bg-emerald-100 text-emerald-700 text-[10px] uppercase font-black px-2 py-0.5 rounded-full">
                        VietQR
                      </span>
                    </p>
                    <p className="text-sm text-slate-500 mt-1 mb-2">Học sinh: <span className="font-mono">{studentName}</span></p>
                    <div className="flex gap-2">
                      <button onClick={handleDownloadQr} className="text-xs font-bold text-blue-600 hover:text-blue-800 transition-colors flex items-center gap-1">
                        <Download size={14} /> Tải mã QR
                      </button>
                    </div>
                  </div>
                </div>

                {/* Footer text */}
                <div className="bg-slate-800 text-slate-300 text-xs py-3 px-6 text-center">
                  Cảm ơn Quý phụ huynh !
                </div>
              </div>
            </div>
          )}
        </div>

        {/* MODAL XÁC NHẬN GỬI ZALO */}
        {confirmSendOpen && (
          <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col animate-in zoom-in-95 duration-200">
              <div className="p-5 flex items-center gap-4 border-b border-slate-100 bg-amber-50/50">
                <div className="w-10 h-10 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center shrink-0">
                  <AlertTriangle size={20} />
                </div>
                <div>
                  <h3 className="text-lg font-extrabold text-slate-900">Xác nhận gửi Zalo</h3>
                  <p className="text-sm text-slate-500 font-medium mt-0.5">Học sinh: {studentName}</p>
                  {report?.phoneParent && (
                    <p className="text-sm text-slate-500 font-medium mt-0.5">
                      SĐT Phụ huynh: <span className="font-bold text-slate-800 font-mono">{report.phoneParent}</span>
                    </p>
                  )}
                </div>
              </div>
              <div className="p-6">
                <p className="text-slate-700 font-medium mb-2 text-center text-base leading-relaxed">
                  Bạn đã kiểm tra kĩ nội dung báo cáo và số tiền thanh toán bên phải chưa?
                </p>
                {!report?.phoneParent && (
                  <div className="mt-4 p-3 bg-red-50 text-red-700 rounded-lg border border-red-200 text-sm font-bold flex items-center gap-2">
                    <X size={16} /> Học sinh này chưa có số điện thoại phụ huynh!
                  </div>
                )}
              </div>
              <div className="p-4 border-t border-slate-100 flex justify-end gap-3 bg-slate-50">
                <button
                  onClick={() => setConfirmSendOpen(false)}
                  disabled={sendingZalo}
                  className="px-5 py-2.5 rounded-xl font-bold text-sm text-slate-600 hover:bg-slate-200 border border-slate-300 transition-colors"
                >
                  Hủy lại, để tôi xem
                </button>
                <button
                  onClick={handleSendZalo}
                  disabled={sendingZalo || !report?.phoneParent}
                  className="px-5 py-2.5 rounded-xl font-bold text-sm bg-green-600 text-white hover:bg-green-700 transition-colors shadow-sm flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {sendingZalo ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                  {sendingZalo ? "Đang gửi..." : "Đã xem kĩ, Gửi ngay!"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

