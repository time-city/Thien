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
  TrendingUp,
  MessageCircle,
  Settings2,
} from "lucide-react";

import { useSession } from "next-auth/react";
import { updateTeacherProfile } from "@/actions/mutations";
import { setSystemSetting } from "@/actions/settings";
import type { TeachingHistory, TeacherInfo } from "@/actions/queries";

function formatVnd(amount: number) {
  return new Intl.NumberFormat("vi-VN").format(Math.round(amount)) + "đ";
}

type TabType = "profile" | "wallet" | "zalo";

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
  isAdmin = false,
  initialCronEnabled = true,
}: {
  teacherInfo: TeacherInfo;
  teachingHistory: TeachingHistory[];
  isAdmin?: boolean;
  initialCronEnabled?: boolean;
}) {
  const { update } = useSession();
  const [activeTab, setActiveTab] = useState<TabType>("profile");

  const [fullName, setFullName] = useState<string>(teacherInfo?.fullName || "");
  const [oldPassword, setOldPassword] = useState<string>("");
  const [newPassword, setNewPassword] = useState<string>("");
  const [confirmPassword, setConfirmPassword] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);

  const [isCronEnabled, setIsCronEnabled] = useState(initialCronEnabled);
  const [isTogglingCron, setIsTogglingCron] = useState(false);

  const handleToggleCron = async () => {
    setIsTogglingCron(true);
    const newValue = !isCronEnabled;
    setIsCronEnabled(newValue);
    const res = await setSystemSetting("CRON_TUITION_ENABLED", newValue ? "true" : "false");
    if (res.success) {
      toast.success(`Đã ${newValue ? "BẬT" : "TẮT"} tự động nhắc học phí (Cronjob)`);
    } else {
      toast.error(res.message || "Lỗi khi lưu cài đặt");
      setIsCronEnabled(!newValue); // revert
    }
    setIsTogglingCron(false);
  };

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
    <div className="w-full max-w-4xl mx-auto pb-10 font-sans">
      <div className="mb-4 md:mb-6 flex flex-col md:flex-row md:items-center justify-between gap-3 md:gap-4">
        <div>
          <h1 className="text-xl md:text-2xl font-extrabold text-slate-900 tracking-tight">Tài khoản</h1>
          <p className="text-xs md:text-sm text-slate-500 font-medium mt-1">Quản lý hồ sơ và theo dõi thu nhập của bạn.</p>
        </div>
        
        {/* Sleek Segmented Control cho Tabs */}
        <div className="flex p-1 bg-slate-100/80 backdrop-blur-sm rounded-xl border border-slate-200/60 w-full md:w-auto self-start">
          <button
            onClick={() => setActiveTab("profile")}
            className={`flex-1 md:w-32 flex justify-center items-center gap-1.5 md:gap-2 py-1.5 md:py-2 text-xs md:text-sm font-semibold rounded-lg transition-all ${
              activeTab === "profile"
                ? "bg-white text-slate-900 shadow-sm ring-1 ring-slate-200/50"
                : "text-slate-500 hover:text-slate-700"
            }`}
          >
            <User size={14} className="md:w-4 md:h-4" strokeWidth={2.5} />
            <span>Hồ sơ</span>
          </button>
          <button
            onClick={() => setActiveTab("wallet")}
            className={`flex-1 md:w-32 flex justify-center items-center gap-1.5 md:gap-2 py-1.5 md:py-2 text-xs md:text-sm font-semibold rounded-lg transition-all ${
              activeTab === "wallet"
                ? "bg-white text-slate-900 shadow-sm ring-1 ring-slate-200/50"
                : "text-slate-500 hover:text-slate-700"
            }`}
          >
            <Wallet size={14} className="md:w-4 md:h-4" strokeWidth={2.5} />
            <span>Thu nhập</span>
          </button>
          {isAdmin && (
            <button
              onClick={() => setActiveTab("zalo")}
              className={`flex-1 md:w-32 flex justify-center items-center gap-1.5 md:gap-2 py-1.5 md:py-2 text-xs md:text-sm font-semibold rounded-lg transition-all ${
                activeTab === "zalo"
                  ? "bg-white text-slate-900 shadow-sm ring-1 ring-slate-200/50"
                  : "text-slate-500 hover:text-slate-700"
              }`}
            >
              <MessageCircle size={14} className="md:w-4 md:h-4" strokeWidth={2.5} />
              <span>Zalo Bot</span>
            </button>
          )}
        </div>
      </div>

      {/* Tab 1: Profile */}
      {activeTab === "profile" && (
        <div className="bg-white border border-slate-200 rounded-2xl p-5 md:p-7 shadow-sm">
          <form className="space-y-6" onSubmit={handleUpdateProfile} autoComplete="off">
            <div className="space-y-4 border-b border-slate-100 pb-6">
              <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                <User className="text-slate-400" size={16} /> Thông tin cơ bản
              </h3>
              
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase tracking-wide">Họ và tên</label>
                <input
                  type="text"
                  name="fullName"
                  autoComplete="name"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full h-10 px-3 border border-slate-200 rounded-lg bg-slate-50/50 text-slate-900 text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400 transition-colors"
                />
              </div>
            </div>

            <div className="space-y-4 pt-2">
              <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                <ShieldCheck className="text-slate-400" size={16} /> Bảo mật
              </h3>

              <div className="mb-4">
                <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase tracking-wide">Mật khẩu hiện tại</label>
                <input
                  type="password"
                  name="oldPassword"
                  autoComplete="new-password"
                  placeholder="Nhập để xác thực việc đổi mật khẩu"
                  value={oldPassword}
                  onChange={(e) => setOldPassword(e.target.value)}
                  className="w-full h-10 px-3 border border-slate-200 rounded-lg bg-slate-50/50 text-slate-900 text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400 transition-colors"
                />
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase tracking-wide">Mật khẩu mới</label>
                  <input
                    type="password"
                    name="newPassword"
                    autoComplete="new-password"
                    placeholder="Bỏ trống nếu không đổi"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full h-10 px-3 border border-slate-200 rounded-lg bg-slate-50/50 text-slate-900 text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400 transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase tracking-wide">Xác nhận mật khẩu mới</label>
                  <input
                    type="password"
                    name="confirmPassword"
                    autoComplete="new-password"
                    placeholder="Bỏ trống nếu không đổi"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full h-10 px-3 border border-slate-200 rounded-lg bg-slate-50/50 text-slate-900 text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400 transition-colors"
                  />
                </div>
              </div>
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={loading}
                className={`w-full md:w-auto px-8 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-bold text-sm rounded-lg shadow-md transition-all flex items-center justify-center min-w-[160px] ${
                  loading ? "opacity-70 cursor-not-allowed" : ""
                }`}
              >
                {loading ? (
                  <span className="flex items-center gap-2">
                    <Loader2 size={16} className="animate-spin" /> Đang lưu...
                  </span>
                ) : (
                  "Lưu thay đổi"
                )}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Tab 2: Wallet & History */}
      {activeTab === "wallet" && (
        <div className="space-y-6">
          {/* Summary Cards - Đã thu nhỏ font và padding */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 md:gap-3">
            {/* Card 1: Wallet balance - Dark/Premium aesthetic */}
            <div className="bg-slate-900 rounded-xl p-3 md:p-4 shadow-md flex flex-col justify-between relative overflow-hidden col-span-2 sm:col-span-3 lg:col-span-1">
              <div className="absolute -right-4 -top-4 w-24 h-24 bg-white/5 rounded-full blur-2xl"></div>
              <div className="flex items-center gap-1.5 md:gap-2 mb-2 md:mb-3 relative z-10">
                <Wallet className="text-slate-400" size={14} />
                <p className="text-[10px] md:text-[11px] font-bold text-slate-400 uppercase tracking-wider">Số dư khả dụng</p>
              </div>
              <div className="text-xl md:text-2xl font-extrabold text-white tracking-tight relative z-10">
                {formatVnd(teacherInfo?.salaryBalance || 0)}
              </div>
            </div>

            {/* Card 2: Total earned */}
            <div className="bg-white border border-slate-200 rounded-xl p-3 md:p-4 shadow-sm flex flex-col justify-between lg:col-span-1">
              <div className="flex items-center gap-2 mb-3">
                <TrendingUp className="text-emerald-500" size={16} />
                <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Thu nhập</p>
              </div>
              <div className="text-xl font-extrabold text-slate-800 tracking-tight">
                {formatVnd(teacherInfo?.totalEarned || 0)}
              </div>
            </div>

            {/* Card 3: Total room fee deducted */}
            <div className="bg-white border border-slate-200 rounded-xl p-3 md:p-4 shadow-sm flex flex-col justify-between lg:col-span-1">
              <div className="flex items-center gap-1.5 md:gap-2 mb-2 md:mb-3">
                <CreditCard className="text-rose-500" size={14} />
                <p className="text-[10px] md:text-[11px] font-bold text-slate-500 uppercase tracking-wider">Phí phòng</p>
              </div>
              <div className="text-base md:text-xl font-extrabold text-slate-800 tracking-tight">
                {formatVnd(teacherInfo?.totalRoomFee || 0)}
              </div>
            </div>
          </div>

          {/* History Table */}
          <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center gap-2">
                <History className="text-slate-400" size={18} />
                <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wide">Lịch sử dạy</h3>
              </div>
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full text-left whitespace-nowrap">
                <thead className="bg-white border-b border-slate-100 text-[11px] uppercase tracking-wider font-extrabold text-slate-400">
                  <tr>
                    <th className="px-5 py-3">Ngày dạy</th>
                    <th className="px-5 py-3">Ca học</th>
                    <th className="px-5 py-3">Lớp học</th>
                    <th className="px-5 py-3 text-right">Trạng thái</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {teachingHistory.map((row) => (
                    <tr key={row.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="px-5 py-3 text-sm font-bold text-slate-700">{formatDateVn(row.date)}</td>
                    <td className="px-5 py-3 text-sm font-medium text-slate-500">{row.startTime ? `${formatDateVn(row.startTime)} ` : ""}{row.endTime ? "" : ""}</td>
                      <td className="px-5 py-3 text-sm font-medium text-slate-600">{row.className}</td>
                      <td className="px-5 py-3 text-right">
                        {row.status === "completed" ? (
                          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-bold bg-emerald-50 text-emerald-600 border border-emerald-100">
                            <CheckCircle2 size={12} strokeWidth={3} /> Chốt
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-bold bg-amber-50 text-amber-600 border border-amber-100">
                            <Clock size={12} strokeWidth={3} /> Chờ
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {teachingHistory.length === 0 && (
              <div className="p-8 text-center text-sm font-medium text-slate-400">
                Chưa có dữ liệu lịch sử dạy học.
              </div>
            )}
          </div>
        </div>
      )}
      {/* Tab 3: Zalo Bot Connection */}
      {isAdmin && activeTab === "zalo" && (
        <div className="space-y-6">
          <ZaloConnectionWidget />
          {/* System Settings for Admin */}
          <div className="bg-white border border-slate-200 rounded-2xl p-5 md:p-7 shadow-sm">
            <h2 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
              <Settings2 className="text-blue-500" size={20} />
              Cài đặt Hệ thống (Dành cho Quản trị)
            </h2>
            <div className="flex items-center justify-between bg-slate-50 p-4 rounded-xl border border-slate-200/60">
              <div className="flex flex-col">
                <span className="text-sm font-bold text-slate-800">Tự động nhắc học phí (Cronjob)</span>
                <span className="text-xs text-slate-500">Hệ thống sẽ tự động quét và gửi Zalo nhắc nợ vào 9h sáng mỗi ngày</span>
              </div>
              <button
                onClick={handleToggleCron}
                disabled={isTogglingCron}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 ${isCronEnabled ? 'bg-blue-600' : 'bg-slate-300'}`}
              >
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${isCronEnabled ? 'translate-x-6' : 'translate-x-1'}`} />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ZaloConnectionWidget() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [qrUrl, setQrUrl] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string>('Đang kiểm tra trạng thái...');
  
  // Let me just use standard let for poll.
  useEffect(() => {
    let pollInterval: NodeJS.Timeout | null = null;
    const checkStatus = async () => {
      try {
        const response = await fetch('/api/zalobot/status', {
          headers: { "x-api-key": process.env.NEXT_PUBLIC_ZALO_BOT_API_KEY || "" }
        });
        const data = await response.json().catch(() => null);
        const isConnected = data?.loggedIn || data?.isLoggedIn || data?.status === 'ready' || data?.status === 'logged_in';
        if (isConnected) {
          setIsLoggedIn(true);
          setStatusMessage('✅ Bot đang trực chiến!');
          if (!isLoggedIn) {
            setQrUrl(null);
          }
        } else {
          setIsLoggedIn(false);
          setStatusMessage(data?.message || 'Chưa kết nối. Vui lòng đăng nhập.');
        }
      } catch (error) {
        setIsLoggedIn(false);
        setStatusMessage('❌ Không thể kết nối tới server Zalo Bot');
      }
    };

    checkStatus();

    if (qrUrl && !isLoggedIn) {
      pollInterval = setInterval(checkStatus, 3000);
    }

    return () => {
      if (pollInterval) clearInterval(pollInterval);
    };
  }, [qrUrl, isLoggedIn]);

  const handleGetQR = async () => {
    if (isLoggedIn) {
      setStatusMessage('Đang đăng xuất tài khoản cũ...');
      await fetch('/api/zalobot/logout', { 
        method: 'POST',
        headers: { "x-api-key": process.env.NEXT_PUBLIC_ZALO_BOT_API_KEY || "" }
      }).catch(() => {});
      setIsLoggedIn(false);
    }
    setQrUrl(`/api/zalobot/login?t=${Date.now()}&api_key=${process.env.NEXT_PUBLIC_ZALO_BOT_API_KEY || ""}`);
    setStatusMessage('Vui lòng quét mã QR trên bằng ứng dụng Zalo (hoặc Zalo Zavi) để đăng nhập.');
  };

  return (
    <div className="space-y-6">
      {/* Bot Zalo Connection */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 md:p-7 shadow-sm">
        <div className="flex flex-col items-center justify-center space-y-6 py-4 animate-in fade-in zoom-in-95 duration-500">
        <div className={`p-4 rounded-full shadow-inner ${isLoggedIn ? 'bg-emerald-100 text-emerald-600' : 'bg-rose-100 text-rose-600'}`}>
          {isLoggedIn ? (
             <CheckCircle2 size={32} />
          ) : (
             <MessageCircle size={32} />
          )}
        </div>
        
        <div className="text-center space-y-2">
          <h3 className="text-xl font-extrabold text-slate-800 tracking-tight">{isLoggedIn ? 'Zalo Bot Đã Sẵn Sàng' : 'Kết Nối Zalo Bot'}</h3>
          <p className={`text-sm font-bold ${isLoggedIn ? 'text-emerald-600' : 'text-rose-500'}`}>{statusMessage}</p>
        </div>

        <div className="flex flex-col items-center gap-5 w-full max-w-sm mt-2">
          <button 
            type="button"
            onClick={handleGetQR}
            className={`w-full py-2.5 px-4 rounded-lg font-bold text-sm shadow-md transition-all flex items-center justify-center gap-2 ${isLoggedIn ? 'bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-300' : 'bg-slate-900 hover:bg-slate-800 text-white'}`}
          >
            <MessageCircle size={16} />
            {isLoggedIn ? 'Đổi tài khoản khác' : 'Lấy mã QR Đăng Nhập'}
          </button>
          </div>
          {qrUrl && !isLoggedIn && (
            <div className="relative p-2 bg-white rounded-xl shadow-sm border border-slate-100 mt-4">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={qrUrl} alt="Zalo QR" className="w-64 h-64 object-contain" />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}