---
title: Cập nhật trang Tài liệu hướng dẫn (DocumentsView.vue) theo quy trình nhập và kiểm tra số liệu thực tế
date: 2026-11-11
priority: high
---

# Cập nhật trang DocumentsView.vue

## Mục tiêu
Thay thế cấu trúc tài liệu hướng dẫn cũ trên trang web (`/documents` - `src/views/DocumentsView.vue`) bằng quy trình nghiệp vụ 4 bước chuẩn hóa thực tế dành cho nhân viên.

## Nội dung chi tiết cần cập nhật
1. **Bước 1: Khởi tạo Lệnh (Tạo Nguồn Tàu - Vessel Source):**
   - Hướng dẫn truy cập *Workspace > Tạo Nguồn Tàu*.
   - Khai báo Tàu mẹ, Khách hàng, Loại hàng hóa.
   - Khai báo danh sách Sà lan tiếp nhận kèm Mã lệnh/Order.
2. **Bước 2: Nạp dữ liệu cân xe (Dữ liệu cân):**
   - Hướng dẫn vào *Workspace > Dữ liệu cân*.
   - Hướng dẫn nạp file Excel File 1 (Nhập kho/nhập thẳng) & File 2 (Xuất kho/xuất thẳng sà lan).
3. **Bước 3: Kiểm tra & Đối soát số liệu:**
   - Chuyển sang *Báo cáo tồn kho* và *Báo cáo cân hàng*.
   - Kiểm tra độ lệch khối lượng Net / Tổng / Bì.
   - Cảnh báo quy tắc: Phát hiện lỗi bắt buộc báo Admin để điều chỉnh, không tự ý chỉnh sửa sai lệch dữ liệu.
4. **Bước 4: Kết thúc quy trình & Báo cáo:**
   - Xuất file Excel báo cáo chính thức.
   - Tạo và gửi ảnh báo cáo tồn kho lên nhóm Zalo điều hành.

## File liên quan
- `src/views/DocumentsView.vue`
