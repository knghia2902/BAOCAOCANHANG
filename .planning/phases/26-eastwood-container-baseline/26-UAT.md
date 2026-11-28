---
status: testing
phase: 26-eastwood-container-baseline
source: 26-01-SUMMARY.md
started: 2026-11-28T15:33:00+07:00
updated: 2026-11-28T15:33:00+07:00
---

## Current Test

number: 5
name: Import phiếu cân từ ngày 26/11/2026 tự động cập nhật trạng thái & báo cáo ca
expected: |
  Import file phiếu cân hàng ngày từ 26/11/2026 (có Hạ Cont, Load Cont, Lấy Cont Rỗng của Eastwood) → Trạng thái bãi tự đổi trạng thái cont theo ngày giờ thực tế, REPORT cộng đúng theo ngày báo cáo ca 06:00 sáng, và không làm sai lệch số liệu Kho 4 / Đi thẳng.
awaiting: user response

## Tests

### 1. Hiển thị mục BÃI CONT và nút Nạp tồn đầu kỳ
expected: Mở Báo cáo Tồn kho → dưới nhánh EASTWOOD thấy mục con "BÃI CONT", bấm vào thấy 5 tab, 4 thẻ KPI và nút "Nạp tồn đầu kỳ".
result: pass

### 2. Nạp danh sách 782 Cont rỗng bằng file Excel/CSV 1 cột
expected: Bấm "Nạp tồn đầu kỳ" → chọn "Cont rỗng", ngày chốt 25/11/2026, upload file 1 cột mã cont → xem trước đúng số lượng cont hợp lệ → bấm Lưu → KPI "Cont rỗng (đã xá)" hiển thị 782 và không có cảnh báo lỗi.
result: pass

### 3. Nạp danh sách 122 Cont đã trả & đồng bộ Sơ đồ kho
expected: Bấm "Nạp tồn đầu kỳ" → chọn "Đã trả", upload file 122 cont đã trả → bấm Lưu → KPI hiển thị 0 Cont có hàng / 782 Cont rỗng / 122 Đã trả / 904 Tổng; mở Sơ đồ kho thấy ô Bãi Container tự cập nhật Cont rỗng = 782.
result: pass

### 4. Tồn đầu kỳ không làm nhiễu Báo cáo ngày (REPORT) & 3 tab chi tiết
expected: Mở tab "Báo cáo ngày (REPORT)" và 3 tab Hạ Cont / Load Cont / Trả Cont → không thấy 904 cont tồn đầu kỳ bị cộng vào phát sinh ngày.
result: pass

### 5. Import phiếu cân từ ngày 26/11/2026 tự động cập nhật trạng thái & báo cáo ca
expected: Import file phiếu cân hàng ngày từ 26/11/2026 (có Hạ Cont, Load Cont, Lấy Cont Rỗng của Eastwood) → Trạng thái bãi tự đổi trạng thái cont theo ngày giờ thực tế, REPORT cộng đúng theo ngày báo cáo ca 06:00 sáng, và không làm sai lệch số liệu Kho 4 / Đi thẳng.
result: issue
reported: "dữ liệu cân ngày 26/11 sau khi up lên, kiểm tra bên báo cáo tồn kho không khớp. Hệ thống chỉ đọc dữ liệu ở 1 trong 2 file nên thiếu dữ liệu. Có hạ cont và lấy cont rỗng nhưng cũng không được ghi nhận"
severity: blocker

## Summary

total: 5
passed: 4
issues: 0
pending: 1
skipped: 0

## Gaps

[none yet]
