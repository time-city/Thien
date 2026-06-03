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
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 12;

  useEffect(() => { setData(initialData); }, [initialData]);

  const filteredData = useMemo(() => {
    const k = search.toLowerCase();
    return data.filter(i => i.studentName.toLowerCase().includes(k) || (i.transactionCode || "").toLowerCase().includes(k));
  }, [data, search]);

  const paginatedData = filteredData.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);
  const totalPages = Math.max(1, Math.ceil(filteredData.length / itemsPerPage));

  return (
    <div className="w-full max-w-7xl mx-auto pb-8 font-sans text-slate-800">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-lg font-black flex items-center gap-2"><Banknote size={18} className="text-blue-600" /> Lịch sử thu phí</h1>
        <div className="relative w-64">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input value={search} onChange={(e) => { setSearch(e.target.value); setCurrentPage(1); }} placeholder="Tìm tên HS, mã GD..." className="w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 py-2 text-xs outline-none focus:ring-1 focus:ring-blue-500" />
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
        <div className="md:hidden divide-y divide-slate-100">
          {paginatedData.map((item) => (
            <div key={item.id} className="p-3 flex justify-between items-center">
              <div>
                <p className="font-bold text-xs">{item.studentName}</p>
                <p className="text-[10px] text-slate-400">{item.className} • {formatDate(item.paymentDate)}</p>
              </div>
              <p className="font-black text-blue-600 text-xs">{formatCurrency(item.amount)}</p>
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
                <th className="py-2.5 px-4">Số tiền</th>
                <th className="py-2.5 px-4">Mã GD</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {paginatedData.map((item) => (
                <tr key={item.id} className="hover:bg-slate-50/50">
                  <td className="py-2 px-4 text-xs text-slate-600">{formatDate(item.paymentDate)}</td>
                  <td className="py-2 px-4 text-xs font-bold text-slate-900">{item.studentName}</td>
                  <td className="py-2 px-4 text-xs text-slate-600 truncate max-w-[150px]">{item.className}</td>
                  <td className="py-2 px-4 text-xs font-black text-blue-600">{formatCurrency(item.amount)}</td>
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