"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { 
  Shield, 
  Users, 
  Calendar, 
  DollarSign, 
  LogOut, 
  BookOpen, 
  GraduationCap,
  Layers
} from "lucide-react";
import { signOut } from "next-auth/react";

type MenuItem = {
  title: string;
  href: string;
  icon: React.ElementType;
  roles: string[];
};

// Đã quy hoạch lại Menu chuẩn chỉ, không thừa không thiếu
const menuItems: MenuItem[] = [
  // --- MENU DÙNG CHUNG ---
  {
    title: "Lịch Giảng Dạy",
    href: "/schedule",
    icon: Calendar,
    roles: ["TEACHER", "SUPER_ADMIN"],
  },
  // {
  //   title: "Sơ Đồ Lớp Học",
  //   href: "/ta",
  //   icon: Users,
  //   roles: ["TEACHER", "SUPER_ADMIN"], // Đã fix lỗi chuỗi dính liền
  // },
  
  // --- MENU DÀNH RIÊNG CHO ADMIN ---
  {
    title: "Quản Lý Học Sinh",
    href: "/admin/students",
    icon: GraduationCap,
    roles: ["SUPER_ADMIN"],
  },
  {
    title: "Quản Lý Giáo Viên",
    href: "/admin/teachers",
    icon: Shield,
    roles: ["SUPER_ADMIN"],
  },
  {
    title: "Lớp Học",
    href: "/admin/classes", // Hoặc /admin/subjects tuỳ ông đặt
    icon: Layers,
    roles: ["SUPER_ADMIN"],
  },
  {
    title: "Tài Chính & Học Phí",
    href: "/admin/tuition",
    icon: DollarSign,
    roles: ["SUPER_ADMIN"],
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
          <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3 px-3">
            Menu chính
          </div>
          {filteredNav.map((item) => {
            // Logic Active mượt hơn: bao gồm cả trường hợp đường dẫn con (VD: /admin/students/1)
            const isActive = 
              pathname === item.href || 
              (item.href !== "/" && pathname.startsWith(item.href));
            
            const Icon = item.icon;
            
            return (
              <Link 
                key={item.href} 
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
                <Icon size={18} className={isActive ? "text-blue-600" : "text-slate-400"} />
                {item.title}
              </Link>
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