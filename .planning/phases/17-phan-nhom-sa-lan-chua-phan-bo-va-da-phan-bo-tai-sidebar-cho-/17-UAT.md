---
status: testing
phase: 17-phan-nhom-sa-lan-chua-phan-bo-va-da-phan-bo-tai-sidebar-cho-
source:
  - 17-01-SUMMARY.md
started: "2026-10-20T14:58:00.000Z"
updated: "2026-10-20T14:58:00.000Z"
---

## Current Test

number: 1
name: Hiển thị 2 Tab trạng thái Chưa phân bổ và Đã phân bổ tại Sidebar
expected: |
  1. Truy cập vào trang Phân Bổ Tải Trọng (`/split`).
  2. Tại Sidebar bên trái:
     - Header hiển thị "Sà lan Nông Sản De Heus" và tiến độ tổng (X/Y đã xong).
     - Có 2 nút tab chuyển đổi rõ ràng: `[⏳ Chưa phân bổ (X)]` và `[✅ Đã phân bổ (Y)]`.
     - Danh sách sà lan chỉ hiển thị các sà lan thuộc nguồn tàu Nông Sản De Heus.
awaiting: user response

## Tests

### 1. Hiển thị 2 Tab trạng thái Chưa phân bổ và Đã phân bổ tại Sidebar
expected: Truy cập /split, Sidebar bên trái hiển thị 2 tab trạng thái: Chưa phân bổ và Đã phân bổ kèm số lượng đếm, danh sách chỉ gồm các sà lan của tàu Nông Sản De Heus.
result: [pending]

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
passed: 0
issues: 0
pending: 4
skipped: 0
blocked: 0

## Gaps
