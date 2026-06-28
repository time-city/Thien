const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const invoices = await prisma.invoice.findMany({ take: 5, include: { enrollment: { include: { class: true } } }, orderBy: { createdAt: "desc" } });
  console.log("INVOICES:", JSON.stringify(invoices, null, 2));
  const histories = await prisma.paymentHistory.findMany({ take: 5, include: { class: true }, orderBy: { createdAt: "desc" } });
  console.log("HISTORIES:", JSON.stringify(histories, null, 2));
}

main().catch(e => console.error(e)).finally(() => prisma.$disconnect());
