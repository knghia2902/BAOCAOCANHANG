---
status: testing
phase: 12-dedicated-single-barge-allocator-tool
source:
  - 12-01-SUMMARY.md
  - 12-02-SUMMARY.md
started: "2026-09-23T16:13:00.000Z"
updated: "2026-09-23T16:13:00.000Z"
---

## Current Test

number: 1
name: Truy cập và điều hướng công cụ Phân bổ (/split)
expected: |
  Truy cập vào địa chỉ http://localhost:5173/split (hoặc vào menu Tools và bấm thẻ "Phân Bổ Tải Trọng 🚢"):
  - Trang hiển thị layout công cụ với tiêu đề "PHÂN BỔ TẢI TRỌNG 🚢"
  - Có thanh điều hướng 3 tab rõ ràng: 1. Phiếu cân, 2. Phân bổ, 3. Sổ theo dõi
  - Có cột Sidebar cấu hình phân bổ ở bên phải màn hình
awaiting: user response

## Tests

### 1. Truy cập và điều hướng công cụ Phân bổ (/split)
expected: Truy cập /split, trang hiển thị đầy đủ tiêu đề, 3 tab (1. Phiếu cân, 2. Phân bổ, 3. Sổ theo dõi) và Sidebar cấu hình.
result: [pending]

### 2. Import & quản lý phiếu cân nguồn (Tab 1)
expected: Bấm nút "Import Excel / CSV" hoặc "Thêm thủ công" phiếu cân. Bảng hiển thị danh sách phiếu với đầy đủ 14 cột (Số phiếu, Mã lệnh, Biển số, Khách hàng, TL1, TL2, KL hàng, Giờ vào, Giờ ra...) cùng thanh thống kê tổng tấn/tổng phiếu.
result: [pending]

### 3. Xem trước phân bổ tách tải xe cho Sà lan đích (Tab 2)
expected: Chuyển sang Tab 2, sà lan đích hiển thị (mặc định ưu tiên NÔNG SẢN_DE HEUS), bảng xem trước hiển thị các chuyến xe được tự động tách theo định mức xe (ví dụ vé 60 tấn định mức 30 tấn tách thành 2 chuyến), tổng khối lượng các chuyến khớp 100% khối lượng gốc và thời gian được dàn cách đều.
result: [pending]

### 4. Đồng bộ chuyến xe đã phân bổ vào Sà lan
expected: Tại Tab 2 bấm "Đồng bộ vào Sà lan", hệ thống hiện modal xác nhận và thông báo đồng bộ thành công vào sà lan đích trong Báo cáo tổng quan.
result: [pending]

### 5. Lưu vào Sổ theo dõi và Xuất Excel (Tab 3)
expected: Bấm "Lưu vào Sổ theo dõi" tự động chuyển sang Tab 3 với bảng 14 cột chuẩn. Bấm "Xuất Excel Sổ theo dõi" tải về tệp Excel định dạng chuẩn mẫu với tên SO_THEO_DOI_PHAN_BO_[TÊN_SÀ_LAN].xlsx.
result: [pending]

## Summary

total: 5
passed: 0
issues: 0
pending: 5
skipped: 0
blocked: 0

## Gaps
