import { NextResponse } from "next/server";
import NextAuth from "next-auth";
import { authConfig } from "./auth.config"; // BẮT BUỘC IMPORT TỪ FILE NÀY

// Khởi tạo hàm auth từ config thuần (không có Prisma)
const { auth } = NextAuth(authConfig);

export default auth((req) => {
  const { nextUrl } = req;
  const isLoggedIn = !!req.auth;
  const isAuthRoute = nextUrl.pathname.startsWith('/login');
  
  // 1. Chưa đăng nhập mà không ở trang login -> Đuổi về login
  if (!isLoggedIn && !isAuthRoute) {
    return NextResponse.redirect(new URL("/login", nextUrl));
  }

  // 2. Đã đăng nhập nhưng cố vào /admin
  if (isLoggedIn && nextUrl.pathname.startsWith("/admin")) {
    const role = req.auth?.user?.role;
    if (role !== "SUPER_ADMIN") {
      // Đá giáo viên về dashboard của họ
      return NextResponse.redirect(new URL("/ta", nextUrl)); 
    }
  }

  // 3. Đã đăng nhập mà cố quay lại trang login -> Đẩy thẳng vào dashboard
  if (isLoggedIn && isAuthRoute) {
    const role = req.auth?.user?.role;
    const redirectUrl = role === "SUPER_ADMIN" ? "/admin" : "/ta";
    return NextResponse.redirect(new URL(redirectUrl, nextUrl));
  }

  return NextResponse.next();
});

export const config = {
  // Loại trừ api, file tĩnh, ảnh để server không bị quá tải
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};