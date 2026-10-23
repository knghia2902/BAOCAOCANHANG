---
title: Chuẩn hóa mẫu phiếu cân toàn cảng và kế thừa thông tin từ Nguồn tàu
date: 2026-10-23
priority: high
status: pending
---

# Chuẩn hóa mẫu phiếu cân toàn cảng & Kế thừa thông tin Nguồn tàu

## Bối cảnh
Trước đây, cấu hình mẫu phiếu cân (`printElements`, `printFields`,...) và các thông tin đối tác hàng hóa (`owner`, `goods`, `goodsCode`) được lưu riêng rẽ trong từng sà lan (`barge.config`). Cần chuyển sang mô hình 1 mẫu phiếu in chuẩn duy nhất đặt tại Báo cáo cân hàng và kế thừa 100% Khách hàng, Loại hàng, Mã hàng từ Nguồn tàu.

## Danh sách công việc chi tiết

### 1. Database & Service Layer
- [ ] Cập nhật bảng `weighbridge_vessels` (hoặc mở rộng schema/migration) để lưu 3 trường cố định: `customer` (hoặc `owner`), `cargo_type` (hoặc `goods`), `cargo_code` (hoặc `goods_code`).
- [ ] Xây dựng lưu trữ Master Data cho danh mục Khách hàng, Loại hàng, Mã hàng (lưu trong `content.settings` hoặc bảng Master Data riêng).
- [ ] Xây dựng API/Service lưu và đọc Mẫu phiếu cân chuẩn toàn cảng (`getGlobalTicketTemplate()`, `saveGlobalTicketTemplate()`).
- [ ] Cập nhật `WeighbridgeService`:
  - Khi lấy dữ liệu sà lan hoặc in phiếu, tự động map `owner`, `goods`, `goodsCode` từ Nguồn tàu mẹ của sà lan đó.
  - Sử dụng layout từ Mẫu phiếu in chuẩn toàn cảng thay vì layout riêng trong từng `barge.config`.

### 2. Giao diện Báo cáo cân hàng (WeighbridgePrinter.vue)
- [ ] Thêm nút **"Cấu hình mẫu phiếu chuẩn toàn cảng"** (kèm icon) trên thanh công cụ/header của Báo cáo cân hàng.
- [ ] Khi bấm nút, mở modal chỉnh sửa mẫu phiếu cân (kéo thả tọa độ, tùy chỉnh trường in, font chữ, dòng chữ ký) tác động trực tiếp vào Mẫu chuẩn toàn cảng.
- [ ] Loại bỏ nút/modal cấu hình layout mẫu phiếu in riêng rẽ bên trong từng sà lan.

### 3. Giao diện Quản lý Nguồn tàu (Vessel Dialog & Modal)
- [ ] Nâng cấp modal "Thêm tàu mới" và "Sửa thông tin tàu":
  - Tích hợp bảng chọn/dropdown Khách hàng, Loại hàng, Mã hàng từ danh mục Master Data chuẩn.
  - Hỗ trợ thêm nhanh mục mới vào Master Data nếu chưa có trong danh mục.
- [ ] Khóa chỉnh sửa 3 trường Khách hàng, Loại hàng, Mã hàng trên giao diện sà lan con (hiển thị dạng Read-only kế thừa từ Tàu mẹ).
