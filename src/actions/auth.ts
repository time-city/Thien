"use server";

import { signIn } from "@/auth";
import { AuthError } from "next-auth";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache"; // <-- 1. Thêm import này

export async function loginAction(formData: FormData) {
  const username = formData.get("username") as string;
  const password = formData.get("password") as string;

  try {
    await signIn("credentials", {
      username,
      password,
      redirect: false,
    });
  } catch (error) {
   

    if (error instanceof AuthError) {
      const customMessage = (error.cause?.err as Error)?.message;
      return { error: customMessage || "Tên đăng nhập hoặc mật khẩu không chính xác." };
    }
    throw error;
  }

  // 2. ÉP XÓA CACHE TRƯỚC KHI CHUYỂN TRANG
  // Lệnh này báo Next.js xóa sạch bộ nhớ tạm của toàn bộ Layout (từ Root trở xuống).
  revalidatePath("/", "layout"); 

  // 3. Chuyển trang (nhớ dấu / ở đầu để không lỗi production nhé)
  redirect("/schedule");
}