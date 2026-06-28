const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient({ log: ['query'] });

async function main() {
  const invoices = await prisma.invoice.findMany({
    where: {
      status: "PENDING"
    },
    include: { student: true }
  });
  console.log("Pending Invoices:", JSON.stringify(invoices, null, 2));
}
main().catch(console.error).finally(() => prisma.$disconnect());
