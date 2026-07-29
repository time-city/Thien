import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const exceptions = await prisma.tuitionException.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        student: {
          select: { fullName: true }
        }
      }
    });
    return NextResponse.json(exceptions);
  } catch (error) {
    console.error('Error fetching exceptions:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}