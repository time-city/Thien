require("dotenv").config({ path: ".env" });
const { PrismaClient } = require('@prisma/client');
const { Pool } = require("pg");
const { PrismaPg } = require("@prisma/adapter-pg");

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  const invoices = await prisma.invoice.findMany({
    where: {
      status: "PENDING",
      createdAt: {
        gte: new Date("2024-06-01T00:00:00Z"),
        lt: new Date("2024-07-01T00:00:00Z")
      }
    },
    include: { student: true }
  });
  console.log("Pending June 2024 Invoices:", JSON.stringify(invoices, null, 2));

  const allInvoices = await prisma.invoice.findMany({
    include: { student: true }
  });
  console.log("Total Invoices:", allInvoices.length);
  const pendingInvoices = await prisma.invoice.findMany({
    where: { status: "PENDING" },
    include: { student: true }
  });
  console.log("Total PENDING Invoices:", pendingInvoices.length);
  if (pendingInvoices.length > 0) {
    console.log("First pending invoice:", JSON.stringify(pendingInvoices[0], null, 2));
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
