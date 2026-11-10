---
id: 261110-dt0
title: Triển khai tách riêng quản lý tồn kho và phiếu cân cho khách Bách Khoa tại Kho 4
created: 2026-11-10
status: completed
---

# Summary 261110-dt0: Triển khai tách riêng quản lý tồn kho và phiếu cân cho khách Bách Khoa tại Kho 4

## 1. Kết quả thực hiện
Đã hoàn thành toàn bộ 3 tác vụ theo đúng yêu cầu:
1. **Types & Service Layer:**
   - Bổ sung `ExtendedWarehouseId = WarehouseId | 'KHO 4 - BK'` trong `src/types/excel.ts`.
   - Hàm `isBachKhoaCustomer()` và `isBachKhoaTicket()` tự động phân loại chính xác theo từ khóa: `BÁCH KHOA`, `BACH KHOA`, `BK`, `BKTH`.
   - Cập nhật `getTicketCustomerGroup()` phân biệt 3 nhóm: `'KHO_4'` (Eastwood), `'KHO_4_BK'` (Bách Khoa), `'KHO_123'` (Gỗ Bình Định).
   - `WarehouseInventoryService` lưu trữ và tính toán độc lập `configs['KHO 4 - BK']` (tồn đầu kỳ ban đầu bằng 0, ghi chú ngày độc lập).
   - Xuất file Excel độc lập: Eastwood xuất `WEIGHT LIST GỖ NÉN_KHO NGUYÊN NGỌC_EW_<ddMMyyyy>.xlsx`, Bách Khoa xuất `WEIGHT LIST GỖ NÉN_KHO NGUYÊN NGỌC_BK_<ddMMyyyy>.xlsx` với đầy đủ 4 sheet (`IMPORT 4`, `EXPORT 4`, `FINAL 4`, `XÁ THẲNG`).
   - Xóa dữ liệu an toàn: Xóa dữ liệu Bách Khoa không ảnh hưởng Eastwood và ngược lại.

2. **Giao diện & Sơ đồ kho:**
   - Cây điều hướng Sidebar tách thành 3 khối khách hàng: Eastwood (Kho 4), Bách Khoa (Kho 4), Gỗ Bình Định (Kho 1-2-3 & Gộp).
   - Sơ đồ kho (`WarehouseVisualMap.vue`) hiển thị góc Bách Khoa riêng biệt tại Ô 1 đáy trái Kho 4 (màu cam `#F97316` với badge nhãn Bách Khoa).
   - Action bar, modal chỉnh sửa cấu hình / tên khách hàng và tính năng chụp ảnh Zalo hoạt động tương ứng cho cả 2 khách.

3. **Database Migration:**
   - Tạo file migration `database/migrations/20261110_expand_warehouse_configs_for_bach_khoa.sql` để mở rộng ràng buộc bảng `warehouse_configs`.

4. **Testing & Verification:**
   - 16 test suites với 74 unit tests PASS 100%.
   - TypeScript compilation (`vue-tsc -b`) và Vite build thành công 100% không có lỗi.
