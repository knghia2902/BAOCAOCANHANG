---
status: testing
phase: 11-direct-barge-sync-and-allocator-streamlining
source:
  - 11-01-SUMMARY.md
  - 11-02-SUMMARY.md
started: 2026-09-22T09:32:00Z
updated: 2026-09-22T13:51:30Z
---

## Current Test

number: 2
name: Đồng bộ trực tiếp phiếu cân vào Sà lan theo Mã lệnh (Order No)
expected: |
  Sau khi import file phiếu cân lên Tab 1 (Phiếu cân):
  - Người dùng chuyển sang màn hình Quản lý Sà lan (In phiếu / Sà lan).
  - Bấm nút "Đồng bộ từ Dữ liệu cân hàng" cho từng sà lan (hoặc bấm "Đồng bộ tất cả").
  - Dữ liệu các xe có Mã lệnh (orderNo) tương ứng được nạp trực tiếp vào sà lan đó với đầy đủ thông tin (lái xe, ghi chú, loại hàng, khách hàng, số xe, trọng lượng cân, giờ vào / giờ ra khớp chuẩn file import).
awaiting: diagnosed and ready to fix

## Tests

### 1. Giao diện 2 Tab & Tinh gọn cấu hình
expected: Màn hình Dữ liệu cân hàng chỉ có 2 Tab (1. Phiếu cân, 2. Theo dõi), không còn thẻ Quy tắc phân bổ và Cấu hình tải trọng xe.
result: pass

### 2. Đồng bộ trực tiếp phiếu cân vào Sà lan theo Mã lệnh (Order No)
expected: Tại màn hình Quản lý Sà lan, bấm Đồng bộ dữ liệu thì hệ thống đọc trực tiếp phiếu cân từ Tab 1 và khớp chuẩn xác theo Mã lệnh (orderNo) vào từng sà lan, giờ vào / giờ ra phải khớp file import.
result: issue
reported: "ok đã đồng bộ khớp mã lệnh nhưng giờ vào/ giờ ra so với file import"
severity: major

### 3. Lưu vào Sổ Theo Dõi và Làm sạch Tab 1
expected: Tại Tab 1 Phiếu cân, bấm "Lưu vào Sổ Theo Dõi" -> dữ liệu được lưu thành công, danh sách phiếu cân ở Tab 1 được xóa sạch hoàn toàn, và tự động chuyển sang Tab 2 Theo dõi.
result: [pending]

### 4. Bảng và Xuất Excel tại Tab 2 (Theo dõi)
expected: Tab 2 Theo dõi hiển thị bảng 14 cột tiêu chuẩn khớp cấu trúc phiếu cân gốc; nút Xuất Excel tạo file bảng tính chuẩn định dạng.
result: [pending]

### 5. Tính độc lập giữa Đồng bộ Sà lan và Lưu Sổ Theo Dõi
expected: Tác vụ Đồng bộ Sà lan và Lưu Sổ Theo Dõi hoạt động hoàn toàn độc lập, người dùng có thể thực hiện đồng bộ sà lan trước rồi mới lưu sổ theo dõi mà không bị phụ thuộc hay xung đột.
result: [pending]

## Summary

total: 5
passed: 1
issues: 1
pending: 3
skipped: 0
blocked: 0

## Gaps

- truth: "Khi đồng bộ vào Sà lan, giờ vào (dateIn) và giờ ra (dateOut) phải khớp chính xác theo giờ vào / giờ ra của file phiếu cân import"
  status: failed
  reason: "User reported: ok đã đồng bộ khớp mã lệnh nhưng giờ vào/ giờ ra so với file import"
  severity: major
  test: 2
  root_cause: "cleanTickets trong CargoAllocator.vue bị thiếu trường timeInStr/timeOutStr khi lưu allocator_tickets lên Supabase, khiến WeighbridgePrinter.vue nhận chuỗi ngày không có giờ, dẫn đến parseExcelDate trả về rỗng và fallback về thời gian hiện tại (now), hoặc bị lệch do getUTCHours()."
  artifacts:
    - path: "src/components/tools/CargoAllocator.vue"
    - path: "src/components/tools/WeighbridgePrinter.vue"
  missing:
    - "Lưu đầy đủ timeInStr, timeOutStr, date1Obj, date2Obj trong cleanTickets của CargoAllocator.vue"
    - "Cải tiến hàm phân tích ngày giờ trong WeighbridgePrinter.vue để giữ nguyên vẹn giờ vào / giờ ra địa phương của file import"
