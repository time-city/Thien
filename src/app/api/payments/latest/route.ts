import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const latestPayment = await prisma.paymentHistory.findFirst({
      orderBy: { createdAt: "desc" },
      select: { createdAt: true }
    });
    
    return NextResponse.json({ 
      latestAt: latestPayment ? latestPayment.createdAt.toISOString() : null 
    });
  } catch (error) {
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}
