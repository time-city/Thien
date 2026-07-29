"use client";

import React, { useState, useCallback, useTransition, useEffect } from "react";
import { getZaloMessageLogs, ZaloLogItem, GetZaloLogsResult } from "@/actions/zalo";
import { ZaloMessageType } from "@prisma/client";
import { MessageSquare, CheckCircle2, XCircle, ChevronLeft, ChevronRight, Search, Filter } from "lucide-react";

// ─── Cấu hình badge theo loại tin nhắn ─────────────────────────────────────
const MESSAGE_TYPE_CONFIG: Record<
  ZaloMessageType | "ALL",
  { label: string; badgeClass: string }
> = {
  ALL:               { label: "Tất cả",            badgeClass: "bg-slate-100 text-slate-700" },
  PAYMENT_CONFIRM:   { label: "Xác nhận TT",        badgeClass: "bg-emerald-100 text-emerald-700" },
  TUITION_REMINDER:  { label: "Nhắc nợ học phí",    badgeClass: "bg-red-100 text-red-700" },
  ADVANCE_BILLING:   { label: "Nhắc kỳ tới",        badgeClass: "bg-amber-100 text-amber-700" },
  ATTENDANCE_REPORT: { label: "Báo cáo học tập",    badgeClass: "bg-blue-100 text-blue-700" },
  SALARY_NOTIFY:     { label: "Lương giáo viên",    badgeClass: "bg-violet-100 text-violet-700" },
};

const ALL_TYPES = Object.keys(MESSAGE_TYPE_CONFIG) as (ZaloMessageType | "ALL")[];

