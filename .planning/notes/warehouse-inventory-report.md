---
title: "Quy tắc nghiệp vụ Báo cáo Tồn Kho 4 Kho Hàng Sáng"
date: "2026-10-21"
context: "Khám phá giải pháp tự động hóa báo cáo tồn kho hàng sáng cho 4 kho tại Cảng Nguyên Ngọc từ dữ liệu Weight List trạm cân"
---

# Quy tắc nghiệp vụ Báo cáo Tồn Kho 4 Kho Hàng Sáng

## 1. Hạ tầng Kho & Khách hàng
- Cảng có **4 kho**: `KHO 1`, `KHO 2`, `KHO 3`, `KHO 4`.
- Khách hàng tương ứng được xác định từ cột `Khach hang` trên phiếu cân (ví dụ: *CÔNG TY EASTWOOD ENERGY*, *CTY GỖ BÌNH ĐỊNH*, *CÔNG TY CP NHIỆT XANH*...).
- Tên khách hàng có thể thay đổi qua lại trong Kho 1, 2, 3 theo từng thời điểm, nhưng **lịch sử tồn kho của mỗi kho được cộng dồn xuyên suốt**, không cắt/chuyển lô khi đổi khách hàng.

## 2. Nguồn dữ liệu & Quy tắc phân loại từ Weight List (CSV/Excel trạm cân)
- Trạm cân xuất 2 file riêng (file Nhập kho và file Xuất hàng) có chung cấu trúc cột chuẩn:
  `So phieu, Ma lenh, So xe, Khach hang, KL can lan 1, KL can lan 2, KL hang, Ngay can lan 1, Gio can lan 1, Ngay can lan 2, Gio can lan 2, Xuat/Nhap, Loai Hang, Loai Salan, Tai Xe, Ghi Chu`
- **Quy tắc phân loại 3 luồng hàng:**
  1. **Nhập kho (`IMPORT`):**
     - Điều kiện: `Xuat/Nhap = Nhap` VÀ `Loai Salan` thuộc `KHO 1`, `KHO 2`, `KHO 3`, `KHO 4`. *(Lưu ý: Các dòng `Nhap` có `Loai Salan` là tên sà lan như Bắp của De Heus sẽ bị bỏ qua, không tính vào tồn kho).*
     - Ý nghĩa các cột:
       - `Loai Salan`: Kho nhận hàng (`KHO 1..4`).
       - `Tai Xe`: Nhà máy sản xuất / Nguồn hàng trước khi nhập cảng (ví dụ: `CHƠN THÀNH`, `CT02`, `GREENWOOD`...) -> đưa vào cột `Ghi chú` của sheet `IMPORT`.
       - `Ghi Chu`: Trọng lượng cân tại nhà máy (`Cân Nhà Máy`) -> dùng để tính `Chênh lệch = KL hàng - Cân Nhà Máy`.
       - `Nhà xe`: Tra cứu theo biển số xe (`So xe`) từ danh mục `Data` (ví dụ: `TTP`, `LQP`, `Gia Phúc`...).
     - Tác động tồn kho: **+ Cộng** vào lượng nhập trong ngày của Kho tương ứng.
  2. **Xuất từ kho (`EXPORT`):**
     - Điều kiện: `Xuat/Nhap = Xuat` VÀ `Tai Xe` thuộc `KHO 1`, `KHO 2`, `KHO 3`, `KHO 4`.
     - Ý nghĩa các cột:
       - `Tai Xe`: Kho xuất hàng (`KHO 1..4`).
       - `Loai Salan`: Tên sà lan & Số lệnh xuất (ví dụ: `5- SG 7749 - LXH Số:2026/T25/NN`).
       - `Tàu`: Tên tàu mẹ (ví dụ: `OCEAN GALAXY`, `FORTUNE TWIN`...), tự động ánh xạ từ Sà lan / Mã lệnh (`Ma lenh`) trên hệ thống Báo cáo tổng quan.
     - Tác động tồn kho: **- Trừ** khỏi lượng tồn của Kho tương ứng.
  3. **Đi thẳng / Xá thẳng (`ĐI THẲNG` / `XÁ THẲNG`):**
     - Điều kiện: `Xuat/Nhap = Xuat` VÀ `Tai Xe` **không phải** `KHO 1..4` (ví dụ: `CHƠN THÀNH`, `CT04`, `BKTH`, `VÁN`, `KHÔNG VÁN`...).
     - Ý nghĩa các cột: Xe chở thẳng từ nhà máy hoặc cont xuống sà lan, không qua kho.
     - Tác động tồn kho: **Không cộng/trừ tồn kho**, nhưng được ghi nhận vào sheet `ĐI THẲNG` / `XÁ THẲNG` và tổng hợp theo ngày vào cột `Xá thẳng` trên bảng `FINAL` (đối với mẫu báo cáo có cột Xá thẳng như Kho 4).

## 3. Quy tắc chốt Ngày báo cáo (Ca 6h sáng hôm trước -> 6h sáng hôm nay)
- Thời gian chốt báo cáo ngày gửi khách mỗi buổi sáng được tính theo **Thời gian cân ra (`Ngay can lan 2` + `Gio can lan 2`) từ 06:00 sáng hôm trước đến 05:59:59 sáng hôm nay**.
- Hệ thống tự động quy đổi **Ngày báo cáo (`Report Date`)**:
  - Nếu `Gio can lan 2 < 06:00:00`, `Report Date = Ngay can lan 2 - 1 ngày`.
  - Nếu `Gio can lan 2 >= 06:00:00`, `Report Date = Ngay can lan 2`.

## 4. Quy trình vận hành 1 chạm & Cấu trúc Báo cáo xuất ra
- **Khởi tạo lịch sử ("Nạp từ file Excel Báo cáo Tồn kho đang dùng"):** Cho phép upload các file Excel báo cáo tồn kho hiện tại (`WL GỖ NÉN_KHO 4...xlsx`, `WEIGHT LIST GỖ NÉN_KHO NGUYÊN NGỌC_GBD...xlsx`) để hút toàn bộ lịch sử `IMPORT`, `EXPORT`, `ĐI THẲNG`, danh mục `Data (Nhà xe)`, và mốc `Tồn đầu` của cả 4 kho lên Supabase.
- **Import 1 lần tại Tồn Kho:** Mỗi sáng người dùng import file CSV Nhập và CSV Xuất tại màn hình Tồn Kho:
  - Tự động phân loại vào `IMPORT`, `EXPORT`, `ĐI THẲNG` của 4 kho.
  - Đồng thời tự động đồng bộ các chuyến `Xuat` sang `allocator_tickets` / Sà lan tương ứng bên **Dữ liệu cân hàng & Báo cáo tổng quan** để không phải import 2 lần.
- **Đầu ra báo cáo mỗi sáng:**
  1. **Bảng tổng hợp `FINAL` trên giao diện Web (hỗ trợ chụp/copy ảnh gửi Zalo):**
     - Hiển thị bảng `FINAL` theo từng Kho (Kho 1, Kho 2, Kho 3, Kho 4) hoặc chế độ ghép ngang Kho 1-2-3.
     - Công thức cộng dồn xuyên suốt: `Tồn cuối (Hôm nay) = Tồn cuối (Hôm trước) + Nhập (Hôm nay) - Xuất (Hôm nay)`.
  2. **Xuất file Excel Báo cáo Tồn kho (`.xlsx`):**
     - Giữ nguyên cấu trúc multi-sheet chuẩn: `IMPORT`, `EXPORT`, `FINAL`, `ĐI THẲNG` (hoặc `XÁ THẲNG`), `Data` với đầy đủ công thức `SUMIFS` / `SUMIF` và `SUBTOTAL`.
