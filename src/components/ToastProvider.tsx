"use client";

import { Toaster } from "sonner";
import { CheckCircle2, AlertTriangle, AlertOctagon, Info } from "lucide-react";

export default function ToastProvider() {
  return (
    <Toaster
      position="top-right"
      toastOptions={{
        classNames: {
          toast: "group flex items-start gap-3 p-4 rounded-xl border shadow-lg font-sans w-full max-w-[350px]",
          title: "text-[13px] font-bold leading-tight",
          description: "text-[12px] font-medium leading-relaxed mt-0.5",
          // Minimalist themes tailored for the ERP
          success: "bg-white border-emerald-200 text-emerald-900 shadow-emerald-900/5",
          error: "bg-white border-rose-200 text-rose-900 shadow-rose-900/5",
          warning: "bg-white border-amber-200 text-amber-900 shadow-amber-900/5",
          info: "bg-white border-blue-200 text-blue-900 shadow-blue-900/5",
          icon: "mt-0.5", // Aligns icon with multi-line text
        },
      }}
      icons={{
        success: <CheckCircle2 size={18} className="text-emerald-500" strokeWidth={2.5} />,
        error: <AlertOctagon size={18} className="text-rose-500" strokeWidth={2.5} />,
        warning: <AlertTriangle size={18} className="text-amber-500" strokeWidth={2.5} />,
        info: <Info size={18} className="text-blue-500" strokeWidth={2.5} />,
      }}
    />
  );
}
