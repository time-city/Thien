# Sơ Đồ Hệ Thống: Vòng Đời Học Phí, SePay, & Zalo Bot

Sơ đồ dưới đây mô tả chính xác 100% logic đã được lập trình trong mã nguồn. Bao quát toàn bộ chu trình từ lúc điểm danh trừ buổi, hết buổi, cho đến khi phụ huynh thanh toán tự động qua SePay, Admin duyệt và Zalo gửi thông báo.

```mermaid
flowchart TD
    %% Định dạng CSS cho màu sắc
    classDef sys fill:#f8fafc,stroke:#94a3b8,stroke-width:1px,stroke-dasharray: 5 5;
    classDef auto fill:#e0f2fe,stroke:#0284c7,stroke-width:2px;
    classDef manual fill:#fef3c7,stroke:#d97706,stroke-width:2px;
    classDef payment fill:#dcfce7,stroke:#16a34a,stroke-width:2px;
    classDef action fill:#f1f5f9,stroke:#64748b,stroke-width:1px;
    classDef msg fill:#bfdbfe,stroke:#2563eb,stroke-width:2px;
    classDef exception fill:#fee2e2,stroke:#ef4444,stroke-width:2px;

    %% =========================================================================
    subgraph PHASE1 [1. CHU TRÌNH TRỪ BUỔI & TẠO HÓA ĐƠN CHỜ]
        direction TB
        A1[Giáo viên / Admin bấm 'Chốt Điểm Danh']:::manual
        A2[Hệ thống trừ 1 buổi học 'remainingSessions - 1']:::sys
        A3{Số buổi học còn lại?}
        
        A4[ > 0 buổi: Tiếp tục học bình thường]:::action
        A5[ <= 0 buổi: HỌC SINH HẾT PHIẾU]:::exception
        
        A6["Lần tiếp theo Admin mở 'Gửi Báo Cáo'<br>hoặc xem thông tin Học sinh"]:::sys
        A7["Hệ thống tự động sinh Hóa đơn PENDING<br>cho lớp đã hết phiếu"]:::action
        
        A1 --> A2 --> A3
        A3 -- Vẫn còn --> A4
        A3 -- Cạn buổi --> A5 --> A6 --> A7
    end

    %% =========================================================================
    subgraph PHASE2 [2. HỆ THỐNG GỬI ZALO NHẮC HỌC PHÍ]
        direction TB
        %% Admin thủ công
        B1[Admin bấm Gửi Báo Cáo học tập]:::manual
        B2[Kẹp chung QR Code & Text nhắc nợ vào báo cáo]:::msg
        B1 --> B2
        
        %% Tự động (Cronjob)
        B3[Cronjob 9h sáng hàng ngày quét Database]:::auto
        B4{"Thỏa mãn 2 điều kiện?<br>1. Còn 0 buổi học<br>2. Có Hóa đơn PENDING"}
        B5["Kiểm tra lịch sử: Đã nhắc trong 24h qua chưa?"]:::sys
        B6[Bỏ qua]:::action
        B7["Gửi Zalo Text: 'Bé đã hết phiếu học...'<br>TUYỆT ĐỐI KHÔNG GỬI ẢNH QR MÁY MÓC"]:::msg
        
        B3 --> B4
        B4 -- Không thỏa mãn --> B6
        B4 -- Thỏa mãn --> B5
        B5 -- Đã nhắc gần đây --> B6
        B5 -- Chưa nhắc --> B7
    end

    %% =========================================================================
    subgraph PHASE3 [3. QUY TRÌNH THANH TOÁN (SEPAY & ADMIN) VÀ GẠCH NỢ]
        direction TB
        C1[Phụ huynh chuyển khoản Ngân hàng]:::payment
        C2["SEPAY WEBHOOK tự động bắt giao dịch<br>Tìm học sinh qua Mã số / SĐT"]:::payment
        C3["Admin nhận tiền mặt / ck riêng<br>Bấm xác nhận trên Web"]:::manual
        
        C4["HÀM XỬ LÝ THANH TOÁN 'processStudentPayment'"]:::sys
        
        C1 --> C2 --> C4
        C3 --> C4
        
        C4 --> C5["ÉP TOÀN BỘ HÓA ĐƠN THÀNH 'PAID'<br>Dọn sạch nợ cũ ngay lập tức"]:::action
        C4 --> C6[Cộng đủ N buổi học vào Lớp tương ứng]:::action
        C4 --> C7{"Số tiền thực nhận<br>so với Báo giá?"}
        
        C7 -- Thiếu / Dư --> C8[Tạo log Ngoại lệ 'TuitionException']:::exception
        C7 -- Đủ --> C9[Kết thúc giao dịch]:::action
        C8 --> C9
        
        C9 --> C10["Gửi Zalo Xác Nhận:<br>'Đã nhận X đồng. Đã gia hạn môn Toán...'<br>TUYỆT ĐỐI KHÔNG BÁO NỢ LẠI"]:::msg
    end

    %% Móc nối các Phase
    A7 -.-> B1
    A7 -.-> B3
    B2 -.-> C1
    B7 -.-> C1
```

## Giải thích chi tiết sự thay đổi về tư duy của Hệ thống:
1. **Chia tay "Nợ"**: Trong vòng xử lý số 3, thay vì lấy số tiền Phụ huynh đóng để đối soát và đẻ ra "Nợ" (`UNDERPAID`), thì bây giờ hệ thống **Nhắm mắt ÉP hóa đơn thành PAID và Cộng đủ buổi học luôn**. 
2. **"Sổ Nam Tào" cho Admin**: Số tiền thiếu đó sẽ chạy ngầm vào bảng `TuitionException` (Góc phải dưới). Admin sẽ mở tab "Ngoại lệ" này xem để tự liên hệ phụ huynh.
3. **SePay là một người Admin chạy bằng điện**: Hệ thống xử lý hoàn toàn giống nhau bất kể tiền tới từ Webhook SePay hay Admin bấm. SePay phát hiện tiền -> Xóa nợ PENDING -> Cộng buổi -> Gửi Zalo cảm ơn -> Báo Ngoại lệ nếu thiếu.
