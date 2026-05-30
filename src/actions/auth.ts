"use server";

import { signIn } from "@/auth";
import { AuthError } from "next-auth";

export async function loginAction(formData: FormData) {
  const username = formData.get("username") as string;
  const password = formData.get("password") as string;

  try {
    await signIn("credentials", {
      username,
      password,
      redirect: false, // Bắt buộc phải là false để nó không tự văng lỗi redirect
    });
    
    // Đăng nhập đúng -> Trả về success để Client tự xử lý
    return { success: true }; 

  } catch (error) {
    if (error instanceof AuthError) {
      const customMessage = (error.cause?.err as Error)?.message;
      return { success: false, error: customMessage || "Tên đăng nhập hoặc mật khẩu không chính xác." };
    }
    return { success: false, error: "Đã xảy ra lỗi trong quá trình đăng nhập." };
  }
}