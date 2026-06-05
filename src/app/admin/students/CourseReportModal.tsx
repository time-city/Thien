"use client";

import { useState, useEffect } from "react";
import { X, Download, FileText, Loader2 } from "lucide-react";
import { getStudentCourseReport, StudentCourseReport } from "@/actions/report";
import { toast } from "sonner";
import { toPng } from "html-to-image";

export default function CourseReportModal({
  isOpen,
  onClose,
  studentId,
  studentName,
  classId,
  className,
}: {
  isOpen: boolean;
  onClose: () => void;
  studentId: string;
  studentName: string;
  classId: string;
  className: string;
}) {
  const [report, setReport] = useState<StudentCourseReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [discountPercent, setDiscountPercent] = useState<number>(0);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    let isMounted = true;
    setLoading(true);
    getStudentCourseReport(studentId, classId).then((data) => {
      if (isMounted) {
        setReport(data);
        setLoading(false);
      }
    }).catch(() => {
      if (isMounted) {
        toast.error("Không thể tải báo cáo học tập");
        setLoading(false);
      }
    });
    return () => { isMounted = false; };
  }, [isOpen, studentId, classId]);

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
      link.download = `BaoCao_${studentName.replace(/\s+/g, "_")}_${className.replace(/\s+/g, "_")}.png`;
      link.click();
      toast.success("Đã tải ảnh báo cáo thành công!");
    } catch (err) {
      console.error(err);
      toast.error("Lỗi khi xuất ảnh PNG");
    } finally {
      setExporting(false);
    }
  };

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

  const originalPrice = report ? report.pricePerSession : 0;
  const finalPrice = Math.max(0, originalPrice - (originalPrice * discountPercent) / 100);

  // Generate VietQR URL
  const identifier = report?.enrollmentId || studentId;
  const descString = `HT${identifier}`;
  const qrUrl = `https://qr.sepay.vn/img?bank=MBBank&acc=0700107189999&amount=${finalPrice}&des=${encodeURIComponent(descString)}&template=`;

  console.log("Thông tin tạo mã QR:", {
    bank: "MBBank",
    bankAccount: "0700107189999",
    amount: finalPrice,
    description: descString,
    qrUrl
  });

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-4xl rounded-2xl shadow-xl flex flex-col md:flex-row overflow-hidden animate-in zoom-in-95 duration-200 max-h-[90vh]">
        
        {/* Phần Control Panel */}
        <div className="w-full md:w-1/3 bg-slate-50 border-b md:border-b-0 md:border-r border-slate-200 p-5 flex flex-col h-full overflow-y-auto">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-lg font-extrabold text-slate-800 flex items-center gap-2">
              <FileText size={20} className="text-blue-600" /> Báo Cáo Học Tập
            </h2>
            <button onClick={onClose} className="p-1.5 bg-slate-200 hover:bg-slate-300 rounded-full text-slate-600 transition-colors md:hidden">
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
                onChange={(e) => setDiscountPercent(Number(e.target.value) || 0)}
                className="w-full h-11 px-3 border border-slate-200 rounded-xl bg-white text-sm font-semibold focus:ring-2 focus:ring-blue-100 outline-none transition-all"
              />
            </div>
            
            <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
              <div className="flex justify-between items-center text-sm">
                <span className="text-slate-500 font-medium">Học phí gốc:</span>
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
            
            <div className="bg-blue-50 text-blue-700 text-xs p-3 rounded-xl border border-blue-100 leading-relaxed">
              Dùng tính năng này để xuất báo cáo cuối khóa kèm QR code đóng tiền cho khóa mới. Ảnh tải xuống sẽ có chất lượng cao để gửi cho phụ huynh.
            </div>
          </div>

          <div className="mt-6 pt-4 border-t border-slate-200">
            <button
              onClick={handleExportPng}
              disabled={loading || exporting || !report}
              className="w-full h-12 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-sm transition-all shadow-sm flex items-center justify-center gap-2 disabled:opacity-70"
            >
              {exporting ? <Loader2 size={18} className="animate-spin" /> : <Download size={18} />}
              {exporting ? "Đang xuất ảnh..." : "Tải báo cáo ảnh (PNG)"}
            </button>
            <button onClick={onClose} className="w-full mt-2 h-10 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl font-bold text-sm transition-all hidden md:block">
              Đóng
            </button>
          </div>
        </div>

        {/* Phần Preview Export */}
        <div className="w-full md:w-2/3 bg-slate-200 p-4 overflow-y-auto flex justify-center items-start">
          {loading ? (
            <div className="flex flex-col items-center justify-center h-64 text-slate-500">
              <Loader2 size={32} className="animate-spin mb-4 text-blue-500" />
              <p className="font-medium">Đang tải dữ liệu báo cáo...</p>
            </div>
          ) : !report ? (
            <div className="flex flex-col items-center justify-center h-64 text-slate-500">
              <p className="font-medium">Không có dữ liệu báo cáo cho lớp này.</p>
            </div>
          ) : (
            <div id="report-export-area" className="bg-white w-full max-w-[800px] shadow-sm rounded-lg overflow-hidden border border-slate-200">
              {/* Header Bill */}
              <div className="bg-blue-600 p-6 text-white text-center">
                <h1 className="text-2xl font-black uppercase tracking-wider mb-1">TRUNG TÂM GIÁO DỤC</h1>
                <p className="text-blue-100 text-sm font-medium">BÁO CÁO KẾT QUẢ HỌC TẬP KHÓA HỌC</p>
              </div>

              {/* Info Section */}
              <div className="p-6 border-b border-slate-100">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-slate-500 mb-1 text-xs uppercase font-bold tracking-wider">Học sinh</p>
                    <p className="font-extrabold text-slate-800 text-lg">{report.studentName}</p>
                  </div>
                  <div>
                    <p className="text-slate-500 mb-1 text-xs uppercase font-bold tracking-wider">Lớp học</p>
                    <p className="font-extrabold text-slate-800 text-lg">{report.className}</p>
                  </div>
                </div>
              </div>

              {/* Table Section */}
              <div className="p-6">
                <h3 className="text-sm font-bold text-slate-800 mb-4 uppercase tracking-wider border-l-4 border-blue-500 pl-3">Chi tiết các buổi học</h3>
                <div className="overflow-hidden border border-slate-200 rounded-xl">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-slate-50">
                      <tr>
                        <th className="py-3 px-4 font-bold text-slate-600 border-b border-slate-200 w-24">Ngày</th>
                        <th className="py-3 px-4 font-bold text-slate-600 border-b border-slate-200 w-24 text-center">Điểm danh</th>
                        <th className="py-3 px-4 font-bold text-slate-600 border-b border-slate-200 w-24 text-center">Bài tập</th>
                        <th className="py-3 px-4 font-bold text-slate-600 border-b border-slate-200">Nhận xét GV</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {report.logs.length === 0 ? (
                        <tr><td colSpan={4} className="py-6 text-center text-slate-500 italic">Chưa có dữ liệu buổi học nào</td></tr>
                      ) : report.logs.map((log, i) => (
                        <tr key={i} className="hover:bg-slate-50/50">
                          <td className="py-3 px-4 text-slate-700 font-medium whitespace-nowrap">
                            {new Date(log.date).toLocaleDateString("vi-VN")}
                          </td>
                          <td className="py-3 px-4 text-center">
                            <span className={`text-[10px] font-bold px-2 py-1 rounded-md uppercase ${
                              log.attendanceStatus === "PRESENT" ? "bg-emerald-100 text-emerald-700" :
                              log.attendanceStatus === "ABSENT" ? "bg-rose-100 text-rose-700" : "bg-amber-100 text-amber-700"
                            }`}>
                              {log.attendanceStatus === "PRESENT" ? "Có mặt" : log.attendanceStatus === "ABSENT" ? "Vắng" : "Có phép"}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-center">
                            {log.homeworkStatus ? (
                              <span className={`text-[10px] font-bold px-2 py-1 rounded-md uppercase ${
                                log.homeworkStatus === "COMPLETED" ? "bg-emerald-100 text-emerald-700" :
                                log.homeworkStatus === "NOT_COMPLETED" ? "bg-rose-100 text-rose-700" : "bg-blue-100 text-blue-700"
                              }`}>
                                {log.homeworkStatus === "COMPLETED" ? "Đã làm" : log.homeworkStatus === "NOT_COMPLETED" ? "Chưa làm" : "Làm tốt"}
                              </span>
                            ) : <span className="text-slate-300">-</span>}
                          </td>
                          <td className="py-3 px-4 text-slate-600 text-xs leading-relaxed">
                            {log.note || <span className="text-slate-300 italic">Không có nhận xét</span>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Upsale / QR Code Section */}
              <div className="bg-slate-50 p-6 flex items-center justify-between border-t border-slate-200">
                <div className="space-y-2 pr-6 max-w-[60%]">
                  <h3 className="text-base font-extrabold text-slate-800 uppercase text-blue-700">ĐĂNG KÝ KHÓA TIẾP THEO</h3>
                  <p className="text-sm text-slate-600 leading-relaxed">
                    Khóa học hiện tại đã kết thúc. Để tiếp tục hành trình học tập, Quý phụ huynh vui lòng quét mã QR để gia hạn học phí khóa mới.
                  </p>
                  <div className="mt-4 inline-block bg-white border border-slate-200 px-4 py-2 rounded-lg">
                    <p className="text-xs text-slate-500 uppercase font-bold tracking-wider mb-1">Tổng học phí khóa mới</p>
                    <p className="text-xl font-black text-blue-600">{finalPrice.toLocaleString('vi-VN')} VNĐ</p>
                  </div>
                </div>
                <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm shrink-0 flex flex-col items-center">
                  <img src={qrUrl} alt="QR Code" className="w-32 h-32 object-contain" crossOrigin="anonymous" />
                  <button 
                    onClick={handleDownloadQr}
                    className="mt-3 flex items-center gap-1 text-[10px] bg-slate-100 hover:bg-slate-200 text-slate-700 py-1.5 px-3 rounded-md font-bold uppercase transition-colors"
                  >
                    <Download size={12} /> Tải QR
                  </button>
                </div>
              </div>
              
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