function Badge({ type }: { type: ZaloMessageType }) {
  const cfg = MESSAGE_TYPE_CONFIG[type];
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${cfg.badgeClass}`}>
      {cfg.label}
    </span>
  );
}

function formatDateTime(date: Date) {
  const d = new Date(date);
  return d.toLocaleString("vi-VN", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

// ─── Component chính ─────────────────────────────────────────────────────────
export default function ZaloLogClient({ initialData }: { initialData: GetZaloLogsResult }) {
  const [data, setData] = useState<GetZaloLogsResult>(initialData);
  const [isPending, startTransition] = useTransition();

  // Filters
  const [messageType, setMessageType] = useState<ZaloMessageType | "ALL">("ALL");
  const [studentName, setStudentName] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [page, setPage] = useState(1);

  // Expanded row để xem full message
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const fetchLogs = useCallback(
    (newPage: number, type: ZaloMessageType | "ALL", name: string, from: string, to: string) => {
      startTransition(async () => {
        const result = await getZaloMessageLogs({
          page: newPage,
          pageSize: 30,
          messageType: type,
          studentName: name || undefined,
          fromDate: from || undefined,
          toDate: to || undefined,
        });
        setData(result);
        setPage(newPage);
      });
    },
    []
  );

  const handlePageChange = (newPage: number) => {
    fetchLogs(newPage, messageType, studentName, fromDate, toDate);
  };

  useEffect(() => {
    // Skip initial fetch since initialData is already there
    // But since it's hard to track without a ref, a simple debounce is fine.
    const handler = setTimeout(() => {
      fetchLogs(1, messageType, studentName, fromDate, toDate);
    }, 300);

    return () => clearTimeout(handler);
  }, [messageType, studentName, fromDate, toDate, fetchLogs]);

  const totalPages = Math.ceil(data.total / data.pageSize);

  return (
    <div className="p-4 max-w-full">
      {/* Header */}
      <div className="flex items-center gap-2 mb-5">
        <MessageSquare size={20} className="text-violet-600" />
        <h1 className="text-lg font-black text-slate-800">Lịch sử tin nhắn Zalo</h1>
        <span className="ml-2 text-xs text-slate-400 font-medium">({data.total} tin)</span>
      </div>

      {/* Filter bar */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 mb-4 flex flex-wrap gap-3 items-end shadow-sm">
        {/* Loại tin nhắn */}
        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold text-slate-500 flex items-center gap-1">
            <Filter size={12} /> Loại tin
          </label>
          <select
            className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400"
            value={messageType}
            onChange={(e) => setMessageType(e.target.value as ZaloMessageType | "ALL")}
          >
            {ALL_TYPES.map((t) => (
              <option key={t} value={t}>{MESSAGE_TYPE_CONFIG[t].label}</option>
            ))}
          </select>
        </div>

        {/* Tên học sinh */}
        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold text-slate-500 flex items-center gap-1">
            <Search size={12} /> Học sinh
          </label>
          <input
            type="text"
            placeholder="Tìm theo tên..."
            className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400"
            value={studentName}
            onChange={(e) => setStudentName(e.target.value)}
          />
        </div>

        {/* Từ ngày */}
        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold text-slate-500">Từ ngày</label>
          <input
            type="date"
            className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
          />
        </div>

        {/* Đến ngày */}
        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold text-slate-500">Đến ngày</label>
          <input
            type="date"
            className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
          />
        </div>

      </div>

      {/* Table */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-left px-4 py-3 font-semibold text-slate-600 whitespace-nowrap">Thời gian</th>
                <th className="text-left px-4 py-3 font-semibold text-slate-600 whitespace-nowrap">Loại</th>
                <th className="text-left px-4 py-3 font-semibold text-slate-600 whitespace-nowrap">Học sinh</th>
                <th className="text-left px-4 py-3 font-semibold text-slate-600 whitespace-nowrap">SĐT</th>
                <th className="text-left px-4 py-3 font-semibold text-slate-600">Nội dung</th>
                <th className="text-center px-4 py-3 font-semibold text-slate-600 whitespace-nowrap">Trạng thái</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data.logs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-12 text-slate-400">
                    Không có tin nhắn nào
                  </td>
                </tr>
              ) : (
                data.logs.map((log) => (
                  <React.Fragment key={log.id}>
                    <tr
                      key={log.id}
                      className={`hover:bg-slate-50 cursor-pointer transition-colors ${!log.success ? "bg-red-50" : ""}`}
                      onClick={() => setExpandedId(expandedId === log.id ? null : log.id)}
                    >
                      <td className="px-4 py-3 text-xs text-slate-500 whitespace-nowrap">
                        {formatDateTime(log.sentAt)}
                      </td>
                      <td className="px-4 py-3">
                        <Badge type={log.messageType} />
                      </td>
                      <td className="px-4 py-3 font-medium text-slate-700 whitespace-nowrap">
                        {log.studentName ?? <span className="text-slate-400 italic">—</span>}
                      </td>
                      <td className="px-4 py-3 text-slate-600 whitespace-nowrap font-mono text-xs">
                        {log.phone}
                      </td>
                      <td className="px-4 py-3 text-slate-600 max-w-xs">
                        <p className="truncate text-xs">{log.message.replace(/\*\*\*/g, "").substring(0, 80)}…</p>
                      </td>
                      <td className="px-4 py-3 text-center">
                        {log.success ? (
                          <CheckCircle2 size={18} className="text-emerald-500 mx-auto" />
                        ) : (
                          <span title={log.errorNote ?? ""}>
                            <XCircle size={18} className="text-red-500 mx-auto" />
                          </span>
                        )}
                      </td>
                    </tr>
                    {/* Expanded row */}
                    {expandedId === log.id && (
                      <tr key={`${log.id}-expanded`} className="bg-slate-50">
                        <td colSpan={6} className="px-6 py-4">
                          <div className="text-xs space-y-2">
                            <p className="font-semibold text-slate-600">Nội dung đầy đủ:</p>
                            <pre className="whitespace-pre-wrap font-sans text-slate-700 bg-white border border-slate-200 rounded-lg p-3 max-h-48 overflow-y-auto">
                              {log.message.replace(/\*\*\*/g, "")}
                            </pre>
                            {!log.success && log.errorNote && (
                              <div className="text-red-600 font-medium mt-2">
                                ❌ Lý do thất bại: {log.errorNote}
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-slate-200 bg-slate-50">
            <p className="text-xs text-slate-500">
              Trang {page} / {totalPages} ({data.total} tin)
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => handlePageChange(page - 1)}
                disabled={page <= 1 || isPending}
                className="p-1.5 rounded-lg border border-slate-200 hover:bg-white disabled:opacity-40 transition-colors"
              >
                <ChevronLeft size={16} />
              </button>
              <button
                onClick={() => handlePageChange(page + 1)}
                disabled={page >= totalPages || isPending}
                className="p-1.5 rounded-lg border border-slate-200 hover:bg-white disabled:opacity-40 transition-colors"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
