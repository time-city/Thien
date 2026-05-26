import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Nông Trại KHTN",
  description: "Web app quản lý lớp học tối giản, mobile-first.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="vi" className="dark">
      <body>{children}</body>
    </html>
  );
}