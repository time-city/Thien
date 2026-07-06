import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  try {
    const c = await prisma.class.findFirst({
      where: { name: "Hóa 9 NTĐ" },
      include: { sessions: { orderBy: { date: 'desc' } } }
    });
    
    // Original broken logic
    const todayLocal = new Date();
    todayLocal.setHours(0, 0, 0, 0);
    const tomorrowLocal = new Date(todayLocal);
    tomorrowLocal.setDate(tomorrowLocal.getDate() + 1);

    const qsLocal = await prisma.classSession.findMany({
      where: {
        date: { gte: todayLocal, lt: tomorrowLocal },
        classId: c?.id
      }
    });

    // New fixed logic using local date string format for Prisma
    // If the server is in Vietnam (GMT+7), we want the string '2026-07-06'
    // A safe way is to construct a Date object that has UTC date = 2026-07-06.
    const now = new Date();
    // Get the local YYYY, MM, DD
    const yyyy = now.getFullYear();
    const mm = now.getMonth();
    const dd = now.getDate();
    
    // Create a Date object where the UTC date IS the local date
    const todayUTC = new Date(Date.UTC(yyyy, mm, dd, 0, 0, 0, 0));
    const tomorrowUTC = new Date(Date.UTC(yyyy, mm, dd + 1, 0, 0, 0, 0));

    const qsFixed = await prisma.classSession.findMany({
      where: {
        date: { gte: todayUTC, lt: tomorrowUTC },
        classId: c?.id
      }
    });

    return NextResponse.json({
      local: { today: todayLocal.toISOString(), qs: qsLocal.length },
      fixed: { today: todayUTC.toISOString(), qs: qsFixed.length }
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
