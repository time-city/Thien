const crypto = require('crypto');

// --- CẤU HÌNH ---
// URL của webhook (thay bằng URL vercel nếu muốn test trên mạng)
const WEBHOOK_URL = 'https://thien-three.vercel.app/api/sepay/webhook';
// Secret key của bạn (COPY TỪ FILE .env VÀO ĐÂY)
const SECRET_KEY = 'whsec_isxY69ps1U0M7m0mlMWDR7srSLZsg1kk';

// Danh sách mã thanh toán (cú pháp HT + SĐT) của 4 học sinh test
const IDENTIFIERS = [
  'HT0905420058'
];

async function sendWebhook(identifier) {
  // --- DỮ LIỆU GIẢ LẬP ---
  const payload = {
    gateway: "MBBank",
    transactionDate: new Date().toISOString().replace('T', ' ').substring(0, 19),
    accountNumber: "0700107189999",
    subAccount: null,
    code: `${identifier}`,
    content: `${identifier}`, // Cú pháp mà Server đang quét
    transferType: "in",
    description: `BankAPINotify ${identifier}`,
    transferAmount: 20000,
    referenceCode: `FT${Date.now()}${Math.floor(Math.random() * 1000)}`, // Tạo mã ngẫu nhiên để không bị báo trùng
    accumulated: 0,
    id: Math.floor(Math.random() * 10000000)
  };

  const rawBody = JSON.stringify(payload);
  const timestamp = Math.floor(Date.now() / 1000).toString();

  // --- TẠO CHỮ KÝ ---
  const expectedSignature = "sha256=" + crypto.createHmac("sha256", SECRET_KEY)
    .update(`${timestamp}.${rawBody}`)
    .digest("hex");

  console.log(`🚀 Đang gửi Webhook giả lập tới: ${WEBHOOK_URL} cho mã ${identifier}`);

  // --- GỬI REQUEST ---
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
    console.log(`✅ Phản hồi từ Server cho ${identifier}:`, res.status, data);
  } catch (err) {
    console.error(`❌ Lỗi khi gửi ${identifier}:`, err);
  }
}

async function run() {
  console.log("Bắt đầu gửi đồng loạt 4 giao dịch...");
  // Dùng Promise.all để gửi CÙNG LÚC (Concurrent)
  await Promise.all(IDENTIFIERS.map(id => sendWebhook(id)));
  console.log("Hoàn tất gửi lệnh test!");
}

run();
