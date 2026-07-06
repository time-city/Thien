import { prisma } from "./src/lib/prisma";

async function testQuery() {
  const userId = "f812031e-be26-46e8-8997-81275b638bea"; // Quản Trị Viên (Teacher B)
  
  // We mock "today" to be the date of a session, e.g., 2027-04-16T00:00:00.000Z
  const today = new Date("2027-04-16T00:00:00.000Z");
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

  console.log("Teacher B sessions found:", sessions.length);
  sessions.forEach(s => {
    console.log(`- Session ${s.id} for Class ${s.class?.name}`);
  });
}

testQuery()
  .then(() => process.exit(0))
  .catch(e => { console.error(e); process.exit(1); });
