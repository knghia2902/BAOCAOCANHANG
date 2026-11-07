---
status: complete
phase: 22-s-c-y-i-u-h-ng-2-ph-n-h-v-kh-ng-gian-l-m-vi-c-h-p-nh-t
source:
  - 22-01-SUMMARY.md
  - 22-02-SUMMARY.md
  - 22-03-SUMMARY.md
started: 2026-11-06T16:25:00Z
updated: 2026-11-07T03:18:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Sơ đồ cây điều hướng 2 phân hệ & Thu gọn/Mở rộng Sidebar
expected: Mở trang http://localhost:5173/workspace. Ở cột bên trái hiển thị Sơ đồ cây chia rõ 2 nhóm chính: "1. PHÂN HỆ" (Tạo nguồn tàu, Dữ liệu cân (2 file), nhánh con Báo cáo: Báo cáo tồn kho, Báo cáo lô hàng, Báo cáo Phân bổ De Heus, Quản lý hồ sơ phương tiện, Biên bản) và "2. DANH MỤC" (Danh sách xe, Danh sách khách hàng, Danh sách kho hàng, Danh mục hàng hóa). Khi bấm nút thu gọn (<<), sidebar thu nhỏ thành thanh icon gọn gàng để nhường toàn bộ không gian cho bảng dữ liệu bên phải.
result: pass

### 2. Tạo nguồn tàu (Tách độc lập khỏi bảng phiếu cân)
expected: Chọn mục "Tạo nguồn tàu" trên sơ đồ cây. Giao diện cho phép thêm tàu mẹ, khai báo các hầm hàng, thêm sà lan tiếp nhận (kèm Mã lệnh OrderNo, định mức nhận, trạng thái khóa/mở) gọn nhẹ và độc lập, không bị rối bởi bảng phiếu cân xe.
result: pass

### 3. Dữ liệu cân (Trạm nạp 2 file & 3 Tab như trước đây)
expected: Chọn mục "Dữ liệu cân (2 file)" trên sơ đồ cây. Hiển thị đầy đủ 3 tab ("1. Phiếu cân", "2. Sổ theo dõi", "3. Cân Kho & Container"). Ở đầu tab "1. Phiếu cân" có 2 ô nạp file: File 1 (Nhập hàng vào kho & Nhập thẳng từ sà lan tại Cảng về nhà máy) và File 2 (Xuất hàng từ kho xuống sà lan tại Cảng & từ nhà máy xuống sà lan tại Cảng), cùng bảng phiếu cân 17 cột (có cột Mã lệnh) và thanh công cụ chuẩn DESIGN.md (không còn nút Đồng bộ Lô hàng).
result: pass

### 4. Liên thông dữ liệu sang 3 Báo cáo (Tồn kho 4 kho, Lô hàng, Phân bổ De Heus)
expected: Sau khi nạp File 1 và File 2 tại mục Dữ liệu cân, chuyển sang "Báo cáo tồn kho" sẽ thấy các phiếu nhập/xuất kho & xá thẳng đã được phân loại vào 4 kho; chuyển sang "Báo cáo lô hàng" sẽ thấy các xe có cột "Ma lenh" tự động khớp vào sà lan có cùng Mã lệnh; chuyển đổi qua lại giữa các mục trên sơ đồ cây giữ nguyên trạng thái đang làm việc (nhờ KeepAlive).
result: pass

### 5. Quản lý 4 Danh mục nền tảng dùng chung
expected: Chọn lần lượt các mục trong nhóm "2. DANH MỤC" (Danh sách xe, Danh sách khách hàng, Danh sách kho hàng, Danh mục hàng hóa). Mỗi mục hiển thị bảng danh mục chuẩn DESIGN.md, hỗ trợ tìm kiếm, thêm mới, chỉnh sửa và xóa dữ liệu mượt mà.
result: pass

## Summary

total: 5
passed: 5
issues: 0
pending: 0
skipped: 0

## Gaps

[none yet]
