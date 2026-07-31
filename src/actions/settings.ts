"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

export async function getSystemSetting(key: string, defaultValue: string = ""): Promise<string> {
  const setting = await prisma.systemSetting.findUnique({
    where: { key }
  });
  return setting ? setting.value : defaultValue;
}

export async function setSystemSetting(key: string, value: string): Promise<{ success: boolean; message?: string }> {
  try {
    await prisma.systemSetting.upsert({
      where: { key },
      update: { value },
      create: { key, value }
    });
    revalidatePath("/");
    return { success: true };
  } catch (error) {
    console.error("Lỗi khi lưu cài đặt:", error);
    return { success: false, message: "Không thể lưu cài đặt" };
  }
}
