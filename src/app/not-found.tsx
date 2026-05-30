import Link from "next/link";
import { Home, Compass } from "lucide-react";

export default function NotFound() {
  return (
    // Dùng fixed, inset-0 và z-[9999] để nó đè lên toàn bộ giao diện (sidebar, topbar)
    <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-slate-50 px-4 font-sans selection:bg-blue-100">
      <div className="max-w-md w-full text-center flex flex-col items-center">
        
        {/* Khối Visual (Watermark 404 & Icon) */}
        <div className="relative flex justify-center items-center mb-4">
          {/* Chữ 404 to mờ làm nền */}
          <h1 className="text-[140px] font-black text-slate-200/60 tracking-tighter select-none leading-none">
            404
          </h1>
          {/* Icon la bàn nổi lên trên */}
          <div className="absolute flex items-center justify-center w-20 h-20 bg-white rounded-full shadow-[0_8px_30px_rgb(0,0,0,0.08)]">
            <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center">
              <Compass className="w-8 h-8 text-blue-600" />
            </div>
          </div>
        </div>

        {/* Nội dung thông báo */}
        <div className="space-y-3 mb-8">
          <h2 className="text-2xl font-extrabold tracking-tight text-slate-900">
            Ôi không! Bạn bị lạc đường rồi.
          </h2>
          <p className="text-[15px] text-slate-500 leading-relaxed max-w-sm mx-auto font-medium">
            Tài liệu, lớp học hoặc trang bạn đang tìm kiếm không tồn tại, đã bị xóa hoặc tạm thời đóng truy cập.
          </p>
        </div>

        {/* Nút bấm chuyển hướng */}
        <Link
          href="/schedule"
          className="inline-flex h-12 items-center justify-center gap-2.5 rounded-xl bg-blue-600 px-8 text-sm font-bold text-white transition-all hover:bg-blue-700 hover:shadow-lg hover:shadow-blue-600/20 active:scale-95 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
        >
          <Home size={18} strokeWidth={2.5} />
          Quay lại Bảng điều khiển
        </Link>
        
      </div>
    </div>
  );
}