const crypto = require('crypto');

// --- CẤU HÌNH ---
// URL của webhook (thay bằng URL vercel nếu muốn test trên mạng)
const WEBHOOK_URL = 'https://thien-three.vercel.app/api/sepay/webhook';
// Thay bằng số điện thoại của 1 học sinh ĐANG CÓ TRONG DATABASE để test gạch nợ
const STUDENT_PHONE = '0903696969';
// Secret key của bạn (COPY TỪ FILE .env VÀO ĐÂY)
const SECRET_KEY = 'whsec_isxY69ps1U0M7m0mlMWDR7srSLZsg1kk';

// --- DỮ LIỆU GIẢ LẬP ---
const payload = {
  gateway: "MBBank",
  transactionDate: "2026-06-05 13:04:00",
  accountNumber: "0700107189999",
  subAccount: null,
  code: `HT${STUDENT_PHONE}`,
  content: `HT${STUDENT_PHONE}`, // Cú pháp mà Server đang quét
  transferType: "in",
  description: `BankAPINotify HT${STUDENT_PHONE}`,
  transferAmount: 500000,
  referenceCode: `FT${Date.now()}`, // Tạo mã ngẫu nhiên để không bị báo trùng
  accumulated: 0,
  id: Math.floor(Math.random() * 10000000)
};

const rawBody = JSON.stringify(payload);
const timestamp = Math.floor(Date.now() / 1000).toString();

// --- TẠO CHỮ KÝ ---
const expectedSignature = "sha256=" + crypto.createHmac("sha256", SECRET_KEY)
  .update(`${timestamp}.${rawBody}`)
  .digest("hex");

console.log("🚀 Đang gửi Webhook giả lập tới:", WEBHOOK_URL);
console.log("📦 Dữ liệu:", payload);

// --- GỬI REQUEST ---
fetch(WEBHOOK_URL, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'x-sepay-signature': expectedSignature,
    'x-sepay-timestamp': timestamp
  },
  body: rawBody
})
  .then(async res => {
    const data = await res.json();
    console.log("✅ Phản hồi từ Server:", res.status, data);
  })
  .catch(err => {
    console.error("❌ Lỗi:", err);
  });
