---
status: testing
phase: 15-chuy-n-s-lan-gi-a-c-c-t-u-b-ng-k-o-th-an-to-n-trong-b-o-c-o-
source:
  - 15-01-SUMMARY.md
started: 2026-10-15T22:30:00Z
updated: 2026-10-15T22:30:00Z
---

## Current Test
<!-- OVERWRITE each test - shows where we are -->

number: 1
name: Kéo thả sà lan trên Sidebar và hiệu ứng Visual Cues
expected: |
  Khi kéo một sà lan chưa khóa từ danh sách Tàu A rê qua Tàu B (chưa chốt số liệu), khung Tàu B xuất hiện viền highlight màu xanh ngọc. Khi buông chuột thả vào Tàu B, hệ thống tự động mở hộp thoại "Chuyển sà lan sang tàu khác" (chưa thay đổi dữ liệu ngay để chống thả nhầm).
awaiting: user response

## Tests

### 1. Kéo thả sà lan trên Sidebar và hiệu ứng Visual Cues
expected: Khi kéo một sà lan chưa khóa từ danh sách Tàu A rê qua Tàu B (chưa chốt số liệu), khung Tàu B xuất hiện viền highlight màu xanh ngọc. Khi buông chuột thả vào Tàu B, hệ thống tự động mở hộp thoại "Chuyển sà lan sang tàu khác" (chưa thay đổi dữ liệu ngay để chống thả nhầm).
result: [pending]

### 2. Hủy bỏ thao tác chuyển trong Modal xác nhận
expected: Trong modal xác nhận chuyển sà lan, khi bấm nút "Hủy bỏ", hộp thoại đóng lại ngay lập tức và sà lan vẫn nằm nguyên vẹn tại Tàu A cũ, không phát sinh bất kỳ thay đổi dữ liệu nào.
result: [pending]

### 3. Xác nhận chuyển sà lan thành công & Bảo lưu toàn bộ phiếu cân
expected: Trong modal xác nhận, khi bấm "Xác nhận chuyển", sà lan được chuyển sang Tàu B; toàn bộ danh sách phiếu cân, số xe, tấn hàng Net, biên bản của sà lan được giữ nguyên 100%; tổng sản lượng và tiến độ của Tàu A và Tàu B trên báo cáo tổng quan tự động cập nhật lại chính xác.
result: [pending]

### 4. Nút chuyển sà lan dự phòng (Cho thiết bị cảm ứng / Mobile)
expected: Trên Sidebar có nút icon [swap_horiz] trên từng dòng sà lan, và trên thanh tiêu đề chi tiết sà lan có nút [Chuyển tàu]. Khi bấm nút này, modal xác nhận mở ra với dropdown cho phép chọn tàu đích muốn chuyển tới.
result: [pending]

### 5. Chặn thao tác đối với tàu đã hoàn thành hoặc sà lan đã khóa
expected: Đối với sà lan đã khóa (biểu tượng ổ khóa vàng) hoặc thuộc tàu mẹ đã chốt số liệu (status 'done'), sà lan không cho phép kéo thả và các tàu đã chốt không nhận sà lan thả vào.
result: [pending]

## Summary

total: 5
passed: 0
issues: 0
pending: 5
skipped: 0
blocked: 0

## Gaps

<!-- YAML format for plan-phase --gaps consumption -->
