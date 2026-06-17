// test-zalo.js
// Hướng dẫn: Mở terminal và chạy lệnh: node test-zalo.js

const targetPhone = "0905420058"; // <--- BẠN HÃY SỬA LẠI THÀNH SỐ ĐIỆN THOẠI CỦA BẠN

const msg1 = `Nông trại Khoa học tự nhiên kính gửi quý phụ huynh: **Báo cáo học tập (từ 19/6 - 28/6).**
• Học sinh: **hà**
• Lớp đang học: **test2; test**

Phụ huynh thanh toán học phí (mã QR hoặc tiền mặt):
• Số tiền: **40.000 vnđ**
• Nội dung chuyển khoản: **HT0905420058**

_Tin nhắn được thông báo tự động, phụ huynh có thể trao đổi thêm qua Zalo._`.trim();

const msg2 = `**NHẮC BÁO HỌC PHÍ**
Nông trại Khoa học tự nhiên **CHƯA NHẬN** học phí học sinh: **Hà**
Lớp: **test 2**

_Phụ huynh đã nộp nhưng hệ thống chưa cập nhật, vui lòng nhắn tin xác nhận để được kiểm tra lại tình trạng học phí._`.trim();

const msg3 = `**XÁC NHẬN THANH TOÁN HỌC PHÍ**
Nông trại Khoa học tự nhiên **ĐÃ NHẬN ĐỦ** học phí học sinh: **hà**
Phiếu thu **(16/06/2026)**
Lớp: **test và test2**
Phương thức: **Tiền mặt**

_Kính báo./._`.trim();

const apiKey = process.env.NEXT_PUBLIC_ZALO_BOT_API_KEY || "";

async function sendTestZalo() {
  console.log(`Đang gửi tin nhắn test tới số: ${targetPhone}...`);
  const msgs = [msg1, msg2, msg3];

  for (let i = 0; i < msgs.length; i++) {
    try {
      const response = await fetch("http://116.118.9.61:8080/send", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey
        },
        body: JSON.stringify({
          target: targetPhone,
          message: msgs[i]
        })
      });

      const result = await response.text();

      if (response.ok) {
        console.log(`✅ Đã gửi thành công tin nhắn thứ ${i + 1}!`);
      } else {
        console.log(`❌ Gửi thất bại tin nhắn ${i + 1}:`);
        console.log("Status:", response.status);
        console.log("Lý do:", result);
      }
    } catch (error) {
      console.error(`❌ Lỗi kết nối tới Bot Zalo ở tin nhắn ${i + 1}:`, error.message);
    }

    // Đợi 2s trước khi gửi tin nhắn tiếp theo
    if (i < msgs.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }
}

sendTestZalo();
