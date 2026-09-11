"use server";

import { prisma } from "@/lib/prisma";
import { ZaloMessageType } from "@prisma/client";

export type ZaloLogItem = {
  id: string;
  studentId: string | null;
  studentName: string | null;
  phone: string;
  messageType: ZaloMessageType;
  message: string;
  success: boolean;
  errorNote: string | null;
  sentAt: Date;
};

export type GetZaloLogsResult = {
  logs: ZaloLogItem[];
  total: number;
  page: number;
  pageSize: number;
};

export async function getZaloMessageLogs({
  page = 1,
  pageSize = 30,
  messageType,
  studentName,
  fromDate,
  toDate,
}: {
  page?: number;
  pageSize?: number;
  messageType?: ZaloMessageType | "ALL";
  studentName?: string;
  fromDate?: string;
  toDate?: string;
}): Promise<GetZaloLogsResult> {
  const where: any = {};

  if (messageType && messageType !== "ALL") {
    where.messageType = messageType;
  }

  if (studentName) {
    where.OR = [
      { student: { fullName: { contains: studentName, mode: "insensitive" } } },
      { phone: { contains: studentName } }
    ];
  }

  if (fromDate || toDate) {
    where.sentAt = {};
    if (fromDate) {
      where.sentAt.gte = new Date(`${fromDate}T00:00:00+07:00`);
    }
    if (toDate) {
      where.sentAt.lte = new Date(`${toDate}T23:59:59.999+07:00`);
    }
  }

  const [logs, total] = await Promise.all([
    prisma.zaloMessageLog.findMany({
      where,
      orderBy: { sentAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        student: { select: { fullName: true } },
      },
    }),
    prisma.zaloMessageLog.count({ where }),
  ]);

  return {
    logs: logs.map((l) => ({
      id: l.id,
      studentId: l.studentId,
      studentName: l.student?.fullName ?? null,
      phone: l.phone,
      messageType: l.messageType,
      message: l.message,
      success: l.success,
      errorNote: l.errorNote,
      sentAt: l.sentAt,
    })),
    total,
    page,
    pageSize,
  };
}

export async function resendZaloMessage(logId: string): Promise<{ success: boolean; message?: string }> {
  try {
    const oldLog = await prisma.zaloMessageLog.findUnique({
      where: { id: logId }
    });

    if (!oldLog) {
      return { success: false, message: "Không tìm thấy tin nhắn cũ." };
    }

    // Call the external API again to avoid cyclic dependencies with `sendZaloAndLog` or we can just import it.
    // Wait, we can import `sendZaloAndLog` at the top. Let's just import it at the top and call it here.
    // However, since `zalo.ts` is an action file, let's just do it directly.
    const ZALO_BOT_URL = process.env.NEXT_PUBLIC_ZALO_BOT_URL || "http://116.118.9.61:8080";
    const ZALO_BOT_API_KEY = process.env.NEXT_PUBLIC_ZALO_BOT_API_KEY || "";
    
    const res = await fetch(`${ZALO_BOT_URL}/send`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ZALO_BOT_API_KEY,
      },
      body: JSON.stringify({ target: oldLog.phone, message: oldLog.message }),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => "Không thể đọc response");
      return { success: false, message: `Lỗi khi gửi lại: HTTP ${res.status}: ${errText}` };
    }

    // Log the new successful message and delete the old failed log
    await prisma.$transaction([
      prisma.zaloMessageLog.create({
        data: {
          phone: oldLog.phone,
          message: oldLog.message,
          messageType: oldLog.messageType,
          studentId: oldLog.studentId,
          success: true,
        },
      }),
      prisma.zaloMessageLog.delete({
        where: { id: logId }
      })
    ]);

    return { success: true };
  } catch (error: any) {
    console.error("resendZaloMessage error:", error);
    return { success: false, message: error?.message || "Lỗi hệ thống khi gửi lại tin nhắn." };
  }
}
