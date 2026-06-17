// test-zalo.js
// Hướng dẫn: Mở terminal và chạy lệnh: node test-zalo.js

const targetPhone = "0905420058"; // <--- BẠN HÃY SỬA LẠI THÀNH SỐ ĐIỆN THOẠI CỦA BẠN

const testMessage = `**NHẮC BÁO HỌC PHÍ**
Nông trại Khoa học tự nhiên **CHƯA NHẬN** học phí học sinh: **Hà test**
Lớp: **test 2**

_Phụ huynh đã nộp nhưng hệ thống chưa cập nhật, vui lòng nhắn tin xác nhận để được kiểm tra lại tình trạng học phí._`;

const apiKey = process.env.NEXT_PUBLIC_ZALO_BOT_API_KEY || "";

async function sendTestZalo() {
  console.log(`Đang gửi tin nhắn test tới số: ${targetPhone}...`);

  try {
    const response = await fetch("http://116.118.9.61:8080/send", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey
      },
      body: JSON.stringify({
        target: targetPhone,
        message: testMessage
      })
    });

    const result = await response.text();

    if (response.ok) {
      console.log("✅ Đã gửi thành công! Hãy mở điện thoại kiểm tra Zalo nhé.");
      console.log("Response:", result);
    } else {
      console.log("❌ Gửi thất bại:");
      console.log("Status:", response.status);
      console.log("Lý do:", result);
    }
  } catch (error) {
    console.error("❌ Lỗi kết nối tới Bot Zalo:", error.message);
  }
}

sendTestZalo();
