"use server";

import { prisma } from "@/lib/prisma";
import { Prisma, SessionStatus } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";

export async function createBulkSchedule(data: {
  classId: string | null;
  teacherId: string;
  roomId: string;
  patterns: { day: number; slot: number }[]; // Dữ liệu mới: Mảng chứa các ô lưới được chọn
  startDate: string;
  endDate: string;
}) {
  const { classId, teacherId, roomId, patterns, startDate, endDate } = data;

  if (patterns.length === 0) return { success: false, error: "Chưa chọn lịch dạy!" };
  if (!teacherId) return { success: false, error: "Lớp học chưa được phân công giáo viên!" };

  const start = new Date(`${startDate}T00:00:00.000Z`);
  const end = new Date(`${endDate}T23:59:59.999Z`);
  const sessionsToCreate: Prisma.ClassSessionCreateManyInput[] = [];
  const datesToCheck: { date: Date; slot: number }[] = [];

  const session = await auth();
  const isAdmin = session?.user?.role === "SUPER_ADMIN";
  const defaultStatus = isAdmin ? SessionStatus.SCHEDULED : SessionStatus.PENDING;

  // Quét vòng lặp theo khoảng ngày và các ô lưới được chọn
  for (const pat of patterns) {
    const current = new Date(start);
    let diff = pat.day - current.getUTCDay();
    if (diff < 0) diff += 7;
    current.setUTCDate(current.getUTCDate() + diff);

    while (current <= end) {
      const targetDate = new Date(current);
      datesToCheck.push({ date: targetDate, slot: pat.slot });
      sessionsToCreate.push({
        classId,
        teacherId,
        roomId,
        date: targetDate,
        slot: pat.slot,
        status: defaultStatus,
      });

      current.setUTCDate(current.getUTCDate() + 7);
    }
  }

  try {
    // 1. KIỂM TRA TRÙNG LỊCH CHO TỪNG Ô ĐƯỢC CHỌN
    // Vì mỗi ô khác slot nhau, ta gom lại check bằng câu lệnh OR
    const conflictingSessions = await prisma.classSession.findMany({
      where: {
        AND: [
          { OR: datesToCheck.map(dt => ({ date: dt.date, slot: dt.slot })) },
          { OR: [{ teacherId }, { roomId }] },
          { status: { not: "CANCELLED" } }
        ]
      },
      include: { class: true, teacher: true, room: true }
    });

    if (conflictingSessions.length > 0) {
      const conflictDetails = conflictingSessions.map(
        (s) => `Ngày ${s.date.toLocaleDateString('vi-VN')} (Ca ${s.slot}): ${s.teacherId === teacherId ? "Giáo viên bận" : "Phòng bị trùng"}`
      ).join(", ");
      return { success: false, error: `Trùng lịch! Đã có lớp học tại: ${conflictDetails}.` };
    }

    // 2. LƯU VÀO DB NẾU AN TOÀN
    await prisma.$transaction(async (tx) => {
      // Dùng createManyAndReturn để chèn toàn bộ dữ liệu 1 lần và trả về ID
      const createdSessions = await tx.classSession.createManyAndReturn({
        data: sessionsToCreate
      });

      // Nếu là lớp tự do, trừ tiền và tạo log
      if (classId === null) {
        const room = await tx.room.findUnique({ where: { id: roomId } });
        const roomFee = room?.feePerSession ?? 0;

        if (roomFee > 0) {
          const totalFee = roomFee * createdSessions.length;
          await tx.user.update({
            where: { id: teacherId },
            data: { salaryBalance: { decrement: totalFee } }
          });

          await tx.roomRentalLog.createMany({
            data: createdSessions.map(s => ({
              teacherId: teacherId,
              classSessionId: s.id,
              feeCalculated: roomFee,
              status: "PENDING"
            }))
          });
        }
      }
    });

    revalidatePath("/schedule");
    return { success: true };

  } catch (error) {
    console.error(error);
    return { success: false, error: "Lỗi hệ thống khi tạo lịch học." };
  }
}


export type ScheduleSessionByDateRange = {

  id: string;

  date: Date;
  slot: number;
  status: string;
  className: string;
  teacherFullName: string;
};

export async function getScheduleByDateRange(
  startDate: Date,
  endDate: Date,
): Promise<ScheduleSessionByDateRange[]> {

  const sessions = await prisma.classSession.findMany({
    where: {
      date: {
        gte: startDate,
        lte: endDate,
      },
    },
    include: {
      class: true,
      teacher: true,
    },
    orderBy: [
      { date: "asc" },
      { slot: "asc" },
    ],
  });

  return sessions.map((s) => ({
    id: s.id,
    date: s.date,
    slot: s.slot,
    status: s.status,
    className: s.class?.name || "Lớp Tự Do (Thuê phòng)",
    teacherFullName: s.teacher.fullName,
  }));
}


