import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function main() {
  const teachers = await prisma.user.findMany({ where: { role: "TEACHER" } });
  
  for (const t of teachers) {
    if (t.salaryBalance >= 0) {
      // Dư nợ phòng đã được trả, đánh dấu PAID cho tất cả phí phòng PENDING
      await prisma.roomRentalLog.updateMany({
        where: { teacherId: t.id, status: "PENDING" },
        data: { status: "PAID" }
      });
    }

    if (t.salaryBalance <= 0) {
      // Đã thanh toán lương, đánh dấu PAID cho tất cả class session
      await prisma.classSession.updateMany({
        where: { teacherId: t.id, isPaid: false, status: "COMPLETED" },
        data: { isPaid: true }
      });
    }
  }
  
  console.log("Cleanup done.");
}

main().catch(console.error).finally(() => prisma.$disconnect());
