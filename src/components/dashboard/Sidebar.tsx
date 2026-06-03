"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { signOut } from "next-auth/react";
import { 
  Shield, 
  Users, 
  Calendar, 
  DollarSign, 
  LogOut, 
  BookOpen, 
  GraduationCap,
  Layers,
  Building2,
  ReceiptText,
  Wallet,
  Settings2,
  History
} from "lucide-react";

import { getPendingSessionsCount } from "@/actions/mutations";

type MenuItem = {
  title: string;
  href: string;
  icon: React.ElementType;
  roles: string[];
  section: string;
};

// Đã quy hoạch lại Menu chuẩn chỉ, không thừa không thiếu
const menuItems: MenuItem[] = [
  // --- MENU DÙNG CHUNG ---
  {
    title: "Lịch Giảng Dạy",
    href: "/schedule",
    icon: Calendar,
    roles: ["TEACHER", "SUPER_ADMIN"],
    section: "Dùng chung",
  },
  {
    title: "Lớp học của tôi",
    href: "/myClass",
    icon: BookOpen,
    roles: ["TEACHER"],
    section: "Cá nhân",
  },
  {
    title: "Lịch sử đặt phòng",
    href: "/ta/booking-history",
    icon: History,
    roles: ["TEACHER"],
    section: "Cá nhân",
  },
  {
    title: "Lịch sử nhận lương",
    href: "/ta/salary-history",
    icon: Wallet,
    roles: ["TEACHER"],
    section: "Cá nhân",
  },
  {
    title: "Cài đặt",
    href: "/ta/settings",
    icon: Settings2,
    roles: ["TEACHER"],
    section: "Cá nhân",
  },
  
  // --- MENU DÀNH RIÊNG CHO ADMIN ---
  {
    title: "Quản Lý Học Sinh",
    href: "/admin/students",
    icon: GraduationCap,
    roles: ["SUPER_ADMIN"],
    section: "Quản lý",
  },
  {
    title: "Quản Lý Giáo Viên",
    href: "/admin/teachers",
    icon: Shield,
    roles: ["SUPER_ADMIN"],
    section: "Quản lý",
  },
  {
    title: "Quản Lý Lớp Học",
    href: "/admin/classes", // Hoặc /admin/subjects tuỳ ông đặt
    icon: Layers,
    roles: ["SUPER_ADMIN"],
    section: "Quản lý",
  },
  {
    title: "Quản lý phòng học",
    href: "/admin/rooms",
    icon: Building2,
    roles: ["SUPER_ADMIN"],
    section: "Quản lý",
  },
  {
    title: "Thu Học Phí",
    href: "/admin/tuition",
    icon: DollarSign,
    roles: ["SUPER_ADMIN"],
    section: "Tài chính",
  },
  {
    title: "Lịch sử Học Phí",
    href: "/admin/history/tuition",
    icon: ReceiptText,
    roles: ["SUPER_ADMIN"],
    section: "Tài chính",
  },
  {
    title: "Lịch sử Lương",
    href: "/admin/history/salary",
    icon: Wallet,
    roles: ["SUPER_ADMIN"],
    section: "Tài chính",
  },
  {
    title: "Duyệt Đặt Phòng",
    href: "/admin/schedule",
    icon: Calendar,
    roles: ["SUPER_ADMIN"],
    section: "Quản lý",
  },
];

interface SidebarProps {
  userRole: string;
  userName: string;
  isOpen: boolean;
  onClose: () => void;
}

export default function Sidebar({ userRole, userName, isOpen, onClose }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => {
    if (userRole === "SUPER_ADMIN") {
      getPendingSessionsCount().then(setPendingCount);
    }
  }, [userRole]);

  // Lọc menu theo role của user hiện tại
  const filteredNav = menuItems.filter((item) => item.roles.includes(userRole));

  return (
    <>
      {/* Mobile backdrop */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-slate-900/50 z-40 lg:hidden transition-opacity"
          onClick={onClose}
        />
      )}

      {/* Sidebar Content */}
      <aside className={`
        fixed inset-y-0 left-0 z-50 w-64 bg-white border-r border-slate-200 shadow-xl lg:shadow-none 
        transform transition-transform duration-300 ease-in-out lg:static lg:translate-x-0 flex flex-col
        ${isOpen ? "translate-x-0" : "-translate-x-full"}
      `}>
        {/* Branding */}
        <div className="h-16 flex items-center px-6 border-b border-slate-100">
          <div className="flex items-center gap-2 text-blue-600">
            <div className="bg-blue-600 p-1.5 rounded-lg">
              <BookOpen size={20} className="text-white" />
            </div>
            <h2 className="text-sm font-bold text-slate-900 tracking-tight">Trung Tâm Giáo Dục</h2>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {filteredNav.map((item, index) => {
            const previous = filteredNav[index - 1];
            const showSection = !previous || previous.section !== item.section;
            const isActive = 
              pathname === item.href || 
              (item.href !== "/" && pathname.startsWith(item.href));

            const Icon = item.icon;

            return (
              <div key={item.href} className={index === 0 ? "" : "mt-2"}>
                {showSection && (
                  <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 px-3">
                    {item.section}
                  </div>
                )}
                <Link 
                  href={item.href}
                  onClick={onClose}
                  className={`
                    flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200
                    ${isActive 
                      ? "bg-blue-50 text-blue-700" 
                      : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                    }
                  `}
                >
                  <div className="flex items-center justify-between w-full">
                    <div className="flex items-center gap-3">
                      <Icon size={18} className={isActive ? "text-blue-600" : "text-slate-400"} />
                      {item.title}
                    </div>
                    {item.href === "/admin/schedule" && pendingCount > 0 && (
                      <span className="bg-rose-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full animate-pulse shadow-sm">
                        {pendingCount}
                      </span>
                    )}
                  </div>
                </Link>
              </div>
            );
          })}
        </nav>

        {/* User Card & Logout */}
        <div className="p-4 border-t border-slate-100">
          <div className="flex items-center gap-3 px-3 py-3 bg-slate-50 rounded-lg mb-3 border border-slate-200/60">
            <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold text-sm">
              {userName ? userName.charAt(0).toUpperCase() : "U"}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-slate-900 truncate">{userName || "User"}</p>
              <p className="text-xs text-slate-500 truncate">{userRole === "SUPER_ADMIN" ? "Quản trị viên" : "Giáo viên"}</p>
            </div>
          </div>
          
          <button
            onClick={async () => {
              // Dùng callbackUrl là chuẩn bài của NextAuth, tự động làm sạch cache và chuyển hướng
              await signOut({ callbackUrl: "/login" });
            }}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-rose-600 hover:bg-rose-50 transition-colors"
          >
            <LogOut size={18} />
            Đăng xuất
          </button>
        </div>
      </aside>
    </>
  );
}