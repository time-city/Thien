"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

export async function markSessionCompleted(sessionId: string) {
  try {
    await prisma.$transaction(async (tx) => {
      const session = await tx.classSession.findUnique({
        where: { id: sessionId },
        include: {
          class: true,
          teacher: true,
          room: true
        }
      });

      if (!session) throw new Error("Session not found");
      if (session.status === "COMPLETED") throw new Error("Session already completed");

      if (session.classId) {
        // TRƯỜNG HỢP A: Lớp Trung Tâm (có classId)
        const classTeacher = await tx.classTeacher.findFirst({
          where: { 
            classId: session.classId,
            teacherId: session.teacherId
          }
        });

        if (!classTeacher) throw new Error("ClassTeacher relation not found");

        const salaryAmount = classTeacher.salaryPerSession;

        if (salaryAmount > 0) {
          await tx.user.update({
            where: { id: session.teacherId },
            data: { salaryBalance: { increment: salaryAmount } }
          });
        }
      }

      // Đánh dấu session COMPLETED
      await tx.classSession.update({
        where: { id: session.id },
        data: { status: "COMPLETED" }
      });
    });

    revalidatePath("/admin/sessions"); // Adjust path as necessary
    return { success: true };
  } catch (error: any) {
    console.error("markSessionCompleted error:", error);
    return { success: false, message: error.message };
  }
}
