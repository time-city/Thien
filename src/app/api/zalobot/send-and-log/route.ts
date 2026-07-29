import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ZaloMessageType } from "@prisma/client";

/**
 * POST /api/zalobot/send-and-log
 * Proxy qua Zalo Bot server và đồng thời lưu log vào DB.
 * Dùng cho các call từ browser (client components) không thể gọi sendZaloAndLog trực tiếp.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { target, message, messageType, studentId } = body as {
      target: string;
      message: string;
      messageType: ZaloMessageType;
      studentId?: string;
    };

    if (!target || !message || !messageType) {
      return NextResponse.json({ success: false, error: "Thiếu tham số bắt buộc" }, { status: 400 });
    }

    const ZALO_BOT_URL = process.env.NEXT_PUBLIC_ZALO_BOT_URL || "http://116.118.9.61:8080";
    const ZALO_BOT_API_KEY = process.env.NEXT_PUBLIC_ZALO_BOT_API_KEY || "";

    let success = true;
    let errorNote: string | undefined;

    // Gọi Zalo Bot
    try {
      const res = await fetch(`${ZALO_BOT_URL}/send`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": ZALO_BOT_API_KEY,
        },
        body: JSON.stringify({ target, message }),
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
    await prisma.zaloMessageLog.create({
      data: {
        phone: target,
        message,
        messageType,
        studentId: studentId ?? null,
        success,
        errorNote: errorNote ?? null,
      },
    });

    if (!success) {
      return NextResponse.json({ success: false, error: errorNote }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("[/api/zalobot/send-and-log] Error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
