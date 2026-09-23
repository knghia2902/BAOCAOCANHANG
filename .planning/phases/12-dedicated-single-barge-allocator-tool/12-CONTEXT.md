# Phase 12: Dedicated Single-Barge Allocator Tool — Context

## 1. Mục tiêu & Bối cảnh
- **Bối cảnh:** Ở Phase 11, màn hình "Dữ liệu cân hàng" (`/tools/allocator`) đã được tinh gọn xuống 2 Tab để tối ưu cho việc đồng bộ trực tiếp 1-1 các phiếu cân thật sang Sà lan theo Mã lệnh.
- **Nhu cầu mới:** Có những trường hợp/sà lan đặc thù (tiêu biểu như `NÔNG SẢN_DE HEUS` hoặc một sà lan bất kỳ do người dùng chỉ định) cần áp dụng **logic phân bổ cũ**: tách phiếu cân có khối lượng lớn vượt định mức thành nhiều chuyến xe con theo tải trọng xe (`limit_weight`), dàn đều/ngẫu nhiên khối lượng và thời gian ra vào hợp lý.
- **Quyết định kiến trúc:** Tách riêng thành một công cụ độc lập hoàn toàn, tên **"Phân bổ"**, truy cập qua route ngắn **`/split`** (và alias `/tools/split`). Giữ nguyên vẹn trải nghiệm 3 Tab như logic phân bổ cũ nhưng chuyên biệt hóa cho việc chọn và phân bổ cho **1 sà lan đích**.

## 2. Các quyết định thiết kế đã chốt (Decisions Locked)
- **Tên công cụ & Route:**
  - Tên: "Phân bổ" (Single Barge Allocator).
  - Route: `/split` (kèm alias redirect `/tools/split -> /split`).
  - Menu: Thêm mục "Phân bổ" trên thanh công cụ / menu điều hướng.
- **Tab 1: Phiếu cân (Source Tickets):**
  - Người dùng import trực tiếp file Excel/CSV phiếu cân của lô hàng/sà lan tại đây.
  - Bảng hiển thị danh sách phiếu cân đã nạp với các trường: Số phiếu, Biển số xe, Khách hàng, Loại hàng, TL1, TL2, KL hàng, Ngày/Giờ vào, Ngày/Giờ ra, Tài xế, Ghi chú.
  - Hỗ trợ thêm thủ công, sửa, xóa, xóa hết phiếu và xuất Excel phiếu nguồn.
- **Tab 2: Phân bổ (Allocation Engine & Preview):**
  - **Bộ chọn 1 Sà lan đích:** Hỗ trợ chọn `NÔNG SẢN_DE HEUS` hoặc bất kỳ sà lan nào từ danh sách Sà lan đang hoạt động trong hệ thống.
  - **Cấu hình phân bổ:**
    - Khoảng cách thời gian giữa các chuyến (mặc định 10-15 phút).
    - Chiến lược phân bổ khối lượng: Đều (`even`), Ngẫu nhiên (`random`), Tối đa tải trọng (`max`).
    - Bảng cấu hình tải trọng xe (`limit_weight` của từng xe, tải từ danh mục xe `vehiclesList`).
  - **Thuật toán phân bổ cũ:**
    - Tính toán số chuyến xe = `Math.ceil(recordWeight / limitWeight)`.
    - Phân bổ khối lượng theo chiến lược đã chọn.
    - Dàn thời gian vào/ra dựa trên khoảng cách thời gian và thời gian bắt đầu.
    - Bảng xem trước danh sách chuyến xe được sinh ra.
  - **Hành động:**
    - Nút "Lưu vào Sổ theo dõi": Lưu các chuyến đã sinh ra sang Tab 3.
    - Nút "Đồng bộ vào Sà lan": Nạp thẳng danh sách xe đã phân bổ vào Sà lan đích trong Báo cáo cân hàng (`WeighbridgePrinter.vue`) để in phiếu cân.
- **Tab 3: Sổ theo dõi (Allocated Tracking Book):**
  - Bảng hiển thị lịch sử các chuyến xe đã được phân bổ thành công (cấu trúc giống file Sổ theo dõi các phiếu cân sau phân bổ).
  - Tìm kiếm, lọc, sửa mã lệnh, xóa chuyến.
  - Xuất Excel Sổ theo dõi chuẩn mẫu.
- **Lưu trữ dữ liệu:**
  - Sử dụng IndexedDB và/hoặc Supabase cho state của tool phân bổ độc lập (`split_tickets`, `split_allocated_trips`, `split_history_trips`), tách biệt độc lập không ghi đè dữ liệu của màn hình Dữ liệu cân hàng (`allocator_tickets`).

## 3. Kế hoạch triển khai (Plan Outline)
- **Plan 12-01:** Khởi tạo Route `/split`, View `SplitAllocatorView.vue` và Component `SingleBargeAllocator.vue`, tích hợp Layout, Menu Navigation, Tab 1 (Import & quản lý phiếu cân nguồn), Sidebar cấu hình phân bổ (giới hạn tải trọng xe, khoảng cách thời gian, chiến lược).
- **Plan 12-02:** Tái lập thuật toán phân bổ tách tải xe cho 1 sà lan đích, xây dựng Tab 2 (Xem trước & phân bổ xe), tích hợp nút đồng bộ trực tiếp vào sà lan đích, xây dựng Tab 3 (Sổ theo dõi sau phân bổ kèm xuất Excel chuẩn mẫu).
