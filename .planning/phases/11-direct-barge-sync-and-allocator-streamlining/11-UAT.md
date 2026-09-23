---
status: complete
phase: 11-direct-barge-sync-and-allocator-streamlining
source:
  - 11-01-SUMMARY.md
  - 11-02-SUMMARY.md
started: 2026-09-22T09:32:00Z
updated: 2026-09-23T15:21:00Z
---

## Current Test

(Tất cả các kiểm thử đã hoàn thành thành công)

## Tests

### 1. Giao diện 2 Tab & Tinh gọn cấu hình
expected: Màn hình Dữ liệu cân hàng chỉ có 2 Tab (1. Phiếu cân, 2. Theo dõi), không còn thẻ Quy tắc phân bổ và Cấu hình tải trọng xe.
result: pass

### 2. Đồng bộ trực tiếp phiếu cân vào Sà lan theo Mã lệnh (Order No)
expected: Tại màn hình Quản lý Sà lan, bấm Đồng bộ dữ liệu thì hệ thống đọc trực tiếp phiếu cân từ Tab 1 và khớp chuẩn xác theo Mã lệnh (orderNo) vào từng sà lan, giờ vào / giờ ra phải khớp file import.
result: pass

### 3. Lưu vào Sổ Theo Dõi và Làm sạch Tab 1
expected: Tại Tab 1 Phiếu cân, bấm "Lưu vào Sổ Theo Dõi" -> dữ liệu được lưu thành công, danh sách phiếu cân ở Tab 1 được xóa sạch hoàn toàn, và tự động chuyển sang Tab 2 Theo dõi.
result: pass

### 4. Bảng và Xuất Excel tại Tab 2 (Theo dõi)
expected: Tab 2 Theo dõi hiển thị bảng 14 cột tiêu chuẩn khớp cấu trúc phiếu cân gốc; nút Xuất Excel tạo file bảng tính chuẩn định dạng.
result: pass

### 5. Tính độc lập giữa Đồng bộ Sà lan và Lưu Sổ Theo Dõi
expected: Tác vụ Đồng bộ Sà lan và Lưu Sổ Theo Dõi hoạt động hoàn toàn độc lập, người dùng có thể thực hiện đồng bộ sà lan trước rồi mới lưu sổ theo dõi mà không bị phụ thuộc hay xung đột.
result: pass

## Summary

total: 5
passed: 5
issues: 0
pending: 0
skipped: 0
blocked: 0

## Gaps

- truth: "Khi đồng bộ vào Sà lan, giờ vào (dateIn) và giờ ra (dateOut) phải khớp chính xác theo giờ vào / giờ ra của file phiếu cân import"
  status: fixed
  reason: "Đã khắc phục: Thêm hàm formatExcelDateCell và cleanHeader xử lý thông minh mọi tiêu đề ngày giờ và cell Date/Time trong Excel; bổ sung cột Khách hàng, TL1, TL2, Ngày vào, Giờ vào, Ngày ra, Giờ ra trên Tab 1; đồng bộ giờ vào/giờ ra giữ nguyên local time không bị 00:00."
  severity: major
  test: 2
  root_cause: "1. Trong handleExcelUpload, cell.value instanceof Date bị ép sang toLocaleDateString() làm mất thành phần giờ/phút hoặc biến cell giờ thành '30/12/1899'. 2. Header matching chỉ tìm 'gio can lan 1' bỏ sót 'Giờ vào'/'Giờ ra'. 3. Bảng Tab 1 gộp chung và thiếu cột Giờ vào / Giờ ra trực quan."
  artifacts:
    - path: "src/components/tools/CargoAllocator.vue"
    - path: "src/components/tools/WeighbridgePrinter.vue"
