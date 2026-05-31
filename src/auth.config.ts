import type { NextAuthConfig } from "next-auth";

export const authConfig = {
  session: { 
    strategy: "jwt",
    maxAge: 7 * 24 * 60 * 60, // 7 ngày
  },
  pages: {
    signIn: "/login",
  },
  providers: [], // Để trống, sẽ nạp Credentials ở file auth.ts sau
  callbacks: {
    // 1. Phân quyền Middleware (Bảo vệ Route)
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      const role = auth?.user?.role;
      const pathname = nextUrl.pathname;

      if (pathname.startsWith("/admin")) {
        if (isLoggedIn && role === "SUPER_ADMIN") return true;
        return false; 
      }
      
      // Chỗ này nếu web của ông dùng prefix "/ta" thay vì "/teacher" thì nhớ đổi lại nhé
      if (pathname.startsWith("/teacher")) {
        if (isLoggedIn) return true;
        return false;
      }

      return true; 
    },
    
    // 2. Nhét data vào JWT
    // ✅ BỔ SUNG: Thêm `trigger` và `session` vào tham số truyền vào
    async jwt({ token, user, trigger, session }) {
      // Khi user vừa đăng nhập thành công
      if (user) {
        token.id = user.id;
        token.role = user.role;
        token.fullName = user.fullName;
      }

      // ✅ BỔ SUNG: Bắt sự kiện khi Client gọi hàm `update({ fullName: "..." })`
      if (trigger === "update" && session?.fullName) {
        token.fullName = session.fullName;
      }

      return token;
    },

    // 3. Đẩy data từ JWT ra Session cho Client dùng
    async session({ session, token }) {
      if (token) {
        session.user.id = token.id as string;
        session.user.role = token.role as string;
        session.user.fullName = token.fullName as string;
      }
      return session;
    }
  }
} satisfies NextAuthConfig;