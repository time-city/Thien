import * as dotenv from "dotenv";
dotenv.config();

import { prisma } from "./src/lib/prisma";

async function main() {
  console.log("=== LIST OF ROOMS ===");
  const rooms = await prisma.room.findMany();
  console.dir(rooms);

  console.log("\n=== PENDING OR RECENTLY APPROVED SESSIONS ===");
  const sessions = await prisma.classSession.findMany({
    take: 10,
    orderBy: { date: "desc" },
    include: { room: true, roomRentalLogs: true }
  });
  console.dir(sessions);
}

main().catch(console.error).finally(() => prisma.$disconnect());
