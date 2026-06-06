const crypto = require('crypto');

// --- CẤU HÌNH ---
// URL của webhook (thay bằng URL vercel nếu muốn test trên mạng)
const WEBHOOK_URL = 'http://192.168.110.215:3000/api/sepay/webhook';
// Thay bằng ID của HÓA ĐƠN (Invoice ID) đang ở trạng thái PENDING để test (36 ký tự)
// Hoặc điền Mã Enrollment / SĐT cũ vào đây để test chức năng dự phòng (Fallback)
const IDENTIFIER = 'HT1a700a6b-d375-467f-8735-670341872ff6';
// Secret key của bạn (COPY TỪ FILE .env VÀO ĐÂY)
const SECRET_KEY = 'whsec_isxY69ps1U0M7m0mlMWDR7srSLZsg1kk';

// --- DỮ LIỆU GIẢ LẬP ---
const payload = {
  gateway: "MBBank",
  transactionDate: "2026-06-05 13:04:00",
  accountNumber: "0700107189999",
  subAccount: null,
  code: `${IDENTIFIER}`,
  content: `${IDENTIFIER}`, // Cú pháp mà Server đang quét
  transferType: "in",
  description: `BankAPINotify ${IDENTIFIER}`,
  transferAmount: 2800000,
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
