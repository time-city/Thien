"use server";

import { prisma } from "@/lib/prisma";
import { Prisma, SessionStatus } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";

export async function createBulkSchedule(data: {
  classId: string | null;
  teacherId: string;
  roomId: string;
  patterns: { day: number; startTimeString: string; endTimeString: string }[];
  startDate: string;
  endDate: string;
}) {
  const { classId, teacherId, roomId, patterns, startDate, endDate } = data;

  if (patterns.length === 0) return { success: false, error: "Chưa chọn lịch dạy!" };
  if (!teacherId) return { success: false, error: "Lớp học chưa được phân công giáo viên!" };

  const start = new Date(`${startDate}T00:00:00.000Z`);
  const end = new Date(`${endDate}T23:59:59.999Z`);
  const sessionsToCreate: Prisma.ClassSessionCreateManyInput[] = [];
  const datesToCheck: { startTime: Date; endTime: Date }[] = [];

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

      const sTime = new Date(targetDate);
      const [sh, sm] = pat.startTimeString.split(':').map(Number);
      // Giờ Việt Nam là GMT+7, chuyển giờ nhập thành UTC
      sTime.setUTCHours(sh - 7, sm, 0, 0);

      const eTime = new Date(targetDate);
      const [eh, em] = pat.endTimeString.split(':').map(Number);
      // Giờ Việt Nam là GMT+7, chuyển giờ nhập thành UTC
      eTime.setUTCHours(eh - 7, em, 0, 0);

      datesToCheck.push({ startTime: sTime, endTime: eTime });
      sessionsToCreate.push({
        classId,
        teacherId,
        roomId,
        date: targetDate,
        startTime: sTime,
        endTime: eTime,
        status: defaultStatus,
      });

      current.setUTCDate(current.getUTCDate() + 7);
    }
  }

  try {
    let result: any = { success: true };

    await prisma.$transaction(async (tx) => {
      // Khóa dòng Giáo viên để chống xử lý đồng thời khi nhiều người xếp lịch cùng lúc
      await tx.$executeRaw`SELECT id FROM "users" WHERE id = ${teacherId}::uuid FOR UPDATE`;

      // 1. KIỂM TRA TRÙNG LỊCH BÊN TRONG TRANSACTION
      const conflictingSessions = await tx.classSession.findMany({
        where: {
          AND: [
            { OR: [{ teacherId }, { roomId }] },
            { status: { not: "CANCELLED" } },
            {
              OR: datesToCheck.map(dt => ({
                startTime: { lt: dt.endTime },
                endTime: { gt: dt.startTime }
              }))
            }
          ]
        },
        include: { class: true, teacher: true, room: true }
      });

      if (conflictingSessions.length > 0) {
        const conflictUnique = new Map<string, { date: string; time: string; reason: string }>();

        for (const s of conflictingSessions) {
          const date = s.date.toLocaleDateString('vi-VN');
          const time = `${s.startTime.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })} - ${s.endTime.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}`;
          const reason = s.teacherId === teacherId ? "Giáo viên bận" : "Phòng bị trùng";
          const key = `${date}|${time}|${reason}`;
          if (!conflictUnique.has(key)) {
            conflictUnique.set(key, { date, time, reason });
          }
        }

        const first = conflictUnique.values().next().value as undefined | { date: string; time: string; reason: string };
        const count = conflictUnique.size;

        if (!first) {
          result = { success: false, error: "Trùng lịch!" };
          throw new Error("Trùng lịch"); // Ném lỗi để rollback transaction
        }

        const suffix = count > 1 ? ` (còn ${count - 1} khung khác)` : "";
        result = {
          success: false,
          error: `Trùng lịch! Đã có lớp học tại: ${first.date} (${first.time}) - ${first.reason}${suffix}.`,
        };
        throw new Error("Trùng lịch");
      }

      // 2. LƯU VÀO DB NẾU AN TOÀN
      // Dùng createManyAndReturn để chèn toàn bộ dữ liệu 1 lần và trả về ID
      const createdSessions = await tx.classSession.createManyAndReturn({
        data: sessionsToCreate
      });

      // Nếu là lớp tự do, trừ tiền và tạo log
      if (classId === null) {
        const room = await tx.room.findUnique({ where: { id: roomId } });
        const roomFeePerHour = room?.feePerHour ?? 0;

        if (roomFeePerHour > 0) {
          let totalFee = 0;
          const rentalLogs = createdSessions.map(s => {
            const sessionDurationHours = (s.endTime.getTime() - s.startTime.getTime()) / (1000 * 60 * 60);
            const feeCalculated = sessionDurationHours * roomFeePerHour;
            totalFee += feeCalculated;
            return {
              teacherId: teacherId,
              classSessionId: s.id,
              feeCalculated: feeCalculated,
              status: "PENDING" as const
            };
          });

          await tx.user.update({
            where: { id: teacherId },
            data: { salaryBalance: { decrement: totalFee } }
          });

          await tx.roomRentalLog.createMany({
            data: rentalLogs
          });
        }
      }
    });

    if (!result.success) return result;

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
  startTime: Date;
  endTime: Date;
  status: string;
  className: string;
  teacherFullName: string;
  roomId?: string | null;
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
      { startTime: "asc" },
    ],
  });

  return sessions.map((s) => ({
    id: s.id,
    date: s.date,
    startTime: s.startTime,
    endTime: s.endTime,
    status: s.status,
    className: s.class?.name || "Lớp Tự Do (Thuê phòng)",
    teacherFullName: s.teacher.fullName,
    roomId: s.roomId
  }));
}


