import { auth } from "@/auth";
import { getTeacherBookingHistory } from "@/actions/queries";
import { format } from "date-fns";
import { MapPin, Calendar, CheckCircle, Clock3, History, XCircle } from "lucide-react";
import UndoFinalizeButton from "./UndoFinalizeButton";


export default async function BookingHistoryPage() {
  const session = await auth();
  if (!session?.user) {
    return <div className="p-8 text-center text-slate-500">Vui lòng đăng nhập</div>;
  }

  const history = await getTeacherBookingHistory(session.user.id);

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-8">
      <div className="mb-6 flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
          <History className="text-blue-600" size={20} />
        </div>
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900">Lịch Sử Đặt Phòng</h1>
          <p className="text-sm text-slate-500 mt-1">Danh sách các yêu cầu đặt phòng của bạn</p>
        </div>
      </div>

      {history.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl p-16 text-center shadow-sm">
          <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Calendar size={24} className="text-slate-400" />
          </div>
          <h3 className="text-lg font-bold text-slate-700 mb-2">Chưa có lịch sử</h3>
          <p className="text-slate-500">Bạn chưa thực hiện bất kỳ yêu cầu đặt phòng nào.</p>
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
          {/* MOBILE VIEW */}
          <div className="block md:hidden divide-y divide-slate-100">
            {history.map((item) => {
              const isPending = item.status === "PENDING";
              const isCompleted = item.status === "COMPLETED";
              const isFreelance = item.classId === "freelance";
              return (
                <div key={item.id} className="p-4 flex flex-col gap-3">
                  <div className="flex items-start justify-between gap-2">
                    <span className="font-bold text-slate-900 text-sm leading-tight">{item.className}</span>
                    <div className={`shrink-0 inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold ${isPending
                        ? "bg-amber-100 text-amber-700 border border-amber-200"
                        : "bg-green-100 text-green-700 border border-green-200"
                      }`}>
                      {isPending ? <Clock3 size={10} /> : <CheckCircle size={10} />}
                      {isPending ? "Chờ duyệt" : "Đã duyệt"}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="flex items-center gap-1.5 text-slate-600 font-medium">
                      <Calendar size={14} className="text-slate-400 shrink-0" />
                      {format(new Date(item.date), "dd/MM/yyyy")}
                    </div>
                    <div className="flex items-center gap-1.5 font-semibold text-slate-700">
                      <MapPin size={14} className="text-slate-400 shrink-0" />
                      <span className="truncate">{item.roomName}</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-slate-600 font-medium col-span-2">
                      <Clock3 size={14} className="text-slate-400 shrink-0" />
                      <span>{format(new Date(item.startTime), "HH:mm")} - {format(new Date(item.endTime), "HH:mm")}</span>
                    </div>
                    {isFreelance && item.roomFee > 0 && (
                      <div className="flex items-center gap-1.5 font-semibold text-rose-600 col-span-2 mt-1 border-t border-slate-100 pt-2">
                        Phí phòng: {item.roomFee.toLocaleString("vi-VN")}đ
                      </div>
                    )}
                  </div>

                  {isCompleted && (
                    <div className="pt-2 border-t border-slate-100">
                      <UndoFinalizeButton sessionId={item.id} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* DESKTOP VIEW */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[600px]">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 text-[13px] uppercase tracking-wider">
                  <th className="p-4 font-bold">Lớp học</th>
                  <th className="p-4 font-bold">Phòng</th>
                  <th className="p-4 font-bold">Ngày dạy</th>
                  <th className="p-4 font-bold">Thời gian</th>
                  <th className="p-4 font-bold text-right">Trạng thái</th>
                  <th className="p-4 font-bold text-right">Hành động</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {history.map((item) => {
                  const isPending = item.status === "PENDING";
                  const isCompleted = item.status === "COMPLETED";
                  const isFreelance = item.classId === "freelance";
                  return (
                    <tr key={item.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="p-4">
                        <div className="flex flex-col">
                          <span className="font-bold text-slate-900">{item.className}</span>
                          {isFreelance && item.roomFee > 0 && (
                            <span className="text-[11px] font-semibold text-rose-600 mt-0.5">
                              Phí phòng: {item.roomFee.toLocaleString("vi-VN")}đ
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="p-4">
                        <div className="flex items-center gap-1.5 text-sm font-semibold text-slate-700">
                          <MapPin size={14} className="text-slate-400" />
                          {item.roomName}
                        </div>
                      </td>
                      <td className="p-4 text-sm text-slate-600 font-medium">
                        {format(new Date(item.date), "dd/MM/yyyy")}
                      </td>
                      <td className="p-4">
                        <div className="flex flex-col">
                          <span className="text-sm font-bold text-slate-700">{format(new Date(item.startTime), "HH:mm")}</span>
                          <span className="text-[11px] text-slate-500 font-medium">đến {format(new Date(item.endTime), "HH:mm")}</span>
                        </div>
                      </td>
                      <td className="p-4 text-right">
                        {(() => {
                          if (item.status === "CANCELLED") {
                            return (
                              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-rose-100 text-rose-700 border border-rose-200">
                                <XCircle size={12} />
                                Đã huỷ
                              </div>
                            );
                          }
                          if (item.isCancelRequested) {
                            return (
                              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-orange-100 text-orange-700 border border-orange-200">
                                <Clock3 size={12} />
                                Chờ duyệt huỷ
                              </div>
                            );
                          }
                          if (item.status === "PENDING") {
                            return (
                              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-700 border border-amber-200">
                                <Clock3 size={12} />
                                Chờ duyệt ĐK
                              </div>
                            );
                          }
                          if (item.status === "COMPLETED") {
                            return (
                              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-indigo-100 text-indigo-700 border border-indigo-200">
                                <CheckCircle size={12} />
                                Đã hoàn thành
                              </div>
                            );
                          }
                          return (
                            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-700 border border-emerald-200">
                              <CheckCircle size={12} />
                              Đã duyệt
                            </div>
                          );
                        })()}
                      </td>
                      <td className="p-4 text-right">
                        {isCompleted ? <UndoFinalizeButton sessionId={item.id} /> : <span className="text-xs text-slate-400">-</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
