const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const latestPayments = await prisma.paymentHistory.findMany({
    orderBy: { createdAt: 'desc' },
    take: 1
  });
  console.log("Latest Payments:", JSON.stringify(latestPayments, null, 2));

  if (latestPayments.length > 0) {
    const student = await prisma.student.findUnique({
      where: { id: latestPayments[0].studentId },
      include: { enrollments: { include: { class: true } } }
    });
    console.log("Student Enrollments:");
    student.enrollments.forEach(e => {
        console.log(`- Class: ${e.class.name}, remaining: ${e.remainingSessions}, feeStatus: ${e.feeStatus}, currentVoucher: ${e.currentVoucher}`);
    });
  }
}
main().catch(console.error).finally(() => prisma.$disconnect());
