"use client";
import React, { useState, useEffect } from 'react';
import { format } from "date-fns";
import { vi } from "date-fns/locale";

export default function TuitionExceptionClient() {
  const [exceptions, setExceptions] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetch('/api/tuition-exceptions')
      .then(res => res.json())
      .then(data => {
        setExceptions(data);
        setIsLoading(false);
      })
      .catch(err => {
        console.error(err);
        setIsLoading(false);
      });
  }, []);

  return (
    <div className="p-6 bg-slate-50 min-h-screen">
      <div className="mb-6 flex justify-between items-end">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Sổ Nam Tào</h1>
          <p className="text-slate-500 mt-1">
            Ghi log các trường hợp phụ huynh thanh toán thiếu hoặc dư tiền học phí.
          </p>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-600">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-700 font-semibold">
              <tr>
                <th className="px-6 py-4 whitespace-nowrap">Thời gian</th>
                <th className="px-6 py-4 whitespace-nowrap">Học sinh</th>
                <th className="px-6 py-4 whitespace-nowrap">Loại log</th>
                <th className="px-6 py-4 whitespace-nowrap">Số tiền</th>
                <th className="px-6 py-4 whitespace-nowrap">Ghi chú</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-slate-400">
                    Đang tải dữ liệu...
                  </td>
                </tr>
              ) : exceptions.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-slate-400">
                    Chưa có log đóng thiếu/dư nào.
                  </td>
                </tr>
              ) : (
                exceptions.map((exc: any) => (
                  <tr key={exc.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      {format(new Date(exc.createdAt), 'dd/MM/yyyy HH:mm', { locale: vi })}
                    </td>
                    <td className="px-6 py-4 font-medium text-slate-800">
                      {exc.student?.fullName || "Không xác định"}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {exc.type === 'UNDERPAID' ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-700">
                          Đóng thiếu
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-700">
                          Đóng dư
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 font-bold text-slate-900 whitespace-nowrap">
                      {exc.amount.toLocaleString("vi-VN")} đ
                    </td>
                    <td className="px-6 py-4 max-w-xs truncate text-slate-500">
                      {exc.note}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
