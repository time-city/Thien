import { prisma } from "./src/lib/prisma";

async function main() {
  console.log("Creating 100 test students with debts from 10k to 1,000k...");
  for (let i = 1; i <= 100; i++) {
    const amount = i * 10000;
    const student = await prisma.student.create({
      data: {
        fullName: `Test Nợ ${i}`,
        phoneParent: "0903536212",
        invoices: {
          create: {
            expectedAmount: amount,
            amountPaid: 0,
            status: "UNDERPAID",
            isDebt: true,
          }
        }
      }
    });
    const suffix = student.id.slice(-3).toUpperCase();
    process.stdout.write(`[${i}/100] ${student.fullName} | HT0903536212${suffix} | ${amount.toLocaleString('vi-VN')}đ\n`);
  }
  console.log("\nDone! 100 students created.");
}

main().catch(console.error).finally(() => prisma.$disconnect());
