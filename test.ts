import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const s = await prisma.student.findFirst({ where: { fullName: 'Trần Thị B' }});
  if (!s) return console.log('Not found');
  const invs = await prisma.invoice.findMany({ where: { studentId: s.id } });
  console.table(invs.map(i => ({ id: i.id, expected: i.expectedAmount, paid: i.amountPaid, status: i.status, isDebt: i.isDebt })));
}
main().catch(console.error).finally(() => prisma.$disconnect());
