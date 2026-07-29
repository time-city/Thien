"use server";

import { prisma } from "@/lib/prisma";
import { ZaloMessageType } from "@prisma/client";

const ZALO_BOT_URL = process.env.NEXT_PUBLIC_ZALO_BOT_URL || "http://116.118.9.61:8080";
const ZALO_BOT_API_KEY = process.env.NEXT_PUBLIC_ZALO_BOT_API_KEY || "";

/**
 * Gửi tin nhắn Zalo và tự động lưu log vào DB.
 * Dùng hàm này thay vì gọi fetch trực tiếp ở mọi nơi.
 */
export async function sendZaloAndLog({
  phone,
  message,
  messageType,
  studentId,
}: {
  phone: string;
  message: string;
  messageType: ZaloMessageType;
  studentId?: string;
}): Promise<{ success: boolean; errorNote?: string }> {
  let success = true;
  let errorNote: string | undefined;

  try {
    const res = await fetch(`${ZALO_BOT_URL}/send`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ZALO_BOT_API_KEY,
      },
      body: JSON.stringify({ target: phone, message }),
    });

    if (!res.ok) {
      success = false;
      const errText = await res.text().catch(() => "Không thể đọc response");
      errorNote = `HTTP ${res.status}: ${errText}`;
    }
  } catch (e: any) {
    success = false;
    errorNote = e?.message || "Lỗi kết nối Zalo Bot";
  }

  // Lưu log dù thành công hay thất bại
  try {
    await prisma.zaloMessageLog.create({
      data: {
        phone,
        message,
        messageType,
        studentId: studentId ?? null,
        success,
        errorNote: errorNote ?? null,
      },
    });
  } catch (logErr) {
    // Không để lỗi log làm hỏng luồng chính
    console.error("[ZaloLog] Không thể lưu log tin nhắn:", logErr);
  }

  return { success, errorNote };
}
