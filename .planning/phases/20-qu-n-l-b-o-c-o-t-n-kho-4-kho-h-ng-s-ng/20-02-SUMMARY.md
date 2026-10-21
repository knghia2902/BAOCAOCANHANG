# Plan 20-02 Summary: Giao Diện Quản Lý Tồn Kho 4 Kho (`WarehouseInventoryManager.vue`) & Tích Hợp Điều Hướng

**Status:** Completed  
**Phase:** 20 — Quản lý & Báo cáo Tồn Kho 4 Kho Hàng Sáng  
**Date:** 2026-10-21

## Accomplishments
- **Component [`WarehouseInventoryManager.vue`](file:///c:/Users/TVPL-NgocAnh/Desktop/Tools/BAOCAOCANHANG/src/components/tools/WarehouseInventoryManager.vue)**:
  - **5 Tab Chọn Kho:** `KHO 1`, `KHO 2`, `KHO 3`, `KHO 4` và chế độ xem ngang `TỔNG HỢP KHO 1-2-3 (GỖ BÌNH ĐỊNH)` hiển thị khách hàng hiện tại, tồn đầu kỳ, tổng nhập, tổng xuất và tồn cuối lũy kế liên tục.
  - **Thanh Công Cụ Nhập Dữ Liệu 1 Chạm:**
    - Nút **`Import CSV Trạm Cân (Đồng bộ 1 chạm)`**: phân loại tự động 3 luồng (`IMPORT`, `EXPORT`, `DIRECT`) theo mốc 06:00 sáng, đồng thời đẩy toàn bộ chuyến `Xuat` sang `allocator_tickets` và các Sà lan đang mở của `WeighbridgeService`.
    - Nút **`Nạp từ Excel Tồn Kho Đang Dùng`**: đọc tự động cả 2 định dạng workbook (Single-Warehouse Eastwood & Multi-Warehouse GBD) để nạp toàn bộ lịch sử tồn kho, danh mục Nhà máy — Biển số (`Data`) và Tồn đầu kỳ lên Web.
  - **Chỉnh sửa Trực tiếp Cấu hình Kho & Ghi chú Ngày:**
    - Sửa tên Khách hàng hiện tại, Tồn đầu kỳ (`openingStock`) và danh mục Nhà máy — Biển số (`Data`) ngay trên giao diện mà không làm đứt đoạn công thức cộng dồn lịch sử.
    - Nhập Ghi chú trực tiếp trên từng dòng ngày của bảng `FINAL` (ví dụ: `"Đang làm hàng tàu MV..."`, `"Nhập từ nhà máy..."`).
  - **5 Sheet Tab Chi Tiết:** `FINAL (Tổng Hợp Ngày)`, `IMPORT (Nhập Kho)`, `EXPORT (Xuất Kho)`, `ĐI THẲNG / XÁ THẲNG`, và `Data (Nhà Máy - Xe)` cùng bộ lọc theo khoảng Ngày Báo Cáo (`Từ ngày` – `Đến ngày`).
- **Tích hợp Điều hướng Toàn Hệ thống:**
  - Tích hợp vào menu bên trái của [`CargoAllocator.vue`](file:///c:/Users/TVPL-NgocAnh/Desktop/Tools/BAOCAOCANHANG/src/components/tools/CargoAllocator.vue) (`activeMainTab = 'warehouse_inventory'`).
  - Tích hợp nút chuyển đổi trên thanh bên của [`WeighbridgePrinter.vue`](file:///c:/Users/TVPL-NgocAnh/Desktop/Tools/BAOCAOCANHANG/src/components/tools/WeighbridgePrinter.vue) (`activeModule = 'warehouse_inventory'`).

## Verification
- `npx vue-tsc --noEmit` passed with 0 errors.
