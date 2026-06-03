import { auth } from "@/auth";
import { getTeacherBookingHistory } from "@/actions/queries";
import { format } from "date-fns";
import { MapPin, Calendar, CheckCircle, Clock3, History } from "lucide-react";

const SHIFTS = [
  { id: 1, label: "Ca 1", time: "07:30 - 09:00" },
  { id: 2, label: "Ca 2", time: "09:30 - 11:00" },
  { id: 3, label: "Ca 3", time: "13:30 - 15:00" },
  { id: 4, label: "Ca 4", time: "15:30 - 17:00" },
  { id: 5, label: "Ca 5", time: "17:30 - 19:00" },
  { id: 6, label: "Ca 6", time: "19:30 - 21:00" },
];

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
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[600px]">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 text-[13px] uppercase tracking-wider">
                  <th className="p-4 font-bold">Lớp học</th>
                  <th className="p-4 font-bold">Phòng</th>
                  <th className="p-4 font-bold">Ngày dạy</th>
                  <th className="p-4 font-bold">Ca học</th>
                  <th className="p-4 font-bold text-right">Trạng thái</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {history.map((item) => {
                  const isPending = item.status === "PENDING";
                  const shiftInfo = SHIFTS.find((s) => s.id === item.slot);
                  return (
                    <tr key={item.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="p-4">
                        <span className="font-bold text-slate-900">{item.className}</span>
                      </td>
                      <td className="p-4">
                        <div className="flex items-center gap-1.5 text-sm font-semibold text-slate-700">
                          <MapPin size={14} className="text-slate-400" />
                          {item.roomName}
                        </div>
                      </td>
                      <td className="p-4 text-sm text-slate-600 font-medium">
                        {format(item.date, "dd/MM/yyyy")}
                      </td>
                      <td className="p-4">
                        <div className="flex flex-col">
                          <span className="text-sm font-bold text-slate-700">Ca {item.slot}</span>
                          <span className="text-[11px] text-slate-500 font-medium">{shiftInfo?.time}</span>
                        </div>
                      </td>
                      <td className="p-4 text-right">
                        <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold ${
                          isPending 
                            ? "bg-amber-100 text-amber-700 border border-amber-200" 
                            : "bg-green-100 text-green-700 border border-green-200"
                        }`}>
                          {isPending ? <Clock3 size={12} /> : <CheckCircle size={12} />}
                          {isPending ? "Chờ duyệt" : "Đã duyệt"}
                        </div>
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
