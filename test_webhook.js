const crypto = require('crypto');

// --- CẤU HÌNH ---
const WEBHOOK_URL = 'http://localhost:3000/api/sepay/webhook';
const SECRET_KEY = 'whsec_isxY69ps1U0M7m0mlMWDR7srSLZsg1kk';

// Danh sách đầy đủ 60 học sinh test (lấy từ DB)
// Chú ý: Học sinh 1 và 2 đã bị gạch nợ khi test, amount = 0 sẽ bị bỏ qua tự động
const TEST_CASES = [
  { code: 'HT0903536212B7F', amount: 10000, name: 'Học sinh Test Nợ 1' },
  { code: 'HT090353621283D', amount: 200000, name: 'Học sinh Test Nợ 2' },
  { code: 'HT0903536212333', amount: 300000, name: 'Học sinh Test Nợ 3' },
  { code: 'HT0903536212ABA', amount: 400000, name: 'Học sinh Test Nợ 4' },
  { code: 'HT0903536212874', amount: 500000, name: 'Học sinh Test Nợ 5' },
  { code: 'HT0903536212ED1', amount: 600000, name: 'Học sinh Test Nợ 6' },
  { code: 'HT09035362127E1', amount: 700000, name: 'Học sinh Test Nợ 7' },
  { code: 'HT0903536212E97', amount: 800000, name: 'Học sinh Test Nợ 8' },
  { code: 'HT09035362123D4', amount: 900000, name: 'Học sinh Test Nợ 9' },
  { code: 'HT0903536212F08', amount: 1000000, name: 'Học sinh Test Nợ 10' },
  { code: 'HT09035362123CC', amount: 1100000, name: 'Học sinh Test Nợ 11' },
  { code: 'HT09035362122D4', amount: 1200000, name: 'Học sinh Test Nợ 12' },
  { code: 'HT0903536212E91', amount: 1300000, name: 'Học sinh Test Nợ 13' },
  { code: 'HT0903536212A02', amount: 1400000, name: 'Học sinh Test Nợ 14' },
  { code: 'HT090353621232E', amount: 1500000, name: 'Học sinh Test Nợ 15' },
  { code: 'HT09035362126D8', amount: 1600000, name: 'Học sinh Test Nợ 16' },
  { code: 'HT0903536212E58', amount: 1700000, name: 'Học sinh Test Nợ 17' },
  { code: 'HT0903536212D22', amount: 1800000, name: 'Học sinh Test Nợ 18' },
  { code: 'HT0903536212270', amount: 1900000, name: 'Học sinh Test Nợ 19' },
  { code: 'HT0903536212CEC', amount: 2000000, name: 'Học sinh Test Nợ 20' },
  { code: 'HT0903536212BBF', amount: 2100000, name: 'Học sinh Test Nợ 21' },
  { code: 'HT09035362127F6', amount: 2200000, name: 'Học sinh Test Nợ 22' },
  { code: 'HT09035362124C9', amount: 2300000, name: 'Học sinh Test Nợ 23' },
  { code: 'HT09035362127CF', amount: 2400000, name: 'Học sinh Test Nợ 24' },
  { code: 'HT0903536212ED4', amount: 2500000, name: 'Học sinh Test Nợ 25' },
  { code: 'HT0903536212916', amount: 2600000, name: 'Học sinh Test Nợ 26' },
  { code: 'HT09035362122BE', amount: 2700000, name: 'Học sinh Test Nợ 27' },
  { code: 'HT0903536212FCD', amount: 2800000, name: 'Học sinh Test Nợ 28' },
  { code: 'HT0903536212038', amount: 2900000, name: 'Học sinh Test Nợ 29' },
  { code: 'HT09035362122D0', amount: 3000000, name: 'Học sinh Test Nợ 30' },
  { code: 'HT0903536212BD1', amount: 3100000, name: 'Học sinh Test Nợ 31' },
  { code: 'HT0903536212970', amount: 3200000, name: 'Học sinh Test Nợ 32' },
  { code: 'HT0903536212E30', amount: 3300000, name: 'Học sinh Test Nợ 33' },
  { code: 'HT09035362129C1', amount: 3400000, name: 'Học sinh Test Nợ 34' },
  { code: 'HT09035362126E4', amount: 3500000, name: 'Học sinh Test Nợ 35' },
  { code: 'HT09035362123BF', amount: 3600000, name: 'Học sinh Test Nợ 36' },
  { code: 'HT090353621299F', amount: 3700000, name: 'Học sinh Test Nợ 37' },
  { code: 'HT0903536212068', amount: 3800000, name: 'Học sinh Test Nợ 38' },
  { code: 'HT0903536212589', amount: 3900000, name: 'Học sinh Test Nợ 39' },
  { code: 'HT09035362124CA', amount: 4000000, name: 'Học sinh Test Nợ 40' },
  { code: 'HT0903536212DB0', amount: 4100000, name: 'Học sinh Test Nợ 41' },
  { code: 'HT0903536212EBB', amount: 4200000, name: 'Học sinh Test Nợ 42' },
  { code: 'HT0903536212633', amount: 4300000, name: 'Học sinh Test Nợ 43' },
  { code: 'HT0903536212281', amount: 4400000, name: 'Học sinh Test Nợ 44' },
  { code: 'HT09035362128C9', amount: 4500000, name: 'Học sinh Test Nợ 45' },
  { code: 'HT090353621229D', amount: 4600000, name: 'Học sinh Test Nợ 46' },
  { code: 'HT0903536212477', amount: 4700000, name: 'Học sinh Test Nợ 47' },
  { code: 'HT0903536212441', amount: 4800000, name: 'Học sinh Test Nợ 48' },
  { code: 'HT09035362125A0', amount: 4900000, name: 'Học sinh Test Nợ 49' },
  { code: 'HT0903536212BF2', amount: 5000000, name: 'Học sinh Test Nợ 50' },
  { code: 'HT09035362120AB', amount: 5100000, name: 'Học sinh Test Nợ 51' },
  { code: 'HT09035362127AF', amount: 5200000, name: 'Học sinh Test Nợ 52' },
  { code: 'HT0903536212C57', amount: 5300000, name: 'Học sinh Test Nợ 53' },
  { code: 'HT090353621258D', amount: 5400000, name: 'Học sinh Test Nợ 54' },
  { code: 'HT0903536212A37', amount: 5500000, name: 'Học sinh Test Nợ 55' },
  { code: 'HT0903536212A2D', amount: 5600000, name: 'Học sinh Test Nợ 56' },
  { code: 'HT0903536212912', amount: 5700000, name: 'Học sinh Test Nợ 57' },
  { code: 'HT0903536212FB0', amount: 5800000, name: 'Học sinh Test Nợ 58' },
  { code: 'HT090353621218C', amount: 5900000, name: 'Học sinh Test Nợ 59' },
  { code: 'HT09035362126FD', amount: 6000000, name: 'Học sinh Test Nợ 60' },
];

