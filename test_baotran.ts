import { prisma } from './src/lib/prisma.ts';

async function main() {
  const students = await prisma.student.findMany({
    where: { fullName: { contains: "Bảo Trân", mode: "insensitive" } },
    include: {
      enrollments: {
        include: { class: true }
      },
      invoices: true
    }
  });

  console.log(JSON.stringify(students, null, 2));
}

main()
  .catch(e => console.error(e))
  .finally(async () => {
    await prisma.$disconnect();
  });
