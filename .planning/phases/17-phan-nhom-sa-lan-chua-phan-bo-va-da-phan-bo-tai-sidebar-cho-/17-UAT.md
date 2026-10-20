---
status: testing
phase: 17-phan-nhom-sa-lan-chua-phan-bo-va-da-phan-bo-tai-sidebar-cho-
source:
  - 17-01-SUMMARY.md
started: "2026-10-20T14:58:00.000Z"
updated: "2026-10-20T14:58:00.000Z"
---

## Current Test

number: 2
name: Chọn sà lan Chưa phân bổ và nạp dữ liệu phân bổ
expected: |
  1. Tại Sidebar tab "Chưa phân bổ", bấm chọn một thẻ sà lan.
  2. Thẻ sà lan được chọn hiển thị viền nổi bật (màu hổ phách) và card thông tin sà lan bên dưới cập nhật đúng Tên, Số lệnh, Loại hàng.
  3. Khung bên phải giữ ở Tab 1 ("Phiếu cân") hoặc Tab 2 ("Phân bổ").
  4. Bấm nút "Lấy phiếu cân từ sà lan này" (hoặc import tệp), các phiếu cân gốc của sà lan được nạp thành công vào bảng.
awaiting: user response

## Tests

### 1. Hiển thị 2 Tab trạng thái Chưa phân bổ và Đã phân bổ tại Sidebar
expected: Truy cập /split, Sidebar bên trái hiển thị 2 tab trạng thái: Chưa phân bổ và Đã phân bổ kèm số lượng đếm, danh sách chỉ gồm các sà lan của tàu Nông Sản De Heus.
result: pass

### 2. Chọn sà lan Chưa phân bổ và nạp dữ liệu phân bổ
expected: Bấm chọn một sà lan trong tab Chưa phân bổ, thẻ được chọn có hiệu ứng viền nổi bật. Khung làm việc mở Tab 1 / Tab 2, card bên dưới cho phép bấm nạp phiếu cân gốc của sà lan đó.
result: [pending]

### 3. Chọn sà lan Đã phân bổ tự động chuyển sang Tab 3 ("Sổ theo dõi")
expected: Chuyển sang tab Đã phân bổ, thẻ sà lan hiển thị số chuyến và tổng tấn. Khi bấm chọn sà lan này, khung bên phải tự động chuyển sang Tab 3 ("Sổ theo dõi") và lọc đúng các chuyến của sà lan đó kèm nút Xuất Excel.
result: [pending]

### 4. Tự động chuyển sà lan từ Chưa phân bổ sang Đã phân bổ khi bấm Lưu
expected: Khi phân bổ xong một sà lan ở Tab 2 và bấm "Lưu vào Sổ theo dõi", sà lan đó tự động chuyển từ tab Chưa phân bổ sang tab Đã phân bổ ở Sidebar và cập nhật số chuyến/số tấn.
result: [pending]

## Summary

total: 4
passed: 1
issues: 0
pending: 3
skipped: 0
blocked: 0

## Gaps
