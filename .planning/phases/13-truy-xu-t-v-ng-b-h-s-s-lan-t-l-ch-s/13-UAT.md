---
status: complete
phase: 13-truy-xu-t-v-ng-b-h-s-s-lan-t-l-ch-s
source:
  - 13-01-SUMMARY.md
started: 2026-09-24T20:53:00Z
updated: 2026-09-24T21:19:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Hiển thị nút "Truy xuất hồ sơ cũ"
expected: Nút [ 🕒 Truy xuất hồ sơ cũ ] xuất hiện ngay cạnh nhãn Tên sà lan trong form chỉnh sửa hồ sơ.
result: pass

### 2. Cảnh báo khi ô Tên sà lan để trống
expected: Khi xóa trắng ô Tên sà lan và bấm "Truy xuất hồ sơ cũ", hệ thống hiện Toast nhắc nhở: "Vui lòng nhập tên sà lan trước khi truy xuất!".
result: pass

### 3. Thông báo khi không tìm thấy sà lan cũ
expected: Khi nhập một tên sà lan chưa từng có trong lịch sử (ví dụ: SALAN_TEST_99999) và bấm nút, hệ thống báo Toast: "Không tìm thấy dữ liệu cũ của sà lan SALAN_TEST_99999!".
result: pass

### 4. Hiển thị Modal xác nhận và tự động điền dữ liệu cũ
expected: Khi nhập tên một sà lan đã từng có trong lịch sử và bấm nút, hệ thống mở Modal "Đồng bộ hồ sơ sà lan cũ" hiển thị rõ tên sà lan, tên tàu mẹ cũ, ngày cập nhật. Khi bấm "Đồng ý đồng bộ", form tự động điền thông số kỹ thuật, GCN, Đăng kiểm, Bảo hiểm, Thuyền bộ và hình ảnh đính kèm; trạng thái hợp lệ tự động cập nhật màu xanh lá.
result: pass

## Summary

total: 4
passed: 4
issues: 0
pending: 0
skipped: 0
blocked: 0
