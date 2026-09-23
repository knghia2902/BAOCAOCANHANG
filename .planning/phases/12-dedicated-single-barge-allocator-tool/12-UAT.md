---
status: testing
phase: 12-dedicated-single-barge-allocator-tool
source:
  - 12-01-SUMMARY.md
  - 12-02-SUMMARY.md
started: "2026-09-23T16:13:00.000Z"
updated: "2026-09-23T17:34:25.000Z"
---

## Current Test

number: 4
name: Đồng bộ chuyến xe đã phân bổ
expected: |
  Tại Tab 2 ("2. Phân bổ") hoặc Tab 3 ("3. Theo dõi"):
  - Bấm nút "Đồng bộ sà lan".
  - Hệ thống hiển thị hộp thoại xác nhận đồng bộ chuyến xe vào sổ cân của sà lan tương ứng.
  - Khi xác nhận thành công, thông báo hiển thị "Đã đồng bộ thành công X chuyến xe vào sà lan...".
awaiting: user response

## Tests

### 1. Truy cập và điều hướng công cụ Phân bổ (/split)
expected: Truy cập /split, trang hiển thị đầy đủ tiêu đề, Sidebar cài đặt ở bên TRÁI (hiển thị danh sách sà lan) và 3 tab dữ liệu (1. Phiếu cân, 2. Phân bổ, 3. Theo dõi) ở bên phải.
result: pass

### 2. Import & nạp phiếu cân nguồn từ Sà lan nguồn (Tab 1)
expected: Bấm nút "Import Excel / CSV" hoặc "Nạp từ sà lan ([Tên sà lan])". Bảng hiển thị danh sách phiếu với đầy đủ các cột (Số phiếu, Mã lệnh, Biển số, Khách hàng, TL1, TL2, KL hàng, Giờ vào, Giờ ra...) cùng thanh thống kê tổng tấn/tổng phiếu.
result: pass

### 3. Xem trước phân bổ tách tải xe cho Sà lan nguồn (Tab 2)
expected: Chuyển sang Tab 2, dữ liệu sà lan nguồn hiển thị theo sà lan đã chọn ở sidebar trái, bảng xem trước hiển thị các chuyến xe được tự động tách theo định mức xe, tổng khối lượng khớp 100% khối lượng gốc và thời gian được dàn cách đều.
result: pass

### 4. Đồng bộ chuyến xe đã phân bổ
expected: Tại Tab 2 hoặc Tab 3 bấm "Đồng bộ sà lan", hệ thống hiện modal xác nhận và đồng bộ các chuyến xe vào hệ thống theo sà lan nguồn.
result: [pending]

### 5. Lưu vào Sổ theo dõi (bảng riêng) và Xuất Excel (Tab 3)
expected: Bấm "Lưu vào Sổ Theo Dõi" tự động chuyển sang Tab 3, các phiếu được lưu vào bảng riêng weighbridge_allocation_tracking (có cột Sà lan, có bộ lọc theo sà lan đang chọn hoặc tất cả sà lan). Bấm "Xuất Excel" tải về file Excel sổ theo dõi chuẩn.
result: [pending]

## Summary

total: 5
passed: 3
issues: 0
pending: 2
skipped: 0
blocked: 0

## Gaps
