"use client";

import { useState, useEffect } from "react";
import { X, Download, FileText, Loader2, Banknote, CreditCard } from "lucide-react";
import { getStudentCombinedReport, StudentCombinedReport } from "@/actions/report";
import { processStudentPayment } from "@/actions/invoice";
import { toast } from "sonner";
import { toPng } from "html-to-image";

export default function CourseReportModal({
  isOpen,
  onClose,
  studentId,
  studentName,
}: {
  isOpen: boolean;
  onClose: () => void;
  studentId: string;
  studentName: string;
}) {
  const [report, setReport] = useState<StudentCombinedReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [discountPercent, setDiscountPercent] = useState<number>(0);
  const [exporting, setExporting] = useState(false);

  const [isProcessing, setIsProcessing] = useState(false);
  const [cashAmount, setCashAmount] = useState<string>("");
  const [initialDebt, setInitialDebt] = useState<number>(0);

  useEffect(() => {
    if (!isOpen) return;
    
    // Reset state khi mở modal cho học sinh mới
    setCashAmount("");
    setDiscountPercent(0);
    setReport(null);

    let isMounted = true;
    setLoading(true);
    getStudentCombinedReport(studentId).then(async (data) => {
      if (!isMounted) return;
      setReport(data);
      if (data) {
        setInitialDebt(data.totalExpectedAmount);
      }
      setLoading(false);
    }).catch(() => {
      if (isMounted) {
        toast.error("Không thể tải báo cáo học tập");
        setLoading(false);
      }
    });
    return () => { isMounted = false; };
  }, [isOpen, studentId]);

  useEffect(() => {
    if (!isOpen || initialDebt <= 0) return;

    // Polling database để kiểm tra trạng thái thanh toán từ Webhook
    const interval = setInterval(async () => {
      try {
        const inv = await import("@/actions/invoice").then(m => m.checkInvoiceStatus(studentId));
        if (!inv) return;
        
        if (inv.status === "PAID") {
          clearInterval(interval);
          toast.success("Thanh toán thành công qua mã QR!");
          onClose(); // Đóng modal tự động
          window.location.reload(); // Refresh toàn trang cho chắc chắn ăn dữ liệu
        } else if (inv.status === "UNDERPAID") {
          // Bỏ qua, tiếp tục đợi thanh toán thêm hoặc user tự đóng
        }
      } catch (e) {
        // Im lặng bỏ qua nếu lỗi mạng
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [isOpen, studentId, initialDebt, onClose]);

  if (!isOpen) return null;

  const handleExportPng = async () => {
    const element = document.getElementById("report-export-area");
    if (!element) return;

    setExporting(true);
    try {
      const dataUrl = await toPng(element, {
        cacheBust: true,
        pixelRatio: 2,
        backgroundColor: "#ffffff",
        style: {
          transform: "scale(1)",
          transformOrigin: "top left"
        }
      });
      const link = document.createElement("a");
      link.href = dataUrl;
      link.download = `BaoCao_${studentName.replace(/\s+/g, "_")}.png`;
      link.click();
      toast.success("Đã tải ảnh báo cáo thành công!");
    } catch (err) {
      console.error(err);
      toast.error("Lỗi khi xuất ảnh PNG");
    } finally {
      setExporting(false);
    }
  };

  const originalPrice = report ? report.totalExpectedAmount : 0;
  const finalPrice = Math.max(0, originalPrice - (originalPrice * discountPercent) / 100);

  // Generate VietQR URL sử dụng studentId thay vì invoiceId
  const descString = `HT${studentId}`;
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
    const amount = parseInt(cashAmount);
    if (isNaN(amount) || amount <= 0) return toast.error("Số tiền không hợp lệ");

    setIsProcessing(true);
    try {
      const res = await processStudentPayment(studentId, amount, "CASH");
      if (res.success) {
        toast.success("Đã xác nhận thu tiền mặt thành công");
        onClose(); // Đóng modal và để trang refresh
        window.location.reload();
      } else {
        toast.error(res.message || "Lỗi thu tiền mặt");
      }
    } catch (e) {
      toast.error("Lỗi khi xác nhận tiền mặt");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDiscountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setDiscountPercent(Number(e.target.value) || 0);
  };

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-4xl rounded-2xl shadow-xl flex flex-col md:flex-row overflow-hidden animate-in zoom-in-95 duration-200 max-h-[90vh]">

        {/* Phần Control Panel */}
        <div className="w-full md:w-1/3 bg-slate-50 border-b md:border-b-0 md:border-r border-slate-200 p-5 flex flex-col h-full overflow-y-auto">
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
              <label className="text-xs font-bold text-slate-500 uppercase">Phần trăm Khấu hao / Giảm giá (%)</label>
              <input
                type="number"
                min="0"
                max="100"
                value={discountPercent}
                onChange={handleDiscountChange}
                className="w-full h-11 px-3 border border-slate-200 rounded-xl bg-white text-sm font-semibold focus:ring-2 focus:ring-blue-100 outline-none transition-all"
              />
            </div>

            <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
              <div className="flex justify-between items-center text-sm">
                <span className="text-slate-500 font-medium">Tổng phí gốc:</span>
                <span className="font-bold text-slate-700">{originalPrice.toLocaleString('vi-VN')} đ</span>
              </div>
              <div className="flex justify-between items-center text-sm text-emerald-600">
                <span className="font-medium">Giảm trừ ({discountPercent}%):</span>
                <span className="font-bold">-{(originalPrice * discountPercent / 100).toLocaleString('vi-VN')} đ</span>
              </div>
              <div className="pt-3 border-t border-slate-100 flex justify-between items-center">
                <span className="text-sm font-bold text-slate-800">Thực nhận:</span>
                <span className="text-lg font-extrabold text-blue-600">{finalPrice.toLocaleString('vi-VN')} đ</span>
              </div>
            </div>

            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 mt-4">
              <label className="text-xs font-bold text-emerald-700 uppercase mb-2 block">Xác Nhận Thu Tiền Mặt</label>
              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  type="number"
                  placeholder="Nhập số tiền..."
                  value={cashAmount}
                  onChange={(e) => setCashAmount(e.target.value)}
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
            <button
              onClick={handleExportPng}
              disabled={loading || exporting || !report}
              className="w-full h-12 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-sm transition-all shadow-sm flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
            >
              {exporting ? <Loader2 size={18} className="animate-spin" /> : <Download size={18} />}
              {exporting ? "Đang xuất ảnh..." : "Tải báo cáo ảnh (PNG)"}
            </button>
            <button onClick={onClose} disabled={loading} className="w-full mt-2 h-10 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl font-bold text-sm transition-all hidden md:block disabled:opacity-50 disabled:cursor-not-allowed">
              Đóng
            </button>
          </div>
        </div>

        {/* Phần Preview Export */}
        <div className="w-full md:w-2/3 bg-slate-200 p-4 overflow-y-auto flex justify-center items-start">
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
            <div id="report-export-area" className="bg-white w-full max-w-[800px] shadow-sm rounded-lg overflow-hidden border border-slate-200">
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
                    <p className="font-extrabold text-slate-800 text-lg">{report.studentName}</p>
                  </div>
                  <div>
                    <p className="text-slate-500 mb-1 text-xs uppercase font-bold tracking-wider">Mã Tra Cứu</p>
                    <p className="font-extrabold text-slate-800 text-lg">{report.studentId.substring(0, 8)}</p>
                  </div>
                </div>
              </div>

              {/* QR Section */}
              <div className="bg-slate-50 p-6 flex items-center justify-between border-t border-slate-100">
                <div className="flex items-center gap-4">
                  <div className="p-1 bg-white rounded-xl shadow-sm border border-slate-200">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={qrUrl} alt="QR Code" crossOrigin="anonymous" className="w-24 h-24 object-contain" />
                  </div>
                  <div>
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
              </div>

              {/* Items Section */}
              <div className="p-6">
                <h3 className="text-sm font-bold text-slate-800 mb-4 uppercase tracking-wider border-l-4 border-blue-500 pl-3">Chi tiết các khoản thu</h3>
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
                      <div className="font-extrabold text-blue-700">
                        {item.amount.toLocaleString('vi-VN')} đ
                      </div>
                    </div>
                  ))}
                  <div className="flex justify-between items-center pt-3 border-t border-slate-200 mt-3 px-3">
                    <span className="font-bold text-slate-800 uppercase text-sm">Tổng thanh toán:</span>
                    <span className="text-lg font-black text-blue-600">{finalPrice.toLocaleString('vi-VN')} đ</span>
                  </div>
                </div>
              </div>

              {/* Logs Section (chỉ hiện nếu có log) */}
              {report.logs.length > 0 && (
                <div className="p-6 pt-0">
                  <h3 className="text-sm font-bold text-slate-800 mb-4 uppercase tracking-wider border-l-4 border-emerald-500 pl-3">Tình hình học tập (Các lớp đang học)</h3>
                  <div className="overflow-hidden border border-slate-200 rounded-xl">
                    <table className="w-full text-left text-sm">
                      <thead className="bg-slate-50">
                        <tr>
                          <th className="py-3 px-4 font-bold text-slate-600 border-b border-slate-200">Lớp</th>
                          <th className="py-3 px-4 font-bold text-slate-600 border-b border-slate-200 w-24">Ngày</th>
                          <th className="py-3 px-4 font-bold text-slate-600 border-b border-slate-200 text-center">Điểm danh</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {report.logs.slice(-5).map((log, i) => (
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
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {report.logs.length > 5 && (
                    <p className="text-xs text-center text-slate-400 mt-2 italic">Hiển thị 5 buổi gần nhất...</p>
                  )}
                </div>
              )}

              {/* Footer text */}
              <div className="bg-slate-800 text-slate-300 text-xs py-3 px-6 text-center">
                Cảm ơn Quý phụ huynh đã đồng hành cùng Trung tâm!
              </div>

            </div>
          )}
        </div>
      </div>
    </div>
  );
}
