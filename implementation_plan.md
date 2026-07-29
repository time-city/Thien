# Kế Hoạch Xóa Bỏ Hoàn Toàn Các Logic "Nợ" (Debt)

Mục tiêu: Dọn dẹp hoàn toàn các trường dữ liệu và logic liên quan đến việc "tính nợ" khỏi hệ thống, chấm dứt hoàn toàn khái niệm nợ học phí.

## Giải đáp thắc mắc: Xóa nợ đi thì có ảnh hưởng Source đang deploy không?

**CÓ, CHẮC CHẮN SẼ BỊ ẢNH HƯỞNG (CRASH WEB NẾU LÀM SAI BƯỚC).**

**Lý do:** 
- Bản code đang chạy trên server (bản deploy cũ) vẫn đang chứa các dòng code gọi đến biến `isDebt` và trạng thái `UNDERPAID`.
- Nếu bây giờ chúng ta chạy lệnh xóa cột `isDebt` hoặc xóa trạng thái `UNDERPAID` khỏi Database ngay lập tức, bản web cũ trên server sẽ không tìm thấy các cột này -> **Gây ra lỗi 500 (Crash toàn bộ chức năng thanh toán và xem học phí).**

**Cách xử lý an toàn nhất:**
- Chúng ta sẽ dọn dẹp code và Database ở bản cập nhật này (bản Local).
- Sau khi code xong và test kỹ, bạn **bắt buộc phải đem toàn bộ bộ code mới này deploy đè lên server cùng một lúc** thì hệ thống mới chạy mượt mà được. (Cập nhật Code và Cập nhật Database phải diễn ra song song).

## Open Questions (Cần bạn xác nhận trước khi làm)

> [!CAUTION]
> Bạn nói *"xoá lun cái bảng nợ"*, nhưng thực tế trong Database không có "Bảng Nợ" nào cả. Khoản nợ cũ được quản lý chung trong bảng `Invoice` (Hóa đơn) thông qua cột `isDebt` và trạng thái `UNDERPAID`.
> 
> Tuy nhiên, ở phiên làm việc vừa rồi, mình đã tạo ra **Bảng Ngoại Lệ (`TuitionException`)** để ghi log (đóng thiếu/dư) cho Admin tự xử lý như yêu cầu ban đầu của bạn. 
> 
> **Câu hỏi 1:** Bạn có muốn xóa luôn bảng **Ngoại Lệ (`TuitionException`)** này không? (Tức là khi phụ huynh đóng thiếu, hệ thống mặc kệ luôn, cộng đủ buổi và không thèm ghi log lại báo cho Admin nữa?)
> 
> **Câu hỏi 2:** Mình sẽ tiến hành xóa bỏ các tàn dư của logic cũ bao gồm: Cột `isDebt` trong bảng Hóa đơn, trạng thái `UNDERPAID` trong Database. Bạn đồng ý chứ?

## Proposed Changes (Các thay đổi dự kiến)

### Database (`prisma/schema.prisma`)
- [DELETE] Xóa trường `isDebt` khỏi model `Invoice`.
- [MODIFY] Xóa trạng thái `UNDERPAID` khỏi enum `InvoiceStatus`.
- *(Chờ xác nhận)* [DELETE] Xóa model `TuitionException` nếu bạn không cần ghi log đóng thiếu/dư nữa.

### Code Backend & Frontend
- [MODIFY] `src/actions/invoice.ts`: Xóa hoàn toàn các đoạn code xử lý `UNDERPAID` hay `isDebt`.
- [MODIFY] `src/app/admin/tuition/TuitionClient.tsx`: Xóa triệt để các biến giao diện liên quan đến Nợ Cũ, Hóa Đơn Nợ, v.v.

---
**Vui lòng trả lời 2 câu hỏi ở trên để mình tiến hành dọn dẹp Database nhé!**
