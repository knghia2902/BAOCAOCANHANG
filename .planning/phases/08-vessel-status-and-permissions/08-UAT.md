---
status: testing
phase: 08-vessel-status-and-permissions
source:
  - .planning/phases/08-vessel-status-and-permissions/08-01-SUMMARY.md
  - .planning/phases/08-vessel-status-and-permissions/08-02-SUMMARY.md
started: 2026-09-11T14:07:00Z
updated: 2026-09-11T14:18:00Z
---

## Current Test

number: 3
name: Quy trình Chốt số liệu tàu ("Đã xong")
expected: |
  Khi chọn một tàu đang làm hàng, trên tiêu đề báo cáo tổng hợp xuất hiện nút "Chốt số liệu: Đã xong". Bấm nút này sẽ hiển thị modal xác nhận cảnh báo. Khi đồng ý, trạng thái tàu chuyển thành "Đã xong" và xuất hiện badge "Đã xong" cùng thông báo Chỉ xem (Read-only).
awaiting: user response

## Tests

### 1. Tab chuyển đổi phân loại tàu trên Sidebar
expected: Trong công cụ In phiếu cân (WeighbridgePrinter), trên thanh danh sách Sidebar bên trái xuất hiện 2 tab "Đang làm" và "Đã xong" kèm badge hiển thị số lượng tàu. Khi bấm chuyển giữa 2 tab, danh sách tàu tương ứng hiển thị chính xác.
result: pass

### 2. Tab lọc trạng thái tại Báo cáo tổng quan hệ thống
expected: Khi ở trang Tổng quan (chưa chọn tàu cụ thể), khi bấm đổi tab "Đang làm" hoặc "Đã xong" ở Sidebar, số liệu thẻ "Tổng số tàu" và bảng danh sách sà lan tự động cập nhật tương ứng theo tab đang chọn. Cụm tab trùng lặp ở banner Tổng quan đã được gỡ bỏ để tinh gọn giao diện.
result: pass

### 3. Quy trình Chốt số liệu tàu ("Đã xong")
expected: Khi chọn một tàu "Đang làm hàng", trên tiêu đề báo cáo tổng hợp xuất hiện nút "Chốt số liệu: Đã xong". Bấm nút này sẽ hiển thị modal xác nhận cảnh báo. Khi đồng ý, trạng thái tàu chuyển thành "Đã xong" và xuất hiện badge "Đã xong" cùng thông báo Chỉ xem (Read-only).
result: pending

### 4. Chế độ Chỉ xem (Read-only) bảo vệ dữ liệu tàu đã xong
expected: Khi mở xem sà lan của tàu "Đã xong", hệ thống hiển thị banner cảnh báo Chỉ xem. Các nút Thêm xe, Nhập Excel, Đồng bộ từ phân bổ, Xóa tất cả, Sửa xe, Xóa xe đều bị ẩn/vô hiệu hóa. Tính năng In phiếu (A5) và Xuất Excel vẫn hoạt động bình thường.
result: pending

### 5. Phân quyền Admin mở lại tàu "Đang làm hàng"
expected: Nút "Mở lại: Đang làm hàng" chỉ hiển thị khi đăng nhập tài khoản Quản trị viên (Admin). Khi Admin bấm mở lại và xác nhận, tàu chuyển về "Đang làm hàng", các nút thêm/sửa/xóa và nhập liệu được mở khóa trở lại.
result: pending

## Summary

total: 5
passed: 2
issues: 0
pending: 3
skipped: 0

## Gaps

[none yet]
