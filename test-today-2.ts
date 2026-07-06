import { prisma } from "./src/lib/prisma";

async function run() {
  const c = await prisma.class.findFirst({ where: { name: "Hóa 9 NTĐ" }, include: { sessions: { orderBy: { date: 'desc' } } } });
  console.log("Class sessions count:", c?.sessions.length);
  const session2026 = c?.sessions.find(s => s.date.toISOString().includes("2026-07-06"));
  console.log("Session 2026:", session2026);

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  
  console.log("today:", today.toISOString());
  console.log("tomorrow:", tomorrow.toISOString());
}
run().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
