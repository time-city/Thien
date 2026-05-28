"use client";

import { Menu, Settings } from "lucide-react";
import Link from "next/link";

interface TopHeaderProps {
  onMenuClick: () => void;
  userName: string;
}

export default function TopHeader({ onMenuClick, userName }: TopHeaderProps) {
  return (
    <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-4 lg:px-8 sticky top-0 z-30">
      <div className="flex items-center gap-4">
        <button 
          onClick={onMenuClick}
          className="p-2 rounded-md text-slate-500 hover:bg-slate-100 lg:hidden transition-colors"
        >
          <Menu size={20} />
        </button>
        {/* Placeholder for Breadcrumbs or Search */}
        <h2 className="hidden lg:block text-slate-800 font-semibold">Workspace</h2>
      </div>

      <div className="flex items-center gap-4">
        <Link 
          href="/ta/settings"
          className="p-2 rounded-full text-slate-400 hover:bg-slate-50 hover:text-slate-600 transition-colors"
          title="Cài đặt"
        >
          <Settings size={20} />
        </Link>
        
        <div className="hidden sm:flex items-center gap-3 pl-4 border-l border-slate-200">
          <div className="text-right">
            <p className="text-sm font-medium text-slate-700 leading-none">{userName}</p>
          </div>
          <div className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center font-semibold text-sm shadow-sm">
            {userName.charAt(0).toUpperCase()}
          </div>
        </div>
      </div>
    </header>
  );
}
