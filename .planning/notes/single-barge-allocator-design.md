# Thiết kế Tool "Phân bổ" (Route `/split`)

## 1. Bối cảnh & Mục đích
- Trước đây, hệ thống đã tinh gọn màn hình "Dữ liệu cân hàng" (`/tools/allocator`) xuống 2 Tab để phục vụ việc đồng bộ trực tiếp 1-1 các phiếu cân thật sang Sà lan theo Mã lệnh.
- Tuy nhiên, trong thực tế vận hành có những sà lan đặc thù (tiêu biểu như `NÔNG SẢN_DE HEUS` hoặc một sà lan bất kỳ do người dùng chỉ định) cần áp dụng **logic phân bổ cũ**: tách phiếu cân vượt tải thành nhiều chuyến xe nhỏ theo định mức tải trọng xe (`limit_weight`), dàn đều/ngẫu nhiên khối lượng và thời gian ra vào hợp lý.
- Giải pháp: Xây dựng một công cụ độc lập hoàn toàn, tên **"Phân bổ"** với route ngắn **`/split`** (alias `/tools/split`).

## 2. Kiến trúc & Cấu trúc 3 Tab
- **Route:** `/split` và redirect `/tools/split -> /split`.
- **Thanh menu / Navigation:** Thêm nút truy cập "Phân bổ" trên Menu thanh công cụ.

### Tab 1 — Phiếu cân (Source Tickets)
- Import file Excel/CSV phiếu cân trực tiếp tại màn hình này.
- Bảng hiển thị danh sách phiếu cân đã nạp.
- Chức năng: Thêm phiếu thủ công, Sửa, Xóa, Xóa hết, Xuất Excel phiếu nguồn.

### Tab 2 — Phân bổ (Allocation Engine & Preview)
- **Bộ chọn 1 Sà lan đích:** Hỗ trợ chọn nhanh `NÔNG SẢN_DE HEUS` hoặc bất kỳ sà lan nào từ danh sách Tàu/Sà lan hiện có.
- **Sidebar Cấu hình phân bổ:**
  - Khoảng cách thời gian giữa các chuyến (phút).
  - Chiến lược chia tải: Đều (Even), Ngẫu nhiên (Random), Tối đa tải (Max Capacity).
  - Bảng giới hạn tải trọng xe (`limit_weight`).
- **Thuật toán phân bổ:** Tách chuyến dựa trên tải trọng xe và khối lượng net của phiếu, căn chỉnh thời gian ra/vào hợp lý.
- **Bảng xem trước (Preview):** Hiển thị danh sách chuyến xe sau phân bổ.
- **Hành động:** Nút "Lưu vào Sổ theo dõi" và tùy chọn "Đồng bộ vào sà lan đã chọn".

### Tab 3 — Sổ theo dõi (Allocated Tracking Book)
- Hiển thị danh sách các chuyến xe đã được phân bổ thành công theo đúng định dạng Sổ theo dõi logic cũ.
- Hỗ trợ tìm kiếm, lọc, sửa mã lệnh, xóa bản ghi.
- Nút **Xuất Excel Sổ theo dõi** chuẩn định dạng báo cáo.
