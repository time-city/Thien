"use server";

import { signIn } from "@/auth";
import { AuthError } from "next-auth";

export async function loginAction(formData: FormData) {
  try {
    const username = formData.get("username") as string;
    const password = formData.get("password") as string;
    
    // Auth.js handles the response redirect inside signIn if we don't catch it, 
    // but typically we pass redirect options.
    await signIn("credentials", {
      username,
      password,
      redirectTo: "/", // Middleware will handle redirecting based on role
    });
    
  } catch (error) {
    if (error instanceof AuthError) {
      switch (error.type) {
        case "CredentialsSignin":
          return { error: "Tên đăng nhập hoặc mật khẩu không chính xác." };
        default:
          return { error: "Đã xảy ra lỗi trong quá trình đăng nhập." };
      }
    }
    // Auth.js NEXT_REDIRECT error must be thrown so Next.js can handle the redirect gracefully
    throw error;
  }
}
