"use client";

import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { useSession } from 'next-auth/react';
import Sidebar from '@/components/dashboard/Sidebar';
import TopHeader from '@/components/dashboard/TopHeader';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { data: session } = useSession();

  // Ẩn thanh Sidebar / Header khi ở trang đăng nhập
  if (pathname === '/login') {
    return <>{children}</>;
  }

  const role = session?.user?.role || "TEACHER";
  const fullName = session?.user?.fullName || "Người dùng";

  return (
    <div className="h-screen overflow-hidden bg-slate-50 flex font-sans">
      <Sidebar 
        userRole={role} 
        userName={fullName} 
        isOpen={sidebarOpen} 
        onClose={() => setSidebarOpen(false)} 
      />
      
      <div className="flex-1 flex flex-col min-w-0">
        <TopHeader 
          userName={fullName}
          onMenuClick={() => setSidebarOpen(true)} 
        />
        
        <main className="flex-1 p-4 lg:p-6 overflow-y-auto w-full">
          <div className="max-w-7xl mx-auto">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
