"use client";

import { useMemo, useState } from "react";
import { BadgeDollarSign, CalendarClock, FileText, CalendarDays } from "lucide-react";
import type { SalaryHistoryItem } from "@/actions/queries";

function formatDateTime(value: Date) {
  return new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function formatCurrency(amount: number) {
  return `${Number(amount || 0).toLocaleString("vi-VN")}đ`;
}

export default function MySalaryHistoryClient({ initialData }: { initialData: SalaryHistoryItem[] }) {
  const [search, setSearch] = useState("");

  const filteredData = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    if (!keyword) return initialData;
    return initialData.filter((item) => (item.note || "").toLowerCase().includes(keyword));
  }, [initialData, search]);

  if (initialData.length === 0) {
    return (
      <div className="w-full max-w-4xl mx-auto py-10 px-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-slate-100 text-slate-500">
            <BadgeDollarSign size={28} />
          </div>
          <h1 className="text-xl font-extrabold text-slate-900">Lịch Sử Nhận Lương</h1>
          <p className="mt-2 text-sm text-slate-500">Thống kê các đợt trung tâm thanh toán lương cho bạn</p>
          <div className="mt-6 rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-10 text-slate-500">
            Bạn chưa có lịch sử nhận lương nào.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-7xl mx-auto pb-8 font-sans">
      {/* HEADER TỐI ƯU GỌN HƠN */}
      <div className="bg-white border border-slate-200 shadow-sm rounded-xl p-3 md:p-4 mb-4 md:mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-lg md:text-xl font-extrabold tracking-tight text-slate-900 flex items-center gap-2">
            <CalendarClock size={20} className="text-emerald-600" /> Lịch Sử Nhận Lương
          </h1>
          <p className="text-xs md:text-sm text-slate-500 font-medium mt-0.5">Thống kê các đợt trung tâm thanh toán lương cho bạn</p>
        </div>
        <div className="w-full md:max-w-xs">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Tìm theo ghi chú..."
            className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium outline-none focus:bg-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 transition-all"
          />
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
        {filteredData.length === 0 ? (
          <div className="px-4 py-12 text-center text-sm text-slate-500 font-medium">
            Không tìm thấy kết quả nào phù hợp với "{search}".
          </div>
        ) : (
          <>
            {/* =========================================
                GIAO DIỆN MOBILE (Dạng Card siêu gọn)
                ========================================= */}
            <div className="block md:hidden divide-y divide-slate-100">
              {filteredData.map((item) => (
                <div key={item.id} className="p-3 hover:bg-slate-50/80 transition-colors">
                  <div className="flex items-center justify-between mb-1">
                    <div className="font-extrabold text-[15px] text-emerald-600">
                      +{formatCurrency(item.amount)}
                    </div>
                    <div className="text-[10px] font-bold text-slate-500 flex items-center gap-1 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">
                      <CalendarDays size={10} /> {formatDateTime(item.paymentDate)}
                    </div>
                  </div>
                  <div className="text-[12px] font-medium text-slate-600 flex items-start gap-1.5 mt-2">
                    <FileText size={14} className="text-slate-400 shrink-0 mt-0.5" />
                    <span className="leading-snug">{item.note || "Không có ghi chú thêm."}</span>
                  </div>
                </div>
              ))}
            </div>

            {/* =========================================
                GIAO DIỆN DESKTOP (Dạng Table Compact)
                ========================================= */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-[10px] uppercase tracking-wider font-extrabold text-slate-500">
                    <th className="py-2.5 px-4 w-48">Thời gian nhận</th>
                    <th className="py-2.5 px-4 w-48">Số tiền</th>
                    <th className="py-2.5 px-4">Nội dung / Ghi chú</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredData.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-2 px-4 text-[12px] font-medium text-slate-600">
                        {formatDateTime(item.paymentDate)}
                      </td>
                      <td className={`py-2 px-4 text-[13px] font-extrabold ${item.amount < 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                        {item.amount > 0 ? '+' : ''}{formatCurrency(item.amount)}
                      </td>
                      <td className="py-2 px-4 text-[13px] font-medium text-slate-700">
                        {item.note || "-"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
}