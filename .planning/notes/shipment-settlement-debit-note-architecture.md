---
title: "Shipment Settlement & Debit Note Architecture"
date: "2026-11-11"
context: "Exploration session for automated Debit Note (DNTT 1 & 2), Barge Demurrage, and Multi-tier Fuel Price Matrix from Contract PL1"
---

# Shipment Settlement & Debit Note Architecture

## 1. Mục tiêu
Xây dựng phân hệ **Quyết toán Lô hàng & Đề nghị thanh toán (Debit Note)** tích hợp trong Không gian làm việc hợp nhất (`UnifiedWorkspaceView`), cho phép:
- Quản lý biểu giá Hợp đồng đa bậc biến động giá dầu (theo Hợp đồng số `01-2026/HDNT/GBD-TVPL` và Phụ lục 1).
- Khi kết thúc giao hàng cho tàu mẹ: người dùng chọn mức giá dầu thực tế (hoặc hệ thống tự tính giá dầu trung bình trong thời gian tàu làm hàng từ sheet `Giá dầu`), chọn các dịch vụ đưa vào DNTT (kèm số Hợp đồng/Phụ lục tương ứng).
- Người dùng nhập **Ngày đến cảng** và **Ngày rời phao** của từng sà lan. Hệ thống tự động tính số ngày lưu thực tế, số ngày vượt lưu, làm tròn theo quy tắc cảng biển (nấc 0.5 ngày và 1 ngày), và nhân đơn giá để ra tổng tiền lưu sà lan.
- Tự động bóc tách số liệu cân hàng ngày thành 2 bảng Weightlist theo nghiệp vụ: `EXPORT XUẤT KHO` (hàng xuất kho ra sà lan) và `WL XUẤT SALAN` (xe sang sà lan trực tiếp không qua kho), kèm bảng kê xe tải `TRUCK`.
- Tự động tạo bộ đôi **DNTT 1** (Xếp dỡ, sà lan, hải quan, lưu neo) & **DNTT 2** (Cước xe tải từ các kho/nhà máy về cảng) kèm số tiền bằng chữ song ngữ (Việt - Anh).
- Xuất 1 file Excel duy nhất chuẩn mẫu 8 sheet (như file `DNTT_WOOD PELLET_EPOCH WIND_NHA BE_GWE.xlsx`).

## 2. Ma trận Biểu giá Hợp đồng theo Bậc Giá Dầu (Contract PL1)
Dựa theo Phụ lục 1 hợp đồng `01-2026/HDNT/GBD-TVPL`:

### 2.1. Bảng 1: Dịch vụ Xếp dỡ & Sà lan ra Tàu Biển
Khung giá dầu Diesel DO Vùng 1 của Petrolimex chia thành 7 bậc:
1. `< 20,000 đ/lít`
2. `20,000 - 25,000 đ/lít`
3. `25,001 - 30,000 đ/lít` (Khung áp dụng của tàu EPOCH WIND)
4. `30,001 - 35,000 đ/lít`
5. `35,001 - 40,000 đ/lít`
6. `40,001 - 45,000 đ/lít`
7. `45,001 - 50,000 đ/lít`

Đơn giá theo từng nghiệp vụ (VND/tấn):
- **Nghiệp vụ 1 (Kho ra Phao Nhà Bè - cẩu tàu):** 165k / 175k / **181k** / 187k / 193k / 199k / 205k.
- **Nghiệp vụ 2 (Xe sang sà lan ra Phao Nhà Bè - cẩu tàu):** 125k / 132k / **136k** / 140k / 144k / 148k / 152k.
- **Nghiệp vụ 3 (Kho ra Phao Gò Gia - cẩu nổi):** 195k / 210k / 220k / 230k / 240k / 250k / 260k.
- **Nghiệp vụ 4 (Xe sang sà lan ra Phao Gò Gia - cẩu nổi):** 165k / 177k / 185k / 193k / 201k / 209k / 217k.
- **Phí Hải quan hàng xuất:** 3,500 đ/tấn (cố định).

