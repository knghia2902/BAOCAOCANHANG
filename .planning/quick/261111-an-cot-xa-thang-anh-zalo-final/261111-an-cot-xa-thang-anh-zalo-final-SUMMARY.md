---
phase: quick
plan: 261111-an-cot-xa-thang-anh-zalo-final
status: complete
date: 2026-11-11
files_modified:
  - src/components/tools/WarehouseInventoryManager.vue
---

# Quick Task Summary: Ẩn cột Xá thẳng trong Ảnh chụp nhanh Final gửi Zalo

## Overview
Theo yêu cầu, trong Báo cáo tồn kho (`WarehouseInventoryManager.vue`), ảnh chụp nhanh bảng FINAL gửi Zalo (tạo qua hàm `renderFinalTableToPngBlob`) không cần hiển thị cột "Xá thẳng" (Direct).

## Key Changes
- `src/components/tools/WarehouseInventoryManager.vue`:
  - Trong hàm `renderFinalTableToPngBlob`:
    - Chuẩn hóa `getBlockColWidths` thành 5 cột cố định: `[135, 130, 130, 135, 125]`.
    - Loại bỏ cờ `hasDirect` và các điều kiện phân nhánh chèn cột Xá thẳng.
    - Cập nhật tiêu đề bảng (`headers`) thành đúng 5 cột: `Ngày`, `NHẬP {whId}`, `XUẤT {whId}`, `Tồn cuối`, `Ghi chú`.
    - Cập nhật định dạng dữ liệu từng hàng (`cells`), căn lề (`aligns`) và dòng tổng cộng (`totalCells`) chuẩn 5 cột.

## Verification
- Chạy `npm test`: 16 test files / 74 tests pass 100%.
- Chạy `npm run build`: `vue-tsc -b && vite build` hoàn thành thành công không có lỗi type hay biên dịch.
