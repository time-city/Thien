"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";
import {
  User,
  Wallet,
  ShieldCheck,
  History,
  CreditCard,
  CheckCircle2,
  Clock,
  Loader2,
} from "lucide-react";
import { useSession } from "next-auth/react";
import { updateTeacherProfile } from "@/actions/mutations";
import type { TeachingHistory, TeacherInfo } from "@/actions/queries";

type TabType = "profile" | "wallet";

function formatVnd(amount: number) {
  return new Intl.NumberFormat("vi-VN").format(Math.round(amount)) + "đ";
}

function formatDateVn(d: Date | string) {
  const dateObj = typeof d === "string" ? new Date(d) : d;
  return new Intl.DateTimeFormat("vi-VN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(dateObj);
}

export default function TeacherSettingsPage({
  teacherInfo,
  teachingHistory = [],
}: {
  teacherInfo: TeacherInfo;
  teachingHistory: TeachingHistory[];
}) {
  const { update } = useSession();
  const [activeTab, setActiveTab] = useState<TabType>("profile");

  const [fullName, setFullName] = useState<string>(teacherInfo?.fullName || "");
  const [oldPassword, setOldPassword] = useState<string>("");
  const [newPassword, setNewPassword] = useState<string>("");
  const [confirmPassword, setConfirmPassword] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);

  // ĐẢM BẢO FULLNAME ĐƯỢC FILL VÀO NGAY KHI CÓ DATA TỪ SERVER TRUYỀN XUỐNG
  useEffect(() => {
    if (teacherInfo?.fullName) {
      setFullName(teacherInfo.fullName);
    }
  }, [teacherInfo]);

  async function handleUpdateProfile(e: React.FormEvent) {
    e.preventDefault();
    
    if (!teacherInfo?.id) {
      toast.error("Không tìm thấy thông tin tài khoản để cập nhật!");
      return;
    }

    // Validate mật khẩu (chỉ check khi người dùng có gõ vào ô mật khẩu)
    if (newPassword.trim() || confirmPassword.trim() || oldPassword.trim()) {
      if (!oldPassword.trim()) {
        toast.error("Vui lòng nhập mật khẩu hiện tại (cũ)!");
        return;
      }
      if (!newPassword.trim()) {
        toast.error("Vui lòng nhập mật khẩu mới!");
        return;
      }
      if (newPassword !== confirmPassword) {
        toast.error("Mật khẩu mới và xác nhận mật khẩu không khớp!");
        return;
      }
    }

    setLoading(true);
    try {
      const res = await updateTeacherProfile(teacherInfo.id, {
        fullName: fullName.trim(),
        oldPassword: oldPassword.trim() ? oldPassword : undefined,
        newPassword: newPassword.trim() ? newPassword : undefined,
      });

      if (!res?.success) {
        toast.error(res?.error || "Cập nhật thất bại");
        return;
      }

      toast.success("Cập nhật thông tin thành công!");
      
      // ✅ BỔ SUNG ĐỂ ÉP NEXTAUTH CẬP NHẬT TÊN MỚI LÊN TOPBAR
      await update({ fullName: fullName.trim() });

      setOldPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (error) {
      toast.error("Đã xảy ra lỗi hệ thống khi cập nhật hồ sơ");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="w-full max-w-5xl mx-auto pb-8 font-sans">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Cài đặt tài khoản</h1>
        <p className="text-sm text-slate-500 mt-1">Quản lý thông tin cá nhân và xem lịch sử thu nhập của bạn</p>
      </div>

      {/* Tabs Navigation */}
      <div className="flex space-x-6 border-b border-slate-200 mb-8 overflow-x-auto hide-scrollbar">
        <button
          onClick={() => setActiveTab("profile")}
          className={`pb-3 text-sm font-medium flex items-center gap-2 border-b-2 transition-colors whitespace-nowrap ${
            activeTab === "profile"
              ? "border-blue-600 text-blue-600"
              : "border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300"
          }`}
        >
          <User size={16} />
          Thông tin cá nhân
        </button>
        <button
          onClick={() => setActiveTab("wallet")}
          className={`pb-3 text-sm font-medium flex items-center gap-2 border-b-2 transition-colors whitespace-nowrap ${
            activeTab === "wallet"
              ? "border-blue-600 text-blue-600"
              : "border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300"
          }`}
        >
          <Wallet size={16} />
          Ví & Lịch sử
        </button>
      </div>

      {/* Tab 1: Profile */}
      {activeTab === "profile" && (
        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm max-w-2xl">
          <form className="space-y-6" onSubmit={handleUpdateProfile} autoComplete="off">

            <div className="space-y-4 border-b border-slate-100 pb-6">
              <h3 className="text-base font-semibold text-slate-800 flex items-center gap-2">
                <User className="text-slate-400" size={18} /> Hồ sơ của bạn
              </h3>
              
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Họ và tên</label>
                <input
                  type="text"
                  name="fullName"
                  autoComplete="name"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full h-11 px-3 border border-slate-200 rounded-lg bg-slate-50 text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors"
                />
              </div>
            </div>

            <div className="space-y-4 pt-2">
              <h3 className="text-base font-semibold text-slate-800 flex items-center gap-2">
                <ShieldCheck className="text-slate-400" size={18} /> Đổi mật khẩu
              </h3>

              <div className="mb-4">
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Mật khẩu hiện tại</label>
                <input
                  type="password"
                  name="oldPassword"
                  autoComplete="new-password"
                  placeholder="Nhập mật khẩu hiện tại để xác thực"
                  value={oldPassword}
                  onChange={(e) => setOldPassword(e.target.value)}
                  className="w-full h-11 px-3 border border-slate-200 rounded-lg bg-slate-50 text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors"
                />
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Mật khẩu mới</label>
                  <input
                    type="password"
                    name="newPassword"
                    autoComplete="new-password"
                    placeholder="Nhập mật khẩu mới"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full h-11 px-3 border border-slate-200 rounded-lg bg-slate-50 text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Xác nhận mật khẩu</label>
                  <input
                    type="password"
                    name="confirmPassword"
                    autoComplete="new-password"
                    placeholder="Nhập lại mật khẩu"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full h-11 px-3 border border-slate-200 rounded-lg bg-slate-50 text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors"
                  />
                </div>
              </div>
            </div>

            <div className="pt-4 flex justify-end">
              <button
                type="submit"
                disabled={loading}
                className={`px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-medium text-sm rounded-lg shadow-sm transition-colors flex items-center justify-center min-w-[160px] ${
                  loading ? "opacity-70 cursor-not-allowed" : ""
                }`}
              >
                {loading ? (
                  <span className="flex items-center gap-2">
                    <Loader2 size={16} className="animate-spin" /> Đang cập nhật...
                  </span>
                ) : (
                  "Cập nhật thông tin"
                )}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Tab 2: Wallet & History */}
      {activeTab === "wallet" && (
        <div className="space-y-6">
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm flex items-center gap-5">
              <div className="w-14 h-14 rounded-full bg-blue-50 flex items-center justify-center flex-shrink-0">
                <Wallet className="text-blue-600" size={28} />
              </div>
              <div>
                <p className="text-sm font-medium text-slate-500 mb-1">Số dư ví hiện tại</p>
                <div className="text-3xl font-bold text-blue-600 tracking-tight">
                  {formatVnd(teacherInfo?.salaryBalance || 0).replace(/đ$/, "")}
                  <span className="text-lg text-blue-500">đ</span>
                </div>
              </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm flex items-center gap-5">
              <div className="w-14 h-14 rounded-full bg-rose-50 flex items-center justify-center flex-shrink-0">
                <CreditCard className="text-rose-500" size={28} />
              </div>
              <div>
                <p className="text-sm font-medium text-slate-500 mb-1">Phí thuê phòng trung bình / Ca</p>
                <div className="text-3xl font-bold text-rose-500 tracking-tight">
                  <span className="text-lg font-medium text-slate-400 italic">Trừ tự động khi chốt ca</span>
                </div>
              </div>
            </div>
          </div>

          {/* History Table */}
          <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
            <div className="px-6 py-5 border-b border-slate-100 flex items-center gap-2">
              <History className="text-slate-400" size={20} />
              <h3 className="text-base font-semibold text-slate-800">Lịch sử dạy học gần đây</h3>
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm whitespace-nowrap">
                <thead className="bg-slate-50 text-slate-500">
                  <tr>
                    <th className="px-6 py-3 font-medium">Ngày dạy</th>
                    <th className="px-6 py-3 font-medium">Ca học</th>
                    <th className="px-6 py-3 font-medium">Lớp</th>
                    <th className="px-6 py-3 font-medium text-right">Trạng thái</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {teachingHistory.map((row) => (
                    <tr key={row.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-6 py-4 font-medium text-slate-800">{formatDateVn(row.date)}</td>
                      <td className="px-6 py-4 text-slate-600">Ca {row.slot}</td>
                      <td className="px-6 py-4 text-slate-600">{row.className}</td>
                      <td className="px-6 py-4 text-right">
                        {row.status === "completed" ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-green-50 text-green-700 border border-green-200">
                            <CheckCircle2 size={14} /> Hoàn thành
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200">
                            <Clock size={14} /> Đã lên lịch
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {teachingHistory.length === 0 && (
              <div className="p-8 text-center text-sm text-slate-500">
                Chưa có dữ liệu lịch sử dạy học.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}