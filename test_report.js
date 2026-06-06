const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
  const student = await prisma.student.findFirst({
    where: { fullName: "Trần Thị B" }
  });
  console.log("Student ID:", student.id);

  const pendingInvoices = await prisma.invoice.findMany({
    where: { studentId: student.id, status: { in: ["PENDING", "UNDERPAID"] } },
  });
  console.log("Pending Invoices:", pendingInvoices);
}
run();
