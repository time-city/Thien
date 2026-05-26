"use client";

import React, { useRef } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import html2canvas from 'html2canvas';
import { Student } from '@/lib/mock-data';

export default function ReportTemplate({ student }: { student: Student }) {
  const reportRef = useRef<HTMLDivElement>(null);

  const exportToPNG = async () => {
    if (!reportRef.current) return;
    try {
      const canvas = await html2canvas(reportRef.current, {
        scale: 2,
        backgroundColor: '#ffffff', // Trắng tinh chuẩn báo cáo
        useCORS: true,
      });
      const dataUrl = canvas.toDataURL('image/png');
      const link = document.createElement('a');
      link.download = `Bao_Cao_${student.id}_${student.name.replace(/\s/g, '_')}.png`;
      link.href = dataUrl;
      link.click();
    } catch (error) {
      console.error("Lỗi xuất ảnh:", error);
      alert("Xuất PNG thất bại.");
    }
  };

  const presentCount = student.logs.filter(l => l.attendance === 'PRESENT' || l.attendance === 'LATE').length;
  const absentCount = student.logs.filter(l => l.attendance === 'EXCUSED' || l.attendance === 'UNEXCUSED').length;

  return (
    <div className="flex flex-col gap-4 items-start w-full max-w-sm">
      <button
        onClick={exportToPNG}
        className="w-full bg-blue-600 hover:bg-blue-700 h-12 text-white font-medium rounded-lg transition-colors flex items-center justify-center gap-2 shadow-sm"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/></svg>
        Tải Báo Cáo PNG
      </button>

      {/* Frame Report - Nền Trắng, Sạch Sẽ */}
      <div
        ref={reportRef}
        className="w-[375px] bg-white border border-slate-200 p-6 flex flex-col gap-6 text-slate-800 font-sans shadow-lg relative overflow-hidden"
        style={{ minHeight: '667px' }}
      >
        {/* Header */}
        <div className="text-center border-b border-slate-200 pb-4">
          <h2 className="text-xl font-bold uppercase tracking-wide text-slate-900">Báo Cáo Học Tập</h2>
          <p className="text-sm text-slate-500 mt-1 uppercase tracking-widest font-medium">Trung tâm Nông Trại KHTN</p>
        </div>

        {/* Thông tin Overview */}
        <div className="flex flex-col gap-4 bg-slate-50 p-4 rounded-xl border border-slate-100">
          <div className="flex justify-between items-center text-sm">
            <span className="text-slate-500">Họ và tên:</span>
            <span className="font-bold text-base text-slate-900">{student.name}</span>
          </div>
          <div className="flex justify-between items-center text-sm">
            <span className="text-slate-500">Lớp học:</span>
            <span className="font-semibold text-slate-700 bg-white px-3 py-1 rounded-md shadow-sm border border-slate-200">
              {student.className}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-4 mt-2 border-t border-slate-200 pt-4">
            <div className="flex flex-col">
              <span className="text-xs text-slate-500 mb-1">Hiện diện</span>
              <span className="font-bold text-emerald-600">{presentCount} / {student.logs.length} buổi</span>
            </div>
            <div className="flex flex-col">
              <span className="text-xs text-slate-500 mb-1">Vắng mặt</span>
              <span className="font-bold text-rose-600">{absentCount} buổi</span>
            </div>
          </div>
        </div>

        {/* Lịch sử */}
        <div className="flex-1">
          <h3 className="text-sm font-bold mb-4 text-slate-800 flex items-center gap-2">
            <div className="w-1.5 h-4 bg-blue-600 rounded-full"></div>
            CHI TIẾT 5 BUỔI GẦN NHẤT
          </h3>
          <div className="flex flex-col gap-3">
            {student.logs.slice(-5).reverse().map((log, idx) => (
              <div key={idx} className="flex flex-col p-3 bg-white border border-slate-200 rounded-lg shadow-sm gap-2">
                <div className="flex justify-between items-center border-b border-slate-100 pb-2">
                  <span className="font-bold text-sm text-slate-800">Buổi {log.sessionNumber}</span>
                  <span className="text-xs font-medium text-slate-500 bg-slate-50 px-2 py-1 rounded-md">{log.date}</span>
                </div>
                <div className="flex gap-2 text-xs font-semibold">
                  <span className={`px-2 py-1 rounded-md ${
                    log.attendance === 'PRESENT' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' :
                    log.attendance === 'LATE' ? 'bg-amber-50 text-amber-700 border border-amber-100' :
                    log.attendance === 'EXCUSED' ? 'bg-orange-50 text-orange-700 border border-orange-100' : 
                    'bg-rose-50 text-rose-700 border border-rose-100'
                  }`}>
                    {log.attendance === 'PRESENT' ? 'Có mặt' : log.attendance === 'LATE' ? 'Trễ' : log.attendance === 'EXCUSED' ? 'Phép' : 'Vắng'}
                  </span>
                  <span className={`px-2 py-1 rounded-md ${
                    log.homework === 'GOOD' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' :
                    log.homework === 'DONE' ? 'bg-amber-50 text-amber-700 border border-amber-100' : 
                    'bg-rose-50 text-rose-700 border border-rose-100'
                  }`}>
                    BTVN: {log.homework === 'GOOD' ? 'Tốt' : log.homework === 'DONE' ? 'Đạt' : 'Kém'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer & QR */}
        <div className="flex justify-between items-center mt-auto pt-6 border-t border-slate-200">
          <div className="text-xs text-slate-500 max-w-[190px] leading-relaxed">
            Mã QR ID học viên. Sử dụng để thanh toán học phí & quét tại lớp.
          </div>
          <div className="p-2 border border-slate-200 rounded-xl bg-white shadow-sm">
            <QRCodeSVG value={`HP ${student.id} ${student.className}`} size={70} />
          </div>
        </div>
      </div>
    </div>
  );
}
