# Hoàn thành: Tái cấu trúc Logic Học phí & Xử lý Ngoại lệ

Toàn bộ các logic tự động đòi nợ, báo nợ 0đ, cộng nợ rác đã được tháo gỡ hoàn toàn. Hệ thống đã được nâng cấp với một tab Quản lý ngoại lệ riêng biệt.

## 1. Database
- Đã thêm bảng `TuitionException` để lưu trữ riêng các khoản Đóng thừa (OVERPAID) và Đóng thiếu (UNDERPAID) của phụ huynh.
- Đã đồng bộ (`db push`) lên Database thành công.

## 2. Logic Xử lý Thanh toán (`invoice.ts`)
- Hàm `processStudentPayment` đã được viết lại 100%:
  - Khi nhận tiền, tự tìm tất cả Hóa đơn `PENDING` (lớp hết buổi).
  - Tự động khóa thành công (`PAID`) **toàn bộ** hóa đơn đang báo thu tiền.
  - Cộng đủ số buổi học (ví dụ +12 buổi) cho toàn bộ các lớp đó.
  - Phân bổ số tiền thừa/thiếu vào bảng `TuitionException`.
  - Nhờ khóa Hóa đơn thành `PAID` nên học sinh sẽ ngay lập tức **không còn bị liệt vào diện "Nợ"** (dù thực tế chuyển khoản thiếu vài chục nghìn).
- Loại bỏ hoàn toàn status `UNDERPAID` lắt léo cũ. Hóa đơn cũ đang `UNDERPAID` sẽ được coi như `PENDING` để xử lý.

## 3. Cron Job Nhắc Học phí (`route.ts`)
- Cấu hình lại để Cron **tuyệt đối không** đòi nợ phụ huynh có đóng thiếu.
- Cron chỉ tiếp tục gửi thông báo cho những học sinh đang có hóa đơn `PENDING` (chưa chuyển khoản đồng nào).

## 4. Fix lỗi 0đ khi Gửi Zalo (UI)
- Đã sửa lỗi ở 2 tính năng: **Gửi Báo cáo đơn lẻ** (`CourseReportModal.tsx`) và **Gửi Báo cáo hàng loạt** (`TuitionClient.tsx`).
- Hệ thống sẽ check: Nếu `Số tiền yêu cầu <= 0`, Bot sẽ **chỉ gửi** thông tin Báo cáo học tập. Chữ "Thanh toán học phí" và Mã QR ngân hàng sẽ tự động bị giấu đi, giúp phụ huynh không bị bối rối.

## 5. UI: Tab Quản lý Ngoại lệ
- Đã tạo riêng một Trang `Ngoại lệ Học phí` ở góc trái menu `Sidebar`.
- Tại đây, Admin sẽ thấy danh sách những phụ huynh đóng tiền ẩu (Đóng Dư / Đóng Thiếu), số điện thoại và số tiền cụ thể để Admin gọi ra nhắc nhỏ.
- Có nút **"Đánh dấu Đã xử lý"** (màu xanh lá) để cất đi sau khi đòi được tiền bù.

## ✅ Verification
- Khởi chạy test bằng Typescript Compiler: **Lỗi Typescript = 0**
- Chạy Production Build (`npm run build`): **Build thành công xuất sắc 100%**, có thể đem lên môi trường Deploy.