async function sendWebhook({ code, amount, name }) {
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

  console.log(`🚀 [${name}] ${amount.toLocaleString('vi-VN')}đ | ${code}`);

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
    const icon = (res.status === 200 && data.success && !data.reason) ? '✅' : (data.reason === 'Already processed' ? '⏭️ ' : '❌');
    console.log(`${icon} HTTP ${res.status} | ${JSON.stringify(data)}`);
    return data.success;
  } catch (err) {
    console.error(`❌ Lỗi kết nối: ${err.message}`);
    return false;
  }
}

async function run() {
  const args = process.argv.slice(2);
  const mode = args[0];

  let cases = TEST_CASES;

  if (!mode || mode === 'all') {
    console.log(`📦 Gửi tuần tự ${cases.length} giao dịch (tất cả học sinh test)...\n`);
  } else {
    // Gửi theo index (0-based) hoặc tên học sinh
    const idx = parseInt(mode);
    if (!isNaN(idx)) {
      cases = [TEST_CASES[Math.min(idx, TEST_CASES.length - 1)]];
    } else {
      cases = TEST_CASES.filter(c => c.name.includes(mode));
    }
    console.log(`📦 Gửi ${cases.length} giao dịch...\n`);
  }

  let ok = 0, fail = 0;
  for (const tc of cases) {
    const success = await sendWebhook(tc);
    if (success) ok++; else fail++;
    if (cases.length > 1) await new Promise(r => setTimeout(r, 300)); // delay 300ms giữa các giao dịch
  }

  console.log(`\n🏁 Hoàn tất! ✅ ${ok} thành công | ❌ ${fail} thất bại`);
}

run();
