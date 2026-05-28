import NextAuth from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { authConfig } from "./auth.config";

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig, // Trải toàn bộ config ở file kia vào đây
  adapter: PrismaAdapter(prisma),
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        username: { label: "Username", type: "text" },
        password: { label: "Password", type: "password" }
      },
      async authorize(credentials) {
        if (!credentials?.username || !credentials?.password) {
          throw new Error("Vui lòng nhập đầy đủ tài khoản và mật khẩu");
        }

        const user = await prisma.user.findUnique({
          where: { username: credentials.username as string }
        });

        if (!user) throw new Error("Không tìm thấy tài khoản");
        if (!user.isActive) throw new Error("Tài khoản đã bị khóa");

        const isValidPassword = await bcrypt.compare(
          credentials.password as string,
          user.passwordHash
        );

        if (!isValidPassword) throw new Error("Sai mật khẩu");

        return {
          id: user.id,
          username: user.username,
          fullName: user.fullName,
          role: user.role,
        };
      }
    })
  ]
});