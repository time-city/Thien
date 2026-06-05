const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const latestPayments = await prisma.paymentHistory.findMany({
    orderBy: { createdAt: 'desc' },
    take: 3
  });
  console.log("Latest Payments:", latestPayments);

  if (latestPayments.length > 0) {
    const student = await prisma.student.findUnique({
      where: { id: latestPayments[0].studentId },
      include: { enrollments: true }
    });
    console.log("Student Enrollments:", student.enrollments);
  }
}
main().catch(console.error).finally(() => prisma.$disconnect());
