"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

export async function settleTeacherBalance(
  teacherId: string, 
  amount: number, 
  type: "PAYOUT_SALARY" | "COLLECT_RENTAL", 
  note?: string
) {
  try {
    if (amount <= 0) {
      return { success: false, message: "Số tiền giao dịch phải lớn hơn 0" };
    }

    await prisma.$transaction(async (tx) => {
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
            note: note || "Thanh toán lương"
          }
        });

        // Đánh dấu các ca dạy đã thanh toán
        await tx.classSession.updateMany({
          where: {
            teacherId,
            status: "COMPLETED",
            isPaid: false
          },
          data: {
            isPaid: true
          }
        });

      } else if (type === "COLLECT_RENTAL") {
        // Thu nợ tiền phòng từ GV Freelance
        await tx.user.update({
          where: { id: teacherId },
          data: { salaryBalance: { increment: amount } } // Kéo số dư âm về 0
        });

        // Đánh dấu các khoản phí phòng là đã thu
        await tx.roomRentalLog.updateMany({
          where: {
            teacherId,
            status: "PENDING"
          },
          data: {
            status: "PAID"
          }
        });
      }
    });

    revalidatePath("/admin/teachers");
    revalidatePath("/admin/payroll");
    return { success: true };
  } catch (error: any) {
    console.error("settleTeacherBalance error:", error);
    return { success: false, message: error.message };
  }
}
