"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

import { getTeachersForFinance } from "./queries";

export async function fetchTeachersFinance(month?: number, year?: number) {
  return await getTeachersForFinance(month, year);
}

export async function settleTeacherBalance(
  teacherId: string, 
  amount: number, 
  type: "PAYOUT_SALARY" | "COLLECT_RENTAL", 
  note?: string,
  month?: number,
  year?: number
) {
  try {
    if (amount <= 0) {
      return { success: false, message: "Số tiền giao dịch phải lớn hơn 0" };
    }

    const currentDate = new Date();
    const targetMonth = month !== undefined ? month : currentDate.getMonth() + 1;
    const targetYear = year !== undefined ? year : currentDate.getFullYear();
    const startDate = new Date(targetYear, targetMonth - 1, 1);
    const endDate = new Date(targetYear, targetMonth, 0, 23, 59, 59, 999);

    await prisma.$transaction(async (tx) => {
      // Khóa dòng Teacher để chống xử lý đồng thời (Race Condition) khi nhấp đúp
      await tx.$executeRaw`SELECT id FROM "users" WHERE id = ${teacherId}::uuid FOR UPDATE`;

      if (type === "PAYOUT_SALARY") {
        // Trung tâm trả lương cứng cho GV
        await tx.user.update({
          where: { id: teacherId },
          data: { salaryBalance: { decrement: amount } }
        });

        await tx.salaryPayment.create({
          data: {
            teacherId,
            amount,
            note: note || `Thanh toán lương tháng ${targetMonth}/${targetYear}`
          }
        });
      } else if (type === "COLLECT_RENTAL") {
        // Thu nợ tiền phòng từ GV Freelance
        await tx.user.update({
          where: { id: teacherId },
          data: { salaryBalance: { increment: amount } } // Kéo số dư âm về 0
        });
      }

      // Bất kể là thanh toán lương hay thu tiền phòng, khi đã "chốt" thì tất cả 
      // các ca dạy và khoản nợ phòng trong tháng đó đều được coi là đã cấn trừ và hoàn tất.
      await tx.classSession.updateMany({
        where: {
          teacherId,
          status: "COMPLETED",
          isPaid: false,
          date: { gte: startDate, lte: endDate }
        },
        data: {
          isPaid: true
        }
      });

      await tx.roomRentalLog.updateMany({
        where: {
          teacherId,
          status: "PENDING",
          classSession: { date: { gte: startDate, lte: endDate } }
        },
        data: {
          status: "PAID"
        }
      });
    });

    revalidatePath("/admin/teachers");
    revalidatePath("/admin/payroll");
    return { success: true };
  } catch (error: any) {
    console.error("settleTeacherBalance error:", error);
    return { success: false, message: error.message };
  }
}

export async function getTeacherRoomRentalDetails(teacherId: string, month: number, year: number) {
  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 0, 23, 59, 59, 999);

  const logs = await prisma.roomRentalLog.findMany({
    where: {
      teacherId,
      status: "PENDING",
      classSession: { date: { gte: startDate, lte: endDate } }
    },
    include: {
      classSession: {
        include: {
          room: true,
          class: true
        }
      }
    },
    orderBy: {
      classSession: {
        date: "asc"
      }
    }
  });

  return logs.map(log => {
    const sTime = new Date(log.classSession.startTime);
    const eTime = new Date(log.classSession.endTime);
    const durationHours = (eTime.getTime() - sTime.getTime()) / (1000 * 60 * 60);
    const unitPrice = durationHours > 0 ? log.feeCalculated / durationHours : 0;

    return {
      id: log.id,
      date: log.classSession.date,
      startTime: sTime,
      endTime: eTime,
      durationHours,
      unitPrice,
      feeCalculated: log.feeCalculated,
      roomName: log.classSession.room?.name || "Phòng chưa xếp",
      className: log.classSession.class?.name || "Lớp Tự Do"
    };
  });
}

export type TeachingSessionDetail = {
  id: string;
  date: Date;
  startTime: Date;
  endTime: Date;
  className: string;
  salaryPerSession: number;
};

export async function getTeacherSalaryDetails(teacherId: string, month?: number, year?: number) {
  const currentDate = new Date();
  const targetMonth = month !== undefined ? month : currentDate.getMonth() + 1;
  const targetYear = year !== undefined ? year : currentDate.getFullYear();

  const startDate = new Date(targetYear, targetMonth - 1, 1);
  const endDate = new Date(targetYear, targetMonth, 0, 23, 59, 59, 999);

  // 1. Lấy danh sách ca dạy CHƯA THANH TOÁN TRONG THÁNG
  const unpaidSessions = await prisma.classSession.findMany({
    where: {
      teacherId,
      status: "COMPLETED",
      isPaid: false,
      date: { gte: startDate, lte: endDate }
    },
    include: {
      class: {
        include: {
          teachers: {
            where: { teacherId }
          }
        }
      }
    },
    orderBy: { date: 'asc' }
  });

  const teachingSessions: TeachingSessionDetail[] = unpaidSessions.map(session => {
    let salary = 0;
    let className = "Lớp Freelance";
    if (session.class && session.class.teachers.length > 0) {
      salary = session.class.teachers[0].salaryPerSession;
      className = session.class.name;
    }
    return {
      id: session.id,
      date: session.date,
      startTime: session.startTime,
      endTime: session.endTime,
      className,
      salaryPerSession: salary
    };
  });

  // 2. Lấy danh sách phí phòng CHƯA THANH TOÁN TRONG THÁNG
  const roomRentalLogs = await prisma.roomRentalLog.findMany({
    where: { 
      teacherId, 
      status: "PENDING",
      classSession: { date: { gte: startDate, lte: endDate } }
    },
    include: {
      classSession: {
        include: { room: true }
      }
    },
    orderBy: { classSession: { date: 'asc' } }
  });

  const roomRentals = roomRentalLogs.map(log => {
    const durationHours = (new Date(log.classSession.endTime).getTime() - new Date(log.classSession.startTime).getTime()) / (1000 * 60 * 60);
    return {
      id: log.id,
      date: log.classSession.date,
      startTime: log.classSession.startTime,
      endTime: log.classSession.endTime,
      roomName: log.classSession.room?.name || "Phòng ảo",
      durationHours,
      feeCalculated: log.feeCalculated,
      unitPrice: log.feeCalculated / durationHours
    };
  });

  return { teachingSessions, roomRentals };
}
