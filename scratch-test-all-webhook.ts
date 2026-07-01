import { prisma } from "./src/lib/prisma";
import crypto from "crypto";

const WEBHOOK_URL = 'http://localhost:3000/api/sepay/webhook';

async function main() {
  const SECRET_KEY = process.env.SEPAY_WEBHOOK_SECRET || 'whsec_isxY69ps1U0M7m0mlMWDR7srSLZsg1kk';

  const students = await prisma.student.findMany({
    where: { fullName: { startsWith: "Test Nợ" } },
    include: { invoices: { where: { status: { in: ["PENDING", "UNDERPAID"] } } } },
    orderBy: { fullName: "asc" }
  });

  console.log(`Found ${students.length} test students to test webhook.`);

  let ok = 0;
  let fail = 0;

  for (const s of students) {
    if (s.invoices.length === 0) continue;

    const phone = s.phoneParent?.replace(/\s+/g, '') || '';
    const suffix = s.id.slice(-3).toUpperCase();
    const code = phone ? `HT${phone}${suffix}` : `HT${s.id}`;
    const amount = s.invoices.reduce((sum, inv) => sum + (inv.expectedAmount - inv.amountPaid), 0);

    const payload = {
      gateway: "MBBank",
      transactionDate: new Date().toISOString().replace('T', ' ').substring(0, 19),
      accountNumber: "0700107189999",
      subAccount: null,
      code: code,
      content: `${code}`,
      transferType: "in",
      description: `BankAPINotify ${code}`,
      transferAmount: amount,
      referenceCode: `FT${Date.now()}${Math.floor(Math.random() * 9999)}`,
      accumulated: 0,
      id: Math.floor(Math.random() * 99999999)
    };

    const rawBody = JSON.stringify(payload);
    const timestamp = Math.floor(Date.now() / 1000).toString();

    const expectedSignature = "sha256=" + crypto.createHmac("sha256", SECRET_KEY)
      .update(`${timestamp}.${rawBody}`)
      .digest("hex");

    try {
      const res = await fetch(WEBHOOK_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-sepay-signature': expectedSignature,
          'x-sepay-timestamp': timestamp
        },
        body: rawBody
      });
      const data = await res.json();
      const success = (res.status === 200 && data.success && !data.reason);
      const icon = success ? '✅' : (data.reason === 'Already processed' ? '⏭️ ' : '❌');
      
      console.log(`${icon} [${s.fullName}] ${amount.toLocaleString('vi-VN')}đ | ${code} | HTTP ${res.status} | ${JSON.stringify(data)}`);
      if (success) ok++; else fail++;
    } catch (err) {
      console.error(`❌ Lỗi kết nối cho ${s.fullName}: ${(err as Error).message}`);
      fail++;
    }

    // Delay 200ms between requests to avoid overloading the server
    await new Promise(r => setTimeout(r, 200));
  }

  console.log(`\n🏁 Hoàn tất! ✅ ${ok} thành công | ❌ ${fail} thất bại (hoặc đã xử lý trước đó)`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
