"use server";

import { signIn } from "@/auth";
import { AuthError } from "next-auth";
import { redirect } from "next/navigation";

export async function loginAction(formData: FormData) {
  const username = formData.get("username") as string;
  const password = formData.get("password") as string;

  try {
    const res = await signIn("credentials", {
      username,
      password,
      // We handle redirect explicitly from this server action.
      redirect: false,
    });

    if (!res || (res as any).error) {
      return { error: "Tên đăng nhập hoặc mật khẩu không chính xác." };
    }

    // Force Next.js to re-evaluate server components with the new session.
    // (Choose the correct landing route for your app.)
    return redirect("schedule");
  } catch (error) {
    if (error instanceof AuthError) {
      console.error("Authentication error:", error);
      switch (error.type) {
        case "CredentialsSignin":
          return { error: "Tên đăng nhập hoặc mật khẩu không chính xác." };
        default:
          return { error: "Tên đăng nhập hoặc mật khẩu không chính xác." };
      }
    }
    throw error;
  }
}

