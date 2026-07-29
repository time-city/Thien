import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ZaloMessageType } from "@prisma/client";

/**
 * POST /api/zalobot/log-only
 * Chỉ ghi log vào DB, KHÔNG gửi Zalo.
 * Dùng sau khi đã gửi ảnh (send-image) để ghi nhận đã gửi.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { phone, message, messageType, studentId, success, errorNote } = body as {
      phone: string;
      message: string;
      messageType: ZaloMessageType;
      studentId?: string;
      success?: boolean;
      errorNote?: string;
    };

    if (!phone || !messageType) {
      return NextResponse.json({ success: false, error: "Thiếu tham số bắt buộc" }, { status: 400 });
    }

    await prisma.zaloMessageLog.create({
      data: {
        phone,
        message: message ?? "(ảnh)",
        messageType,
        studentId: studentId ?? null,
        success: success !== false,
        errorNote: errorNote ?? null,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("[/api/zalobot/log-only] Error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
