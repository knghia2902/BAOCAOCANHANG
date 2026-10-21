---
status: testing
phase: 20-qu-n-l-b-o-c-o-t-n-kho-4-kho-h-ng-s-ng
source:
  - 20-01-SUMMARY.md
  - 20-02-SUMMARY.md
  - 20-03-SUMMARY.md
started: "2026-10-21T21:21:00.000Z"
updated: "2026-10-21T21:21:00.000Z"
---

## Current Test

2. Import CSV Trạm Cân và quy tắc chốt ca 06:00 sáng

## Tests

### 1. Truy cập màn hình Báo Cáo Tồn Kho 4 Kho
expected: Bấm vào thẻ "Tồn Kho 4 Kho" tại Trang Chủ (`/`) hoặc danh sách Công Cụ (`/tools`), hoặc truy cập trực tiếp `/tools/warehouse`, hoặc bấm "Báo cáo Tồn kho (4 Kho)" ở menu bên trái của Báo Cáo Cân Hàng (`/weighbridge`) và Phân Bổ Hàng Hóa (`/allocator`). Giao diện Quản Lý Tồn Kho 4 Kho xuất hiện với 5 tab chọn kho (KHO 1, KHO 2, KHO 3, KHO 4, TỔNG HỢP KHO 1-2-3).
result: pass

### 2. Import CSV Trạm Cân và quy tắc chốt ca 06:00 sáng
expected: Bấm nút "Import CSV Trạm Cân (Đồng bộ 1 chạm)" và chọn file `2010ok.csv` (hoặc cặp file `xxxx cc1`, `xxxx cc2`). Dữ liệu được tự động phân loại thành Nhập kho (vào sheet IMPORT), Xuất kho (vào sheet EXPORT), Đi thẳng (vào sheet ĐI THẲNG). Các chuyến cân ra từ 00:00 - 05:59 sáng được quy về ngày hôm trước.
result: pending

### 3. Đồng bộ các phiếu trong file cc2 sang Tab Phiếu Cân ở Dữ Liệu Cân Hàng
expected: Khi import file có tên chứa "cc2", toàn bộ phiếu trong file cc2 (bao gồm cả Nhập và Xuất) được tự động nạp sang Tab 1 (Phiếu Cân) trong Dữ Liệu Cân Hàng (`allocator_tickets`) mà không tự động ghép vào sà lan.
result: pending

### 4. Nạp từ Excel Báo Cáo Tồn Kho đang dùng (Bootstrap Lịch Sử)
expected: Bấm nút "Nạp từ Excel Tồn Kho Đang Dùng", chọn file Excel tồn kho hiện tại (mẫu Eastwood hoặc GBD). Hệ thống nạp đầy đủ lịch sử Nhập, Xuất, Đi thẳng, Data danh mục nhà máy - xe và Tồn đầu kỳ lên Web.
result: pending

### 5. Xem Bảng FINAL Cộng Dồn Lũy Kế & Chỉnh Sửa Ghi Chú Ngày
expected: Bảng FINAL hiển thị lũy kế liên tục qua các ngày (`Tồn cuối = Tồn đầu + Nhập - Xuất`). Cho phép sửa Ghi chú trực tiếp trên từng dòng ngày và sửa Tên khách hàng / Tồn đầu kỳ ở phần cấu hình.
result: pending

### 6. Xuất Báo Cáo Gửi Zalo (Ảnh PNG 2x) & Xuất File Excel Đa Sheet
expected: Bấm nút "Copy Ảnh Bảng FINAL (Dán Zalo)", ảnh bảng tổng hợp được copy vào clipboard để dán (Ctrl+V) vào Zalo; bấm "Xuất Excel Báo Cáo Ngày", file .xlsx tải về gồm các sheet chuẩn mẫu với công thức sống SUMIF, SUBTOTAL, VLOOKUP.
result: pending

## Summary

total: 6
passed: 0
issues: 0
pending: 6
skipped: 0
blocked: 0

## Gaps
