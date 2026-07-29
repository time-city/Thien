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
