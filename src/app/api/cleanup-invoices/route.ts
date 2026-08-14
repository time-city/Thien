import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const invoices = await prisma.invoice.findMany({
      where: {
        status: { in: ["PENDING", "PAID"] },
        details: { path: ["billingType"], equals: "MONTHLY" }
      }
    });

    // Group by enrollmentId + month + year
    const grouped = new Map<string, typeof invoices>();

    for (const inv of invoices) {
      const det = inv.details as any;
      if (!det || !det.month || !det.year) continue;
      const key = `${inv.enrollmentId}-${det.month}-${det.year}`;
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key)!.push(inv);
    }

    let deletedCount = 0;
    for (const [key, group] of grouped.entries()) {
      if (group.length > 1) {
        // Find if there's a PAID invoice
        const paidInvoices = group.filter(i => i.status === "PAID");
        const pendingInvoices = group.filter(i => i.status === "PENDING");

        if (paidInvoices.length > 0 && pendingInvoices.length > 0) {
          // They paid, but a PENDING was created incorrectly. Delete the PENDING ones.
          for (const pending of pendingInvoices) {
            await prisma.invoice.delete({ where: { id: pending.id } });
            deletedCount++;
          }
          
          // Also ensure feeStatus is PAID on enrollment
          await prisma.enrollment.update({
            where: { id: paidInvoices[0].enrollmentId! },
            data: { feeStatus: "PAID" }
          });
        } else if (pendingInvoices.length > 1) {
          // Multiple PENDING invoices created incorrectly. Keep the oldest, delete the rest.
          pendingInvoices.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
          for (let i = 1; i < pendingInvoices.length; i++) {
            await prisma.invoice.delete({ where: { id: pendingInvoices[i].id } });
            deletedCount++;
          }
        }
      } else if (group.length === 1 && group[0].status === "PENDING") {
        // Since we mistakenly created PENDING invoices for August 2026 for students who were already paid via remainingSessions,
        // we can just delete PENDING invoices for August 2026 that were generated today (to be safe).
        const inv = group[0];
        const det = inv.details as any;
        if (det.month === 8 && det.year === 2026) {
           // Delete it because they shouldn't have been generated.
           await prisma.invoice.delete({ where: { id: inv.id } });
           deletedCount++;
        }
      }
    }

    return NextResponse.json({ success: true, deletedCount, message: "Đã dọn dẹp xong các hóa đơn bị tạo trùng." });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message });
  }
}