export async function deleteSchedule(
  sessionId: string,
  mode: "SINGLE" | "FOLLOWING",
) {
  // Infer series by exact tuple:
  // (classId, teacherId, slot, weekdayPattern)
  // weekdayPattern == day-of-week of the provided sessionId (in local date)

  const target = await prisma.classSession.findUnique({
    where: { id: sessionId },
    select: { id: true, classId: true, teacherId: true, slot: true, date: true },
  });

  if (!target) {
    return { success: false, error: "Session not found" };
  }

  if (mode === "SINGLE") {
    await prisma.classSession.delete({ where: { id: sessionId } });
    revalidatePath("/schedule");
    revalidatePath("/admin/schedule");
    revalidatePath("/schedule/me");
    return { success: true };
  }

  // FOLLOWING: delete all sessions in the same series starting from the target date
  // We don’t have an explicit recurrence/group id in schema, so we infer using:
  // same (classId, teacherId, slot, day-of-week) and date >= target.date

  const targetDate = target.date;
  const targetDow = (() => {
    // JS: 0=Sun..6=Sat. Convert to Mon..Sun => 1..7.
    const js = targetDate.getDay();
    return js === 0 ? 7 : js;
  })();

  // In Postgres, Prisma doesn’t expose day-of-week easily without raw.
  // So we compute candidate sessions by querying by date range and then filtering client-side.
  // (This is acceptable for the limited UI window.)

  const allCandidates = await prisma.classSession.findMany({
    where: {
      classId: target.classId,
      teacherId: target.teacherId,
      slot: target.slot,
      date: { gte: targetDate },
    },
    select: { id: true, date: true },
  });

  const toDeleteIds = allCandidates
    .filter((s) => {
      const js = s.date.getDay();
      const dow = js === 0 ? 7 : js;
      return dow === targetDow;
    })
    .map((s) => s.id);

  if (toDeleteIds.length === 0) {
    revalidatePath("/schedule");
    revalidatePath("/admin/schedule");
    revalidatePath("/schedule/me");
    return { success: true };
  }

  // Delete many
  await prisma.classSession.deleteMany({ where: { id: { in: toDeleteIds } } });
  revalidatePath("/schedule");
  revalidatePath("/admin/schedule");
  revalidatePath("/schedule/me");

  return { success: true };
}

// thêm lịch học hàng loạt (dành cho SUPER_ADMIN)
export async function getOccupiedPatterns(startDate: string, endDate: string, teacherId: string, roomId: string) {
  const start = new Date(`${startDate}T00:00:00.000Z`);
  const end = new Date(`${endDate}T23:59:59.999Z`);

  // Lấy tất cả các ca học nằm trong khoảng thời gian này
  const sessions = await prisma.classSession.findMany({
    where: {
      date: {
        gte: start,
        lte: end,
      },
      status: { not: "CANCELLED" },
      OR: [
        { teacherId },
        { roomId }
      ]
    },
    select: { date: true, slot: true },
  });

  // Lọc ra các tổ hợp (Thứ - Ca) đã bị chiếm
  const occupied = new Set<string>();
  sessions.forEach((s) => {
    const day = s.date.getUTCDay(); // Lấy ngày trong tuần (0: CN -> 6: T7)
    occupied.add(`${day}-${s.slot}`);
  });

  // Trả về mảng dễ đọc cho Frontend xử lý
  return Array.from(occupied).map((str) => {
    const [day, slot] = str.split("-");
    return { day: Number(day), slot: Number(slot) };
  });
}

// xoá nhiều lịch cùng lúc (dành cho SUPER_ADMIN)

export async function deleteBulkSchedules(sessionIds: string[], mode: "SINGLE" | "FOLLOWING" = "SINGLE") {
  if (!sessionIds || sessionIds.length === 0) {
    return { success: false, error: "Không có lịch nào được chọn" };
  }

  try {
    if (mode === "SINGLE") {
      await prisma.classSession.deleteMany({
        where: {
          id: { in: sessionIds },
        },
      });
    } else {
      // FOLLOWING mode cho bulk
      const targets = await prisma.classSession.findMany({
        where: { id: { in: sessionIds } },
        select: { id: true, classId: true, teacherId: true, slot: true, date: true },
      });

      let allIdsToDelete = new Set<string>();

      for (const target of targets) {
        const targetDate = target.date;
        const targetDow = (() => {
          const js = targetDate.getDay();
          return js === 0 ? 7 : js;
        })();

        const candidates = await prisma.classSession.findMany({
          where: {
            classId: target.classId,
            teacherId: target.teacherId,
            slot: target.slot,
            date: { gte: targetDate },
          },
          select: { id: true, date: true },
        });

        for (const s of candidates) {
          const js = s.date.getDay();
          const dow = js === 0 ? 7 : js;
          if (dow === targetDow) {
            allIdsToDelete.add(s.id);
          }
        }
      }

      const toDeleteArray = Array.from(allIdsToDelete);
      if (toDeleteArray.length > 0) {
        await prisma.classSession.deleteMany({
          where: { id: { in: toDeleteArray } },
        });
      }
    }

    revalidatePath("/schedule");
    revalidatePath("/admin/schedule");
    revalidatePath("/schedule/me");
    return { success: true };
  } catch (error) {
    console.error("Lỗi khi xóa lịch hàng loạt:", error);
    return { success: false, error: "Đã xảy ra lỗi khi xóa lịch." };
  }
}