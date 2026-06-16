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
  onSuccess
}: {
  isOpen: boolean;
  onClose: () => void;
  studentId: string;
  studentName: string;
  classId?: string;
  className?: string;
  onSuccess?: () => void;
}) {
  const [report, setReport] = useState<StudentCombinedReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [discountAmountStr, setDiscountAmountStr] = useState<string>("");
  const [exporting, setExporting] = useState(false);

  // Zalo Sending States
  const [confirmSendOpen, setConfirmSendOpen] = useState(false);
  const [sendingZalo, setSendingZalo] = useState(false);

  const [isProcessing, setIsProcessing] = useState(false);
  const [isApplyingDiscount, setIsApplyingDiscount] = useState(false);
  const [cashAmount, setCashAmount] = useState<string>("");
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
      const blob1 = await toBlob(element1, {
        pixelRatio: 2,
        backgroundColor: "#ffffff",
        style: { transform: "scale(1)", transformOrigin: "top left" }
      });
      const blob2 = await toBlob(element2, {
        pixelRatio: 2,
        backgroundColor: "#ffffff",
        style: { transform: "scale(1)", transformOrigin: "top left" }
      });

      if (!blob1 || !blob2) throw new Error("Lỗi khi tạo ảnh (Blob rỗng)");

      const file1 = new File([blob1], `BaoCao_HocTap_${studentName.replace(/\s+/g, "_")}.png`, { type: "image/png" });
      const file2 = new File([blob2], `BaoCao_HocPhi_${studentName.replace(/\s+/g, "_")}.png`, { type: "image/png" });

      let dateStr = "";
      if (report.logs && report.logs.length > 0) {
        const dates = report.logs.map(l => new Date(l.date));
        const minDate = new Date(Math.min(...dates.map(d => d.getTime())));
        const maxDate = new Date(Math.max(...dates.map(d => d.getTime())));
        dateStr = ` (từ ${minDate.getDate()}/${minDate.getMonth() + 1} - ${maxDate.getDate()}/${maxDate.getMonth() + 1})`;
      }

      const classNamesArray = report.items.filter(i => i.type === "TUITION").map(i => i.className);
      const classNames = classNamesArray.length > 0 ? classNamesArray.join("; ") : "Các lớp";

      const formattedPrice = finalPrice.toLocaleString('vi-VN');
      const descStr = report?.phoneParent ? `HT${report.phoneParent}` : `HT${studentId}`;

      const message = `
Nông trại Khoa học tự nhiên kính gửi quý phụ huynh Báo cáo học tập${dateStr}.
• Học sinh: ${studentName}
• Lớp đang học: ${classNames}

Phụ huynh thanh toán học phí (mã QR hoặc tiền mặt):
• Số tiền: ${formattedPrice} vnđ
• Nội dung chuyển khoản: ${descStr}

Tin nhắn được thông báo tự động, phụ huynh có thể trao đổi thêm qua Zalo.`.trim();

      // Send Image 1
      const formData1 = new FormData();
      formData1.append("target", report.phoneParent);
      formData1.append("image", file1);
      const imageRes1 = await fetch("/api/zalobot/send-image", {
        method: "POST",
        headers: { "x-api-key": process.env.NEXT_PUBLIC_ZALO_BOT_API_KEY || "" },
        body: formData1,
      });

      if (!imageRes1.ok) {
        throw new Error(`Lỗi gửi ảnh 1 (${imageRes1.status})`);
      }

      // Send Image 2
      await new Promise(r => setTimeout(r, 1000));
      const formData2 = new FormData();
      formData2.append("target", report.phoneParent);
      formData2.append("image", file2);
      const imageRes2 = await fetch("/api/zalobot/send-image", {
        method: "POST",
        headers: { "x-api-key": process.env.NEXT_PUBLIC_ZALO_BOT_API_KEY || "" },
        body: formData2,
      });

      if (!imageRes2.ok) {
        throw new Error(`Lỗi gửi ảnh 2 (${imageRes2.status})`);
      }

      // 2. Nghỉ 1s rồi gửi text để đảm bảo thứ tự
      await new Promise(r => setTimeout(r, 1000));

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

      if (textRes.ok) {
        if (report.logs && report.logs.length > 0) {
          await markReportAsSent(report.logs.map(l => l.id));
        }

        toast.success("Đã gửi báo cáo qua Zalo thành công!");
        setConfirmSendOpen(false);
        // Tự động load lại báo cáo để những log vừa gửi biến mất
        await fetchReport();
        onSuccess?.();
      } else {
        const errText = await textRes.text().catch(() => "Không thể đọc lỗi");
        console.error("LỖI GỬI TEXT TỪ ZALO BOT SERVER:", textRes.status, errText);
        toast.error(`Lỗi gửi tin nhắn văn bản (${textRes.status}): Vui lòng kiểm tra Console F12`);
      }
    } catch (error: any) {
      console.error("CHI TIẾT LỖI ZALO:", error);
      toast.error(`Lỗi hệ thống: ${error?.message || "Vui lòng kiểm tra lại Zalo Bot."}`);
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

    const classNamesArray = report.items.filter(i => i.type === "TUITION").map(i => i.className);
    const classNames = classNamesArray.length > 0 ? classNamesArray.join("; ") : "Tổng hợp";

    const message = `NHẮC BÁO HỌC PHÍ\nNông trại Khoa học tự nhiên CHƯA NHẬN học phí học sinh: ${studentName}\nPhiếu nhắc học phí định kỳ\nLớp: ${classNames}\n Phụ huynh đã nộp nhưng hệ thống chưa cập nhật, vui lòng nhắn tin xác nhận để được kiểm tra lại tình trạng học phí.`;

    try {
      setSendingZalo(true);
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

      if (textRes.ok) {
        toast.success("Đã gửi tin nhắn nhắc nợ thành công!");
      } else {
        toast.error("Lỗi khi gửi Zalo nhắc nợ");
      }
    } catch (e: any) {
      toast.error("Lỗi kết nối Zalo");
    } finally {
      setSendingZalo(false);
    }
  };

  const originalPrice = report ? report.totalExpectedAmount : 0;
  const discountAmount = Number(discountAmountStr) || 0;
  const finalPrice = Math.max(0, originalPrice - discountAmount);

  // Generate VietQR URL sử dụng phoneParent thay vì studentId/invoiceId
  const descString = report?.phoneParent ? `HT${report.phoneParent}` : `HT${studentId}`;
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
    const amount = Number(cashAmount);
    if (isNaN(amount) || amount <= 0) return toast.error("Số tiền không hợp lệ");

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
        <div className="w-full md:w-1/3 bg-slate-50 border-b md:border-b-0 md:border-r border-slate-200 p-5 flex flex-col md:h-full shrink-0 md:overflow-y-auto min-h-0">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-lg font-extrabold text-slate-800 flex items-center gap-2">
              <FileText size={20} className="text-blue-600" /> Thanh Toán
            </h2>
            <button onClick={onClose} disabled={loading} className="p-1.5 bg-slate-200 hover:bg-slate-300 rounded-full text-slate-600 transition-colors md:hidden disabled:opacity-50 disabled:cursor-not-allowed">
              <X size={18} />
            </button>
          </div>

          <div className="space-y-4 flex-1">
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-500 uppercase">Khấu hao / Giảm giá (VNĐ)</label>
              <div className="flex flex-col sm:flex-row gap-2">
                <CurrencyInput
                  placeholder="Nhập số tiền..."
                  value={discountAmountStr}
                  onChange={(val) => setDiscountAmountStr(val.toString())}
                  className="flex-1 w-full h-11 px-3 border border-slate-200 rounded-xl bg-white text-sm font-semibold focus:ring-2 focus:ring-blue-100 outline-none transition-all"
                />
                <button
                  onClick={handleApplyDiscount}
                  disabled={isApplyingDiscount || !discountAmount || loading}
                  className="h-11 px-4 whitespace-nowrap sm:w-auto w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl font-bold text-sm transition-colors flex items-center justify-center"
                >
                  {isApplyingDiscount ? <Loader2 size={16} className="animate-spin" /> : "Xác nhận"}
                </button>
              </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
              <div className="flex justify-between items-center text-sm">
                <span className="text-slate-500 font-medium">Tổng phí gốc:</span>
                <span className="font-bold text-slate-700">{originalPrice.toLocaleString('vi-VN')} đ</span>
              </div>
              <div className="flex justify-between items-center text-sm text-emerald-600">
                <span className="font-medium">Giảm trừ:</span>
                <span className="font-bold">-{(discountAmount).toLocaleString('vi-VN')} đ</span>
              </div>
              <div className="pt-3 border-t border-slate-100 flex justify-between items-center">
                <span className="text-sm font-bold text-slate-800">Thực nhận:</span>
                <span className="text-lg font-extrabold text-blue-600">{finalPrice.toLocaleString('vi-VN')} đ</span>
              </div>
            </div>

            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 mt-4">
              <label className="text-xs font-bold text-emerald-700 uppercase mb-2 block">Xác Nhận Thu Tiền Mặt</label>
              <div className="flex flex-col sm:flex-row gap-2">
                <CurrencyInput
                  placeholder="Nhập số tiền..."
                  value={cashAmount}
                  onChange={(val) => setCashAmount(val.toString())}
                  className="flex-1 w-full h-10 px-3 border border-emerald-200 rounded-lg text-sm outline-none focus:border-emerald-400"
                />
                <button
                  onClick={handlePayCash}
                  disabled={isProcessing || !cashAmount || loading}
                  className="h-10 px-4 whitespace-nowrap sm:w-auto w-full bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg font-bold text-sm transition-colors flex items-center justify-center"
                >
                  {isProcessing ? <Loader2 size={16} className="animate-spin" /> : "Xác nhận"}
                </button>
              </div>
            </div>

            <div className="bg-blue-50 text-blue-700 text-xs p-3 rounded-xl border border-blue-100 leading-relaxed">
              Kiểm tra các khoản thu bên phải. Bấm "Tạo Mã QR" để chốt tổng tiền. Bạn có thể cho phụ huynh quét mã, hoặc thu tiền mặt trực tiếp.
            </div>
          </div>

          <div className="mt-6 pt-4 border-t border-slate-200">
            {report?.logs && report.logs.length > 0 ? (
              <button
                onClick={() => setConfirmSendOpen(true)}
                disabled={loading || !report}
                className="w-full h-12 mb-3 bg-green-600 hover:bg-green-700 text-white rounded-xl font-bold text-sm transition-all shadow-sm flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Send size={18} />
                Gửi báo cáo qua Zalo
              </button>
            ) : (
              <button
                onClick={handleSendReminder}
                disabled={loading || !report || sendingZalo}
                className="w-full h-12 mb-3 bg-orange-500 hover:bg-orange-600 text-white rounded-xl font-bold text-sm transition-all shadow-sm flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {sendingZalo ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
                Nhắc lại phụ huynh (Zalo)
              </button>
            )}
            <button
              onClick={handleExportPng}
              disabled={loading || exporting || !report}
              className="w-full h-12 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-sm transition-all shadow-sm flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
            >
              {exporting ? <Loader2 size={18} className="animate-spin" /> : <Download size={18} />}
              {exporting ? "Đang xuất ảnh..." : "Tải báo cáo ảnh (PNG)"}
            </button>
            <button onClick={onClose} disabled={loading} className="w-full mt-3 h-10 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl font-bold text-sm transition-all hidden md:block disabled:opacity-50 disabled:cursor-not-allowed">
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
                                    <span className={`text-[10px] font-bold px-2 py-1 rounded-md uppercase ${log.homeworkStatus === "GOOD" ? "bg-blue-100 text-blue-700" :
                                      log.homeworkStatus === "DONE" ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"
                                      }`}>
                                      {log.homeworkStatus === "GOOD" ? "Tốt" : log.homeworkStatus === "DONE" ? "Đã làm" : "Chưa làm"}
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
                                {item.type === "TUITION" ? `Học phí lớp: ${item.className}` : "Thanh toán nợ cũ (Kỳ trước)"}
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
                    Cảm ơn Quý phụ huynh đã đồng hành cùng Trung tâm!
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

