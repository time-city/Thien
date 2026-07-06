import { prisma } from "./src/lib/prisma";

async function testQuery() {
  const userId = "f812031e-be26-46e8-8997-81275b638bea"; // Quản Trị Viên (Teacher B)
  
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const sessions = await prisma.classSession.findMany({
    where: {
      OR: [
        { teacherId: userId },
        { class: { teachers: { some: { teacherId: userId } } } }
      ],
      date: {
        gte: today,
        lt: tomorrow
      },
      status: { not: "CANCELLED" },
      classId: { not: null }
    },
    include: { class: true, room: true },
    orderBy: { startTime: "asc" }
  });

  console.log("Teacher B sessions found for TODAY:", sessions.length);
}

testQuery().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
