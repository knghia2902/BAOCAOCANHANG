---
title: "Chuẩn hóa Mẫu phiếu cân toàn cảng và Kế thừa thông tin Nguồn tàu Cảng Nguyên Ngọc"
date: "2026-10-23"
context: "Exploration session về việc đồng nhất 1 mẫu phiếu in chuẩn tại Báo cáo cân hàng và kế thừa 100% Khách hàng, Loại hàng, Mã hàng từ Nguồn tàu xuống Sà lan"
---

# Chuẩn hóa Mẫu phiếu cân toàn cảng & Kế thừa thông tin Nguồn tàu

## 1. Bối cảnh & Vấn đề giải quyết
Hiện tại trong Báo cáo tổng quan / Báo cáo cân hàng (`WeighbridgePrinter.vue`), cấu hình mẫu in phiếu cân (`printElements`, `printFields`, `ticketTitle`, `companyName`, `signatures`...) và các thông tin hàng hóa (`owner`, `goods`, `goodsCode`,...) đang lưu trữ cục bộ trên từng sà lan (`BargeConfig`).
- **Bất cập:**
  - Nhân viên phải chỉnh sửa cấu hình in lặp đi lặp lại trên từng sà lan.
  - Khi cần đổi font, viền, vị trí trường in hoặc người ký, không có cách nào cập nhật hàng loạt cho toàn cảng.
  - Thông tin khách hàng, loại hàng, mã hàng thường giống nhau cho toàn bộ sà lan trong cùng một chuyến tàu mẹ (nguồn tàu), nhưng hiện tại người dùng phải gõ thủ công hoặc copy qua lại giữa các sà lan, dễ dẫn đến sai sót, sai chính tả và thiếu nhất quán.

## 2. Kiến trúc giải pháp đã thống nhất

### A. Chuẩn hóa 1 Mẫu phiếu in toàn cảng duy nhất
- **Vị trí cấu hình:** Đặt nút chức năng **"Cấu hình mẫu phiếu chuẩn toàn cảng"** trực tiếp trên thanh công cụ/header của màn hình **Báo cáo cân hàng (Báo cáo tổng quan)**.
- **Phân quyền:** Chỉ tài khoản có quyền (Admin hoặc Quản lý trạm cân) mới có thể mở và lưu chỉnh sửa mẫu phiếu chuẩn.
- **Phạm vi áp dụng:** Mẫu phiếu chuẩn được lưu trữ tập trung tại bảng cài đặt hệ thống Supabase (`content.settings` hoặc `weighbridge_template_config`). Mọi sà lan thuộc Cảng Nguyên Ngọc khi in phiếu cân đều tự động sử dụng mẫu chuẩn này.
- **Loại bỏ:** Gỡ bỏ giao diện cấu hình mẫu in cục bộ bên trong từng sà lan, giúp giao diện sà lan gọn gàng, tránh nhầm lẫn.

### B. Quản lý Danh mục chuẩn (Master Data)
- Hệ thống duy trì bảng danh mục chuẩn sẵn gồm 3 thông tin cốt lõi:
  1. **Tên khách hàng / Chủ hàng** (`owner / customer`)
  2. **Loại hàng hóa** (`goods / cargoType`)
  3. **Mã hàng** (`goodsCode`)
- Cho phép người quản trị thêm/sửa/xóa danh mục hoặc thêm nhanh khi có đối tác/mặt hàng mới.

### C. Nguồn tàu là Nguồn chân lý duy nhất (Single Source of Truth)
- **Tạo / Sửa Nguồn tàu (Vessel):**
  - Khi tạo nguồn tàu mới (hoặc bấm sửa thông tin tàu), form sẽ hiển thị bảng chọn dropdown liên kết từ Master Data: chọn Tên khách hàng, Loại hàng, Mã hàng.
  - 3 thông tin này được lưu vào bản ghi của Nguồn tàu (`weighbridge_vessels`).
- **Kế thừa bắt buộc 100% xuống Sà lan:**
  - Tất cả các sà lan con thuộc Nguồn tàu sẽ **bắt buộc tuân thủ 100%** theo Nguồn tàu mẹ.
  - Trên giao diện Sà lan, 3 trường thông tin này ở chế độ chỉ đọc (Read-only) hoặc hiển thị nhãn cố định, không cho phép sà lan tự ý chỉnh sửa hay ghi đè (override).
  - Khi Nguồn tàu được cập nhật thông tin, toàn bộ phiếu cân và báo cáo của các sà lan trong tàu đó tự động đồng bộ theo thông tin mới.

### D. Trách nhiệm dữ liệu ở cấp Sà lan
- Cấp sà lan chỉ còn chịu trách nhiệm quản lý các thông tin động thực tế:
  - Tên sà lan, số thứ tự sà lan (`orderNo`).
  - Dải số phiếu cân (`ticketPrefix`, `ticketSeed`).
  - Danh sách các chuyến xe cân (`trucks`).
  - Kết luận kiểm định / chất lượng hàng hóa (`chinhpham`, `phupham`, `ketluan`).
  - Hồ sơ kỹ thuật sà lan và thông tin thuyền viên (nếu có).
