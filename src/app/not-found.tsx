import Link from "next/link";

export default function NotFound() {
  return (
    <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-zinc-950 text-zinc-200">
      <div className="flex flex-col items-center space-y-6 text-center">
        <h1 className="text-9xl font-bold tracking-tight text-zinc-100">404</h1>
        <div className="space-y-2">
          <h2 className="text-2xl font-semibold tracking-tight text-zinc-100">
            Không tìm thấy trang
          </h2>
          <p className="text-zinc-400 max-w-md">
            Trang bạn đang tìm kiếm có thể đã bị xóa, đổi tên hoặc tạm thời
            không khả dụng.
          </p>
        </div>
        <Link href="/schedule" className="inline-flex h-11 items-center justify-center rounded-lg bg-blue-600 px-8 text-sm font-medium text-white transition-colors hover:bg-blue-700 focus:outline-none focus:ring-0 disabled:pointer-events-none disabled:opacity-50">
          <button className="inline-flex h-11 items-center justify-center rounded-lg bg-blue-600 px-8 text-sm font-medium text-white transition-colors hover:bg-blue-700 focus:outline-none focus:ring-0 disabled:pointer-events-none disabled:opacity-50">
            Quay lại trang chủ
          </button>
        </Link>
      </div>
    </div>
  );
}
