import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from "@/lib/AuthContext";
import AppLayout from "@/components/AppLayout";
import { SessionProvider } from "next-auth/react";

export const metadata: Metadata = {
  title: "Nông Trại KHTN",
  description: "Web app quản lý lớp học tối giản, mobile-first.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="vi">
      <body className="bg-slate-50 text-slate-800">
        <SessionProvider>
          <AuthProvider>
            <AppLayout>
              {children}
            </AppLayout>
          </AuthProvider>
        </SessionProvider>
      </body>
    </html>
  );
}