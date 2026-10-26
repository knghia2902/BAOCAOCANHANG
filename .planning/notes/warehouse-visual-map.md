---
title: "Sơ đồ trực quan Kho cảng Nguyên Ngọc (TVPL)"
date: "2026-10-26"
context: "Exploration session (/gsd-explore) từ hình mẫu TVPL - Sơ đồ kho cảng Nguyên Ngọc"
---

# Sơ đồ trực quan Kho cảng Nguyên Ngọc (TVPL)

## 1. Bối cảnh & Mục tiêu
Xây dựng bảng theo dõi trực quan (Visual Tracking Map) cho **Sơ đồ kho cảng Nguyên Ngọc** ngay trong phân hệ **Báo Cáo Tồn Kho 4 Kho** (`/tools/warehouse`), thay thế hoàn toàn thao tác vẽ/sửa thủ công các khối đa giác trên Excel/PowerPoint mỗi sáng.

## 2. Cấu trúc Mặt bằng 5 Phân khu
Sơ đồ gồm tiêu đề **"TVPL - Sơ đồ kho cảng Nguyên Ngọc"**, mốc thời gian cập nhật (VD: `Cập nhật số liệu đến 06h00, 26/10/2026`) và 5 cột tỷ lệ chuẩn:
1. **BÃI CONT:**
   - Nền cam nhạt (`#FDEBD0` / `#FADBD8`).
   - Hộp thống kê ở phía trên: `Cont có hàng`, `Cont rỗng`, `Total` (tự động cộng tổng).
2. **KHO 1 (`1,080 m²`):**
   - Chia làm **6 ô ngang** (đánh số `1` đến `6` từ dưới lên trên bên cạnh trái, vạch kẻ nét đứt ngang).
   - Cửa chính ở cạnh đáy, màu vùng hàng mặc định: Vàng nhạt (`#F9E79F` / `#FDE3A7`).
3. **KHO 2 (`1,980 m²`):**
   - Chia làm **11 ô ngang** (đánh số `1` đến `11` giữa Kho 2 và Kho 3).
   - Có cửa chính ở đáy và cửa phụ bên hông trái (khoảng ô 8–9), màu vùng hàng mặc định: Xanh dương (`#00ADEF`).
4. **KHO 3 (`1,980 m²`):**
   - Chia làm **11 ô ngang** (đánh số `1` đến `11`).
   - Có cửa chính ở đáy và cửa phụ bên hông phải (khoảng ô 10–11), màu vùng hàng mặc định: Xanh lá (`#00B050`).
5. **KHO 4 (`5,000 m²`):**
   - Chia làm **12 ô ngang** (đánh số `1` đến `12` bên cạnh phải).
   - Có cửa chính ở đáy, cửa phụ bên hông trái (khoảng ô 6–8), nhãn mũi tên **"Băng tải"** ở khu vực ô 5–6, màu vùng hàng mặc định: Vàng đậm (`#FFFF00`).

## 3. Cơ chế Tương tác & Dữ liệu
- **Liên kết tự động với Tồn Kho 4 Kho:**
  - Tự động lấy Tên khách hàng (`GỖ BÌNH ĐỊNH`, `EASTWOOD`), Mặt hàng (`VIÊN NÉN GỖ`) và Số tồn cuối kỳ mới nhất (`1,919.40 T`, `882.42 T`, `2,243.05 T`, `5,452.20 T`) từ dữ liệu `WarehouseInventoryService`.
  - Cho phép ghi đè (override) hoặc nhập tay nếu người chỉnh sửa muốn hiển thị con số tùy chỉnh.
- **Vẽ & Kéo thả Đa giác (Interactive SVG Polygon Editor):**
  - Mỗi kho hỗ trợ **1 hoặc nhiều khối đa giác (polygons)** để vừa vẽ được mảng hàng lớn có lối xe xúc đi vào (vát chéo như Kho 1, Kho 3 hoặc bậc thang vuông góc như Kho 2), vừa vẽ được các đống hàng lẻ nằm ở góc (như Kho 4 ở ô 1–2 và 3–4).
  - Trong chế độ chỉnh sửa: hiển thị các điểm nút (vertex handles) cho phép kéo thả, click đúp trên cạnh để thêm đỉnh mới, click chuột phải/nút xóa để bỏ đỉnh.
  - **Cơ chế bắt dính (Snapping):** Khi kéo đỉnh gần vạch kẻ ô (1..6, 1..11, 1..12), phần nửa ô (0.5), hoặc sát mép tường trái/phải/trên/dưới, tọa độ tự động hít (snap) vào lưới để hình vẽ luôn thẳng và vuông vức.
  - Các hộp thông tin (Tên khách hàng, Mặt hàng, Khối lượng) và ký hiệu phụ ("Băng tải") luôn nổi rõ trên lớp đa giác và có thể kéo chỉnh vị trí nếu cần.

## 4. Phân quyền & Lưu trữ
- **Lưu trữ:** Đồng bộ cấu hình sơ đồ (tọa độ đa giác các kho, số liệu Bãi Cont, thời điểm cập nhật) lên Supabase (kèm cache local) để mọi người truy cập đều thấy bản mới nhất.
- **Phân quyền (Role-based Access):**
  - **Chế độ Xem (View Mode - Mặc định cho tất cả người dùng):** Hiển thị sơ đồ sạch đẹp giống hệt hình báo cáo chuẩn, ẩn toàn bộ các điểm nút điều khiển. Có nút **Chụp / Copy ảnh sơ đồ** nét cao.
  - **Chế độ Chỉnh sửa (Edit Mode - Theo phân quyền):** Chỉ tài khoản có quyền cập nhật (`admin` / `canUpdate` hoặc quyền quản lý kho trong `authStore`) mới thấy nút **"Chỉnh sửa sơ đồ"** để kéo đỉnh đa giác, sửa số Cont, thêm/xóa cụm hàng và bấm **"Lưu sơ đồ"**.
