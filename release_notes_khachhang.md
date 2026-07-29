# 🚀 BẢN CẬP NHẬT HỆ THỐNG QUẢN LÝ HỌC PHÍ & ZALO BOT


### 1. Xử Lý Triệt Để Vấn Đề "Nhắc Nợ" Gây Khó Chịu Cho Phụ Huynh
- **Cộng đủ buổi ngay lập tức:** Khi phụ huynh thanh toán, dù vô tình chuyển thiếu một khoản tiền nhỏ (do phí chuyển khoản, nhầm lẫn,...), hệ thống vẫn sẽ lập tức **cộng đủ số buổi học** cho học sinh và **đóng hóa đơn**. 
- **Không tự động đòi nợ:** Xóa bỏ hoàn toàn câu nhắc nợ trong tin nhắn Zalo xác nhận thanh toán. Phụ huynh sẽ chỉ nhận được tin nhắn cảm ơn và thông báo số buổi đã được gia hạn thành công.

### 2. Ra Mắt Tính Năng "Quản Lý Ngoại Lệ Học Phí" (Dành cho Kế toán/Admin)
- Thêm mới một Tab chức năng **Ngoại lệ Học phí** trên menu quản trị (dành riêng cho nội bộ trung tâm).
- Thay vì spam đòi nợ tự động, mọi khoản tiền **Đóng Thiếu** hoặc **Đóng Dư** của phụ huynh sẽ được hệ thống âm thầm lưu vào danh sách Ngoại lệ này.
- Kế toán / Admin có thể theo dõi sát sao danh sách này để chủ động gọi điện hoặc nhắn tin riêng cho phụ huynh để thu hồi/hoàn trả, mang lại sự tinh tế và chuyên nghiệp trong giao tiếp. (Có nút check "Đã xử lý" để gạch sổ sau khi xong).

### 3. Zalo Bot Thông Minh & Tinh Tế Hơn
- **Chặn Mã QR 0 đồng:** Khi Admin gửi Báo cáo học tập định kỳ, nếu học sinh không nợ học phí (hoặc số tiền cần thu = 0), Bot sẽ tự động **cắt bỏ Mã QR thanh toán** và ẩn đi các câu từ liên quan đến tiền bạc.
- **Tinh chỉnh từ ngữ:** Thay đổi các thuật ngữ nhạy cảm trên phần mềm từ *"Nhắc nợ", "Nợ cũ"* thành *"Nhắc học phí", "Hóa đơn kỳ trước"*, giúp giao diện thân thiện hơn với môi trường giáo dục.

### 4. Tối Ưu Hệ Thống Nhắc Học Phí Tự Động (Cronjob 9h sáng)
- Hệ thống gửi tin nhắn nhắc đóng tiền tự động hàng ngày giờ đây đã được tinh chỉnh bộ lọc thông minh hơn.
- **Chỉ gửi tin nhắn nhắc đóng kỳ mới** cho những học sinh đã **cạn sạch phiếu học (còn đúng 0 buổi)**.
- Chặn hoàn toàn việc tự động đòi tiền đối với các học sinh đóng thiếu (vì những ca này đã được chuyển về cho Admin xử lý thủ công ở mục 2).

### 5. Nâng Cấp Hiệu Suất Hệ Thống (Chống lỗi click đúp)
- Áp dụng cơ chế khóa dữ liệu cấp cao (Row-level Locking) vào Database khi thanh toán.
- Ngăn chặn hoàn toàn lỗi hệ thống cộng nhầm tiền hoặc nhân đôi số buổi học nếu nhân viên quản lý vô tình "click đúp" (ấn 2 lần liên tiếp) vào nút Xác nhận thu tiền.

---
*Hệ thống đã được kiểm tra kỹ lưỡng (Passed 100%) và sẵn sàng mang lại một luồng vận hành mượt mà, chuyên nghiệp nhất cho trung tâm!*