export async function deleteSchedule(
  sessionId: string,
  mode: "SINGLE" | "FOLLOWING",
) {
  const target = await prisma.classSession.findUnique({
    where: { id: sessionId },
    select: { id: true, classId: true, teacherId: true, startTime: true, endTime: true, date: true },
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

  const targetDate = target.date;
  const targetDow = (() => {
    const js = targetDate.getDay();
    return js === 0 ? 7 : js;
  })();

  const allCandidates = await prisma.classSession.findMany({
    where: {
      classId: target.classId,
      teacherId: target.teacherId,
      date: { gte: targetDate },
    },
    select: { id: true, date: true, startTime: true },
  });

  const targetHour = target.startTime.getUTCHours();
  const targetMinute = target.startTime.getUTCMinutes();

  const toDeleteIds = allCandidates
    .filter((s) => {
      const js = s.date.getDay();
      const dow = js === 0 ? 7 : js;
      return dow === targetDow && s.startTime.getUTCHours() === targetHour && s.startTime.getUTCMinutes() === targetMinute;
    })
    .map((s) => s.id);

  if (toDeleteIds.length === 0) {
    revalidatePath("/schedule");
    revalidatePath("/admin/schedule");
    revalidatePath("/schedule/me");
    return { success: true };
  }

  await prisma.classSession.deleteMany({ where: { id: { in: toDeleteIds } } });
  revalidatePath("/schedule");
  revalidatePath("/admin/schedule");
  revalidatePath("/schedule/me");

  return { success: true };
}

export async function getTodayQuickAttendance() {
  const session = await auth();
  if (!session?.user?.id) return [];

  const userId = session.user.id;
  
  // Lấy ngày hôm nay
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const sessions = await prisma.classSession.findMany({
    where: {
      teacherId: userId,
      date: {
        gte: today,
        lt: tomorrow
      },
      status: { not: "CANCELLED" },
      classId: { not: null } // Bỏ qua freelance
    },
    include: { class: true, room: true },
    orderBy: { startTime: "asc" }
  });

  return (sessions as any[]).map(s => ({
    id: s.id,
    classId: s.classId,
    className: s.class?.name || "",
    roomId: s.roomId,
    roomName: s.room?.name || "",
    date: s.date,
    startTime: s.startTime,
    endTime: s.endTime,
    status: s.status,
    isAttendanceSubmitted: s.isAttendanceSubmitted
  }));
}

// Hàm quét phòng trống bị xóa vì đổi sang time picker. Mọi xử lý sẽ được check ở createBulkSchedule.
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
        select: { id: true, classId: true, teacherId: true, startTime: true, date: true },
      });

      let allIdsToDelete = new Set<string>();

      for (const target of targets) {
        const targetDate = target.date;
        const targetDow = (() => {
          const js = targetDate.getDay();
          return js === 0 ? 7 : js;
        })();
        const targetHour = target.startTime.getUTCHours();
        const targetMinute = target.startTime.getUTCMinutes();

        const candidates = await prisma.classSession.findMany({
          where: {
            classId: target.classId,
            teacherId: target.teacherId,
            date: { gte: targetDate },
          },
          select: { id: true, date: true, startTime: true },
        });

        for (const s of candidates) {
          const js = s.date.getDay();
          const dow = js === 0 ? 7 : js;
          if (dow === targetDow && s.startTime.getUTCHours() === targetHour && s.startTime.getUTCMinutes() === targetMinute) {
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

export async function updateSessionTime(sessionId: string, newStartTime: Date, newEndTime: Date) {
  try {
    // 1. Kiểm tra đầu vào hợp lệ
    const start = new Date(newStartTime);
    const end = new Date(newEndTime);

    if (start >= end) {
      return { success: false, error: "Giờ bắt đầu phải trước giờ kết thúc." };
    }

    // Lấy ngày mới (loại bỏ phần giờ phút để lưu vào trường db.Date)
    // Để an toàn với timezone, ta cộng 7 tiếng để ra giờ VN, lấy chuỗi YYYY-MM-DD rồi gán thành ngày UTC.
    const startVnTime = new Date(start.getTime() + 7 * 60 * 60 * 1000);
    const yyyy = startVnTime.getUTCFullYear();
    const mm = startVnTime.getUTCMonth();
    const dd = startVnTime.getUTCDate();
    const newDate = new Date(Date.UTC(yyyy, mm, dd, 0, 0, 0, 0));

    // 2. Lấy thông tin ca học hiện tại
    const existingSession = await prisma.classSession.findUnique({
      where: { id: sessionId },
      include: { room: true } // Kéo theo thông tin phòng để lát tính tiền
    });

    if (!existingSession) {
      return { success: false, error: "Không tìm thấy ca học." };
    }

    // 3. THỰC HIỆN CẬP NHẬT TRONG TRANSACTION
    let result: any = { success: true };

    await prisma.$transaction(async (tx) => {
      // Khóa dòng Teacher để chống Race Condition khi đổi lịch
      await tx.$executeRaw`SELECT id FROM "users" WHERE id = ${existingSession.teacherId}::uuid FOR UPDATE`;

      // 3.1 KIỂM TRA ĐỤNG ĐỘ LỊCH (Overlap Check) BÊN TRONG TRANSACTION
      // Công thức: (StartA < EndB) và (EndA > StartB)
      const conflict = await tx.classSession.findFirst({
        where: {
          id: { not: sessionId }, // Bỏ qua chính ca học đang sửa
          status: { not: "CANCELLED" }, // Bỏ qua các ca đã hủy
          // Check trùng giáo viên HOẶC trùng phòng
          OR: [
            { teacherId: existingSession.teacherId },
            ...(existingSession.roomId ? [{ roomId: existingSession.roomId }] : [])
          ],
          // Logic giao nhau thời gian
          startTime: { lt: end },
          endTime: { gt: start }
        }
      });

      if (conflict) {
        // Thông báo chi tiết lỗi đụng độ
        if (conflict.teacherId === existingSession.teacherId) {
          result = { success: false, error: "Giáo viên đã có lịch dạy trong khung giờ này!" };
        } else if (existingSession.roomId && conflict.roomId === existingSession.roomId) {
          result = { success: false, error: "Phòng học đã được đặt bởi người khác trong khung giờ này!" };
        } else {
          result = { success: false, error: "Khung giờ này đã bị trùng lịch!" };
        }
        throw new Error("Trùng lịch"); // Ném lỗi để rollback transaction
      }

      // 3.2 Cập nhật lại thời gian của ca học
      await tx.classSession.update({
        where: { id: sessionId },
        data: {
          date: newDate,
          startTime: start,
          endTime: end,
        }
      });

      // 3.3 Tính lại tiền phòng (Nếu ca này có thuê phòng)
      if (existingSession.roomId && existingSession.room) {
        // Tính số giờ thuê (chênh lệch mili-giây -> quy ra giờ)
        const durationHours = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
        const newFee = durationHours * existingSession.room.feePerHour;

        // Cập nhật lại log tính tiền nếu nó tồn tại
        const rentalLog = await tx.roomRentalLog.findFirst({
          where: { classSessionId: sessionId }
        });

        if (rentalLog) {
          await tx.roomRentalLog.update({
            where: { id: rentalLog.id },
            data: { feeCalculated: newFee }
          });
        }
      }
    });

    return { success: true };
  } catch (error) {
    console.error("Lỗi cập nhật giờ:", error);
    return { success: false, error: "Không thể cập nhật giờ học! Đã có lỗi hệ thống xảy ra." };
  }
}