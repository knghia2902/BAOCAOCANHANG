---
phase: quick
plan: 261025-edt
status: complete
date: "2026-10-25"
files_modified:
  - src/components/tools/WarehouseInventoryManager.vue
---

# Quick Task Summary: Thêm nút edit ở mỗi phiếu cân

## Thực hiện
1. **Thêm nút Edit (Sửa)**:
   - Cập nhật header cột hành động thành `Thao tác` (chiều rộng `w-20`).
   - Bổ sung nút Sửa (màu xanh dương, icon `edit`) bên cạnh nút Xóa (màu đỏ) ở cả 6 bảng chi tiết:
     - Tab IMPORT: GBD (Kho 1-2-3) & Kho 4.
     - Tab EXPORT: GBD (Kho 1-2-3) & Kho 4.
     - Tab DIRECT (Xá thẳng): GBD & Kho 4.
2. **Modal chỉnh sửa chi tiết phiếu cân (`showEditTicketModal`)**:
   - Mở khi bấm nút Edit trên bất kỳ phiếu cân nào.
   - Hỗ trợ chỉnh sửa tất cả các trường:
     - Thông tin phiếu: Số phiếu, Biển số xe, Mã lệnh / loại cân.
     - Thời gian: Ngày báo cáo (Ca 6h), Giờ cân vào, Giờ cân ra.
     - Trọng lượng (Tấn / Kg): Tổng trọng (Gross), Tự trọng xe (Tare), Trọng lượng hàng (Net - tự động tính khi đổi Gross/Tare), Cân nhà máy.
     - Kho & Vận tải: Kho lưu trữ, Nhà xe, Nơi nhận/xuất phát, Tên kho, Khu vực, Sà lan, Tàu mẹ.
     - Ghi chú: Ghi chú chi tiết cho phiếu.
   - Nút "Xóa phiếu này" trực tiếp từ modal nếu người dùng muốn hủy phiếu.
   - Nút "Lưu Phiếu Cân" lưu qua `WarehouseInventoryService.updateTicket`, cập nhật trực tiếp danh sách và dữ liệu tổng hợp.

## Kiểm thử & Build
- `npx vue-tsc -b`: 0 lỗi type.
- `npm test`: 13 test suites, 43 tests pass 100%.
- `npm run build`: Production bundle thành công.