### 2.2. Bảng 2: Cước Vận tải Đường bộ (Xe tải về Cảng)
Chia theo 10 tuyến đường/kho nhận hàng với 7 bậc giá dầu:
- Tuyến 1: Kho Bình Định (100k - 115k - 145k)
- Tuyến 2: Kho Xoan (100k - 115k - 145k)
- Tuyến 3: Kho Mậu / Bình Mỹ / Hội Nghĩa (105k - 120.6k - 151.8k)
- Tuyến 4: Phường Tân Hiệp (Kho Bảo, Hùng, Minh, Linh, Hào...) -> Bậc 25k-30k: **115,000 đ/tấn**
- Tuyến 5: Phường Tân Khánh (Kho Cúc, Ngọc...) -> Bậc 25k-30k: **115,000 đ/tấn**
- Tuyến 6: Phường Tân Uyên (Kho Chinh, Minh Khôi)
- Tuyến 7: Phường Vĩnh Tân (Kho Tuấn, Huyền, Hường)
- Tuyến 8: Xã Phước Hoà (Kho Nhung)
- Tuyến 9: Phường Đồng Xoài / Green Wood Bình Phước -> Bậc 25k-30k: **147,200 đ/tấn**
- Tuyến 10: Vận chuyển nội bộ giữa các kho trong Cảng Nguyên Ngọc: 18k - 20.6k - 26.6k.

## 3. Quy tắc Tính Bảng Kê Lưu Neo Sà Lan (Demurrage)
- **Số ngày thực hiện:** `Ngày rời phao - Ngày đến cảng` (tính đến số thập phân 1 chữ số).
- **Số ngày lưu cơ bản (miễn phí):** `7 ngày` (theo điều khoản hợp đồng).
- **Số ngày vượt lưu thô:** `Tổng ngày - 7`.
- **Quy tắc làm tròn cảng biển:**
  - Nếu `Vượt lưu <= 0`: Không tính (`"-"`).
  - Nếu `Vượt lưu > 0`: 
    - Lấy phần nguyên `INT(Vượt lưu)`.
    - Phần lẻ `d = Vượt lưu - INT(Vượt lưu)`:
      - Nếu `d == 0`: cộng 0.
      - Nếu `0 < d <= 0.5`: cộng 0.5 ngày.
      - Nếu `d > 0.5`: cộng 1.0 ngày.
    - Công thức Excel tương đương: `IF(H16>0, INT(H16) + IF(H16-INT(H16)>0.5, 1, IF(H16-INT(H16)=0, 0, 0.5)), "-")`
- **Đơn giá phạt lưu sà lan:** `3,000 đ/tấn/ngày`.
- **Thành tiền lưu phương tiện:** `Số ngày làm tròn × Đơn giá lưu × Khối lượng thực giao (tấn)`.

## 4. Cấu trúc File Excel Kết Xuất (8 Sheets)
1. `DNTT 1`: Đề nghị thanh toán dịch vụ cảng biển, xếp dỡ, hải quan, lưu sà lan (công thức VAT 8%, tiền bằng chữ song ngữ).
2. `DNTT 2`: Đề nghị thanh toán cước vận chuyển xe tải đường bộ (chi tiết theo xe và tuyến kho).
3. `Giá dầu`: Nhật ký giá dầu DO từng ngày trong thời gian làm hàng, tính giá bình quân.
4. `BK SALAN`: Bảng kê tổng hợp từng sà lan nhận hàng (khối lượng kg từ các phiếu cân).
5. `EXPORT XUẤT KHO`: Weightlist chi tiết các xe xuất từ kho ra sà lan.
6. `WL XUẤT SALAN`: Weightlist chi tiết các xe xuất trực tiếp từ xe sang sà lan.
7. `LƯU SÀ LAN`: Bảng tính chi tiết lưu neo phương tiện từng sà lan.
8. `TRUCK `: Bảng kê chi tiết các chuyến xe đường bộ chở hàng về cảng.

## 5. Định hướng Triển khai trên Web Local
- Phát triển và kiểm thử toàn diện trên môi trường local trước (`npm run dev`), đảm bảo tính toán khớp 100% với số liệu tàu `EPOCH WIND`.
- Tạo component `ShipmentSettlementModal.vue` (hoặc tab Quyết toán trong Báo cáo lô hàng) với giao diện trực quan, cho phép người dùng chọn dịch vụ, mức giá dầu, nhập ngày đến - rời của sà lan và xuất file Excel.
