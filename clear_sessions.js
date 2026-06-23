const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function clearData() {
  console.log("Deleting old class sessions...");
  await prisma.attendanceLog.deleteMany();
  await prisma.roomRentalLog.deleteMany();
  await prisma.classSession.deleteMany();
  console.log("Done.");
}

clearData().catch(console.error).finally(() => prisma.$disconnect());
