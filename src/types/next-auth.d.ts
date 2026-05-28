import { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface User {
    id: string;
    role: string;
    fullName: string;
    username?: string;
  }

  interface Session {
    user: User & DefaultSession["user"];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    role: string;
    fullName: string;
  }
}
