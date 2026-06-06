"use client";

import { useMemo, useState, useEffect } from "react";
import { Banknote, Search, ChevronLeft, ChevronRight } from "lucide-react";
import type { TuitionHistoryItem } from "@/actions/queries";

function formatDate(value: Date) {
  return new Intl.DateTimeFormat("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(value));
}

function formatCurrency(amount: number) {
  return `${Number(amount || 0).toLocaleString("vi-VN")}đ`;
}

export default function TuitionHistoryClient({ initialData }: { initialData: TuitionHistoryItem[] }) {
  const [data, setData] = useState(initialData);
  const [search, setSearch] = useState("");
  const [dateFilter, setDateFilter] = useState(""); // YYYY-MM-DD
  const [statusFilter, setStatusFilter] = useState("UNPAID"); // "ALL", "UNPAID", "PAID"
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 12;

  useEffect(() => { setData(initialData); }, [initialData]);

  const filteredData = useMemo(() => {
    const k = search.toLowerCase();
    let result = data.filter(i => {
      const matchSearch = i.studentName.toLowerCase().includes(k) || (i.transactionCode || "").toLowerCase().includes(k);
      const matchDate = dateFilter ? new Date(i.paymentDate).toISOString().startsWith(dateFilter) : true;
      
      let matchStatus = true;
      if (statusFilter === "UNPAID") {
        matchStatus = i.status === "PENDING" || i.status === "UNDERPAID";
      } else if (statusFilter === "PAID") {
        matchStatus = i.status === "PAID" || i.status === "OVERPAID";
      }

      return matchSearch && matchDate && matchStatus;
    });

    // Sắp xếp theo ngày từ hôm nay về quá khứ
    result.sort((a, b) => new Date(b.paymentDate).getTime() - new Date(a.paymentDate).getTime());

    return result;
  }, [data, search, dateFilter, statusFilter]);

  const paginatedData = filteredData.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);
  const totalPages = Math.max(1, Math.ceil(filteredData.length / itemsPerPage));

  return (
    <div className="w-full max-w-7xl mx-auto pb-8 font-sans text-slate-800">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between mb-4 gap-3">
        <h1 className="text-lg font-black flex items-center gap-2"><Banknote size={18} className="text-blue-600" /> Lịch sử thu phí</h1>
        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
          <select
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setCurrentPage(1); }}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value="ALL">Tất cả trạng thái</option>
            <option value="UNPAID">Chưa thanh toán</option>
            <option value="PAID">Đã thanh toán</option>
          </select>
          <input 
            type="date" 
            value={dateFilter}
            onChange={(e) => { setDateFilter(e.target.value); setCurrentPage(1); }}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs outline-none focus:ring-1 focus:ring-blue-500"
          />
          <div className="relative w-full md:w-64">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input value={search} onChange={(e) => { setSearch(e.target.value); setCurrentPage(1); }} placeholder="Tìm tên HS, mã GD..." className="w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 py-2 text-xs outline-none focus:ring-1 focus:ring-blue-500" />
          </div>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
        <div className="md:hidden divide-y divide-slate-100">
          {paginatedData.map((item) => (
            <div key={item.id} className="p-3 flex justify-between items-center">
              <div className="flex flex-col items-start gap-1">
                <p className="font-bold text-xs">{item.studentName}</p>
                <p className="text-[10px] text-slate-400">{item.className} • {formatDate(item.paymentDate)}</p>
                {item.status === "PAID" ? (
                  <span className="bg-emerald-100 text-emerald-700 text-[8px] font-bold px-1.5 py-0.5 rounded-sm">ĐỦ TIỀN</span>
                ) : item.status === "UNDERPAID" ? (
                  <span className="bg-rose-100 text-rose-700 text-[8px] font-bold px-1.5 py-0.5 rounded-sm">THIẾU TIỀN</span>
                ) : item.status === "OVERPAID" ? (
                  <span className="bg-blue-100 text-blue-700 text-[8px] font-bold px-1.5 py-0.5 rounded-sm">DƯ TIỀN</span>
                ) : item.status === "PENDING" ? (
                  <span className="bg-amber-100 text-amber-700 text-[8px] font-bold px-1.5 py-0.5 rounded-sm">CHỜ THANH TOÁN</span>
                ) : item.status === "CANCELLED" ? (
                  <span className="bg-slate-100 text-slate-500 text-[8px] font-bold px-1.5 py-0.5 rounded-sm">ĐÃ HỦY</span>
                ) : (
                  <span className="bg-emerald-100 text-emerald-700 text-[8px] font-bold px-1.5 py-0.5 rounded-sm">ĐÃ NỘP</span>
                )}
              </div>
              <div className="text-right">
                <p className="font-black text-blue-600 text-xs">{formatCurrency(item.amount)}</p>
                {item.isInvoice && item.expectedAmount !== undefined && (
                  <p className="text-slate-400 text-[9px]">/ {formatCurrency(item.expectedAmount)}</p>
                )}
              </div>
            </div>
          ))}
        </div>

        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-[10px] uppercase tracking-widest font-extrabold text-slate-500">
                <th className="py-2.5 px-4">Ngày</th>
                <th className="py-2.5 px-4">Học sinh</th>
                <th className="py-2.5 px-4">Lớp</th>
                <th className="py-2.5 px-4">Thực nhận / Yêu cầu</th>
                <th className="py-2.5 px-4">Trạng thái</th>
                <th className="py-2.5 px-4">Mã GD</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {paginatedData.map((item) => (
                <tr key={item.id} className="hover:bg-slate-50/50">
                  <td className="py-2 px-4 text-xs text-slate-600">{formatDate(item.paymentDate)}</td>
                  <td className="py-2 px-4 text-xs font-bold text-slate-900">{item.studentName}</td>
                  <td className="py-2 px-4 text-xs text-slate-600 truncate max-w-[150px]">{item.className}</td>
                  <td className="py-2 px-4 text-xs">
                    <span className="font-black text-blue-600">{formatCurrency(item.amount)}</span>
                    {item.isInvoice && item.expectedAmount !== undefined && (
                      <span className="text-slate-400 text-[10px] ml-1">/ {formatCurrency(item.expectedAmount)}</span>
                    )}
                  </td>
                  <td className="py-2 px-4">
                    {item.status === "PAID" ? (
                      <span className="bg-emerald-100 text-emerald-700 text-[10px] font-bold px-2 py-0.5 rounded-full">ĐỦ TIỀN</span>
                    ) : item.status === "UNDERPAID" ? (
                      <span className="bg-rose-100 text-rose-700 text-[10px] font-bold px-2 py-0.5 rounded-full">THIẾU TIỀN</span>
                    ) : item.status === "OVERPAID" ? (
                      <span className="bg-blue-100 text-blue-700 text-[10px] font-bold px-2 py-0.5 rounded-full">DƯ TIỀN</span>
                    ) : item.status === "PENDING" ? (
                      <span className="bg-amber-100 text-amber-700 text-[10px] font-bold px-2 py-0.5 rounded-full">CHỜ THANH TOÁN</span>
                    ) : item.status === "CANCELLED" ? (
                      <span className="bg-slate-100 text-slate-500 text-[10px] font-bold px-2 py-0.5 rounded-full">ĐÃ HỦY</span>
                    ) : (
                      <span className="bg-emerald-100 text-emerald-700 text-[10px] font-bold px-2 py-0.5 rounded-full">ĐÃ NỘP</span>
                    )}
                  </td>
                  <td className="py-2 px-4 text-[10px] font-mono text-slate-400">{item.transactionCode || "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}