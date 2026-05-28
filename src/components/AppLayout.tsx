"use client";
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/lib/AuthContext';
import { Menu, Home, Calendar, Users, DollarSign, X, Shield } from 'lucide-react';
import { useState } from 'react';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { role, setRole, currentUser } = useAuth();
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col md:flex-row text-slate-800 font-sans">
      {/* Mobile Topbar */}
      <div className="md:hidden flex items-center justify-between p-4 bg-white border-b border-slate-200 shadow-sm sticky top-0 z-40">
        <h2 className="text-lg font-bold text-slate-900 leading-none">Nông Trại KHTN</h2>
        <button className="text-slate-600" onClick={() => setSidebarOpen(true)}>
          <Menu size={24} />
        </button>
      </div>

      {/* Sidebar */}
      <aside className={`
        fixed inset-y-0 left-0 z-50 w-64 bg-white border-r border-slate-200 shadow-xl md:shadow-none 
        transform transition-transform duration-300 ease-in-out md:static md:translate-x-0 flex flex-col
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        <div className="p-4 border-b border-slate-200 flex justify-between items-center">
          <div>
            <h2 className="text-xl font-bold text-slate-900 hidden md:block">Nông Trại KHTN</h2>
            <div className="mt-2 text-xs font-semibold tracking-wider text-slate-500">
              User: <span className="font-bold text-slate-800">{currentUser?.name}</span> <br/>
              Role: <span className="text-blue-600 font-bold">{role}</span>
            </div>
            <button 
              onClick={() => setRole(role === 'SUPER_ADMIN' ? 'TEACHER' : 'SUPER_ADMIN')}
              className="mt-2 w-full py-1.5 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-semibold rounded-md transition-colors"
            >
              Đổi vai trò
            </button>
          </div>
          <button className="md:hidden text-slate-500" onClick={() => setSidebarOpen(false)}>
            <X size={24} />
          </button>
        </div>
        
        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          {role === 'SUPER_ADMIN' && (
            <>
              <Link onClick={() => setSidebarOpen(false)} href="/admin" className={`flex items-center gap-3 px-3 py-2 rounded-md font-medium text-sm ${pathname === '/admin' ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:bg-slate-100'}`}>
                <Home size={18} /> Dashboard
              </Link>
              <Link onClick={() => setSidebarOpen(false)} href="/admin/users" className={`flex items-center gap-3 px-3 py-2 rounded-md font-medium text-sm ${pathname === '/admin/users' ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:bg-slate-100'}`}>
                <Shield size={18} /> Quản Lý Tài Khoản
              </Link>
            </>
          )}
          
          <Link onClick={() => setSidebarOpen(false)} href="/ta" className={`flex items-center gap-3 px-3 py-2 rounded-md font-medium text-sm ${pathname === '/ta' ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:bg-slate-100'}`}>
            <Users size={18} /> Lớp Học
          </Link>

          {role === 'SUPER_ADMIN' && (
            <>
              <Link onClick={() => setSidebarOpen(false)} href="/schedule" className={`flex items-center gap-3 px-3 py-2 rounded-md font-medium text-sm ${pathname.startsWith('/schedule') ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:bg-slate-100'}`}>
                <Calendar size={18} /> Lịch Phòng Học
              </Link>
              <Link onClick={() => setSidebarOpen(false)} href="/tuition" className={`flex items-center gap-3 px-3 py-2 rounded-md font-medium text-sm ${pathname.startsWith('/tuition') ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:bg-slate-100'}`}>
                <DollarSign size={18} /> Thu Học Phí
              </Link>
            </>
          )}
        </nav>
      </aside>

      {/* Backdrop for mobile */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-slate-900/50 z-40 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Main Content */}
      <main className="flex-1 relative overflow-y-auto">
        {children}
      </main>
    </div>
  );
}
