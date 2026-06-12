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
} from "lucide-react";

import { useSession } from "next-auth/react";
import { updateTeacherProfile } from "@/actions/mutations";
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
}: {
  teacherInfo: TeacherInfo;
  teachingHistory: TeachingHistory[];
  isAdmin?: boolean;
}) {
  const { update } = useSession();
  const [activeTab, setActiveTab] = useState<TabType>("profile");

  const [fullName, setFullName] = useState<string>(teacherInfo?.fullName || "");
  const [oldPassword, setOldPassword] = useState<string>("");
  const [newPassword, setNewPassword] = useState<string>("");
  const [confirmPassword, setConfirmPassword] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);

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
      <div className="mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Tài khoản</h1>
          <p className="text-sm text-slate-500 font-medium mt-1">Quản lý hồ sơ và theo dõi thu nhập của bạn.</p>
        </div>
        
        {/* Sleek Segmented Control cho Tabs */}
        <div className="flex p-1 bg-slate-100/80 backdrop-blur-sm rounded-xl border border-slate-200/60 w-full md:w-auto self-start">
          <button
            onClick={() => setActiveTab("profile")}
            className={`flex-1 md:w-32 flex justify-center items-center gap-2 py-2 text-sm font-semibold rounded-lg transition-all ${
              activeTab === "profile"
                ? "bg-white text-slate-900 shadow-sm ring-1 ring-slate-200/50"
                : "text-slate-500 hover:text-slate-700"
            }`}
          >
            <User size={16} strokeWidth={2.5} />
            <span>Hồ sơ</span>
          </button>
          <button
            onClick={() => setActiveTab("wallet")}
            className={`flex-1 md:w-32 flex justify-center items-center gap-2 py-2 text-sm font-semibold rounded-lg transition-all ${
              activeTab === "wallet"
                ? "bg-white text-slate-900 shadow-sm ring-1 ring-slate-200/50"
                : "text-slate-500 hover:text-slate-700"
            }`}
          >
            <Wallet size={16} strokeWidth={2.5} />
            <span>Thu nhập</span>
          </button>
          {isAdmin && (
            <button
              onClick={() => setActiveTab("zalo")}
              className={`flex-1 md:w-32 flex justify-center items-center gap-2 py-2 text-sm font-semibold rounded-lg transition-all ${
                activeTab === "zalo"
                  ? "bg-white text-slate-900 shadow-sm ring-1 ring-slate-200/50"
                  : "text-slate-500 hover:text-slate-700"
              }`}
            >
              <MessageCircle size={16} strokeWidth={2.5} />
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
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* Card 1: Wallet balance - Dark/Premium aesthetic */}
            <div className="bg-slate-900 rounded-xl p-4 shadow-md flex flex-col justify-between relative overflow-hidden sm:col-span-3 lg:col-span-1">
              <div className="absolute -right-4 -top-4 w-24 h-24 bg-white/5 rounded-full blur-2xl"></div>
              <div className="flex items-center gap-2 mb-3 relative z-10">
                <Wallet className="text-slate-400" size={16} />
                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Số dư khả dụng</p>
              </div>
              <div className="text-2xl font-extrabold text-white tracking-tight relative z-10">
                {formatVnd(teacherInfo?.salaryBalance || 0)}
              </div>
            </div>

            {/* Card 2: Total earned */}
            <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm flex flex-col justify-between lg:col-span-1">
              <div className="flex items-center gap-2 mb-3">
                <TrendingUp className="text-emerald-500" size={16} />
                <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Lương đã nhận</p>
              </div>
              <div className="text-xl font-extrabold text-slate-800 tracking-tight">
                {formatVnd(teacherInfo?.totalEarned || 0)}
              </div>
            </div>

            {/* Card 3: Total room fee deducted */}
            <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm flex flex-col justify-between lg:col-span-1">
              <div className="flex items-center gap-2 mb-3">
                <CreditCard className="text-rose-500" size={16} />
                <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Phí phòng đã trừ</p>
              </div>
              <div className="text-xl font-extrabold text-slate-800 tracking-tight">
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
                      <td className="px-5 py-3 text-sm font-medium text-slate-500">Ca {row.slot}</td>
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
        <ZaloConnectionWidget />
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
        const response = await fetch('http://localhost:8080/status');
        const data = await response.json().catch(() => null);
        const isConnected = data?.isLoggedIn || data?.status === 'ready' || data?.status === 'logged_in';
        if (isConnected) {
          setIsLoggedIn(true);
          setStatusMessage('✅ Đã kết nối thành công với Zalo Bot!');
          setQrUrl(null);
        } else {
          setIsLoggedIn(false);
          setStatusMessage(data?.message || 'Chưa kết nối. Vui lòng lấy mã QR để đăng nhập.');
        }
      } catch (error) {
        setIsLoggedIn(false);
        setStatusMessage('❌ Không thể kết nối tới server Zalo Bot (http://localhost:8080)');
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

  const handleGetQR = () => {
    setQrUrl(`http://localhost:8080/login?t=${Date.now()}`);
    setStatusMessage('Vui lòng quét mã QR trên bằng ứng dụng Zalo (hoặc Zalo Zavi) để đăng nhập.');
  };

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-5 md:p-7 shadow-sm">
      <div className="flex flex-col items-center justify-center space-y-6 py-4 animate-in fade-in zoom-in-95 duration-500">
        <div className={`p-4 rounded-full shadow-inner ${isLoggedIn ? 'bg-emerald-100 text-emerald-600' : 'bg-blue-100 text-blue-600'}`}>
          {isLoggedIn ? (
             <CheckCircle2 size={32} />
          ) : (
             <MessageCircle size={32} />
          )}
        </div>
        
        <div className="text-center space-y-2">
          <h3 className="text-xl font-extrabold text-slate-800 tracking-tight">{isLoggedIn ? 'Zalo Bot Đã Sẵn Sàng' : 'Kết Nối Zalo Bot'}</h3>
          <p className="text-slate-500 text-sm">{statusMessage}</p>
        </div>

        {!isLoggedIn && (
          <div className="flex flex-col items-center gap-5 w-full max-w-sm mt-2">
            <button 
              type="button"
              onClick={handleGetQR}
              className="w-full py-2.5 px-4 bg-slate-900 hover:bg-slate-800 text-white rounded-lg font-bold text-sm shadow-md transition-all flex items-center justify-center gap-2"
            >
              <MessageCircle size={16} />
              Lấy mã QR Đăng Nhập
            </button>
            
            {qrUrl && (
              <div className="p-4 bg-white border-2 border-dashed border-slate-200 rounded-xl flex flex-col items-center gap-3 w-full shadow-sm">
                <p className="text-xs font-bold text-slate-500 uppercase tracking-widest text-center">Quét mã bằng Zalo</p>
                <div className="p-2 bg-white border border-slate-100 shadow-sm rounded-lg">
                  <img src={qrUrl} alt="Zalo Login QR" className="w-40 h-40 object-contain" />
                </div>
                <div className="flex items-center gap-2 text-[11px] font-medium text-blue-600 mt-1">
                  <span className="relative flex h-2.5 w-2.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-blue-500"></span>
                  </span>
                  Đang chờ quét / xác nhận trên Zalo...
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}