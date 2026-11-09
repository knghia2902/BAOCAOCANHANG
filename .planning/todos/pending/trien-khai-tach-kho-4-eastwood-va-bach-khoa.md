---
title: Triển khai tách riêng quản lý tồn kho và phiếu cân cho khách Bách Khoa tại Kho 4
date: 2026-11-09
priority: high
status: pending
---

# Triển khai tách riêng quản lý tồn kho và phiếu cân cho khách Bách Khoa tại Kho 4

## Bối cảnh
Kho 4 tiếp nhận thêm khách hàng Bách Khoa lưu hàng. Cần triển khai mô hình 2 kho logic độc lập cho Kho 4 (Eastwood và Bách Khoa), tự động phân luồng phiếu cân theo từ khóa tên khách, tính toán tồn kho riêng và xuất file báo cáo Excel riêng biệt.

## Danh sách công việc chi tiết

### 1. Data Types & Service Layer
- [ ] Mở rộng kiểu dữ liệu kho / phân hệ: Cập nhật `WarehouseId` hoặc hỗ trợ sub-key (ví dụ `KHO 4 (EASTWOOD)` và `KHO 4 (BACH KHOA)` hoặc mở rộng `WarehouseConfig` theo cặp `(warehouseId, customerKey)`).
- [ ] Cập nhật `WarehouseInventoryService.ts`:
  - Mở rộng hàm `getTicketCustomerGroup()` và bộ matcher nhận diện từ khóa `BÁCH KHOA`, `BACH KHOA`, `BK` tách biệt hoàn toàn khỏi `EASTWOOD`.
  - Cập nhật hàm tính toán `computeWarehouseFinalTable()` hỗ trợ lọc và tính tồn kho riêng cho từng khách hàng tại Kho 4.
  - Cập nhật hàm khởi tạo cấu hình: Khởi tạo cấu hình mặc định cho Bách Khoa với tồn đầu kỳ = 0 tấn.
  - Cập nhật hàm xuất file Excel: Bổ sung logic xuất file báo cáo riêng cho Bách Khoa (`..._BK_...xlsx`) với đầy đủ 3 sheet `IMPORT 4`, `EXPORT 4`, `FINAL 4`.

### 2. Giao diện Quản lý Tồn kho (WarehouseInventoryManager.vue)
- [ ] Cập nhật Cây danh mục kho / Tab điều hướng bên trái:
  - Hiển thị rõ ràng 2 nhánh của Kho 4: **Kho 4 (Eastwood)** và **Kho 4 (Bách Khoa)**.
- [ ] Cập nhật hiển thị bảng phiếu cân (Nhập, Xuất, Xá thẳng) và bảng tổng hợp FINAL theo khách hàng đang chọn.
- [ ] Cập nhật modal chỉnh sửa cấu hình tồn đầu kỳ và ghi chú ngày cho từng phân hệ khách hàng riêng biệt.
- [ ] Cập nhật nút Xuất Excel và Sao chép ảnh bảng FINAL để tương ứng chính xác với khách hàng đang được kích hoạt.

### 3. Sơ đồ kho trực quan (WarehouseVisualMap.vue)
- [ ] Bố trí cấu hình phân vùng một góc khoang chứa trong Kho 4 dành riêng cho khách Bách Khoa.
- [ ] Hiển thị nhãn khách hàng, màu sắc phân biệt và số tấn tồn tương ứng tại các ô/khoang thuộc góc Bách Khoa.

### 4. Kiểm thử & Nghiệm thu
- [ ] Viết / Cập nhật Unit test trong `WarehouseInventoryService.test.ts` kiểm tra:
  - Nhận diện đúng phiếu cân của Bách Khoa và Eastwood theo từ khóa.
  - Bảng tính FINAL của Bách Khoa bắt đầu từ tồn 0 và lũy kế chính xác.
  - Xuất file Excel đúng định dạng và công thức.
- [ ] Kiểm tra build (`npm run build`) và không có lỗi TypeScript.
