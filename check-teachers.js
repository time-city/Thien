const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const classes = await prisma.class.findMany({
    include: {
      teachers: {
        include: { teacher: true }
      }
    }
  });

  console.log("Total classes:", classes.length);
  for (const c of classes) {
    if (c.teachers.length > 1) {
      console.log(`Class ID: ${c.id}, Name: ${c.name}`);
      console.log(`Teachers: ${c.teachers.map(t => t.teacher.fullName).join(", ")}`);
    }
  }
}

main()
  .catch(e => console.error(e))
  .finally(async () => {
    await prisma.$disconnect();
  });
