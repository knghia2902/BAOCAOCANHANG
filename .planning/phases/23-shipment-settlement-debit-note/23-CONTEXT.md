---
title: "Phase 23 Context: Quyết toán Lô hàng & Đề nghị thanh toán (DNTT)"
phase: "23"
date: "2026-11-11"
status: "locked"
source: "GSD Explore Session with User, Sample Excel & Contract PL1"
---

# Phase 23 Context: Quyết toán Lô hàng, Đề nghị thanh toán (DNTT) & Bảng kê Lưu sà lan

## 1. Domain & Background
Trong phân hệ Báo cáo lô hàng (`UnifiedWorkspaceView` -> `report-shipment`), sau khi xuất hàng cho các sà lan xong, sà lan chạy ra phao Nhà Bè (hoặc Gò Gia) để cẩu hàng lên tàu mẹ (tàu quốc tế như `EPOCH WIND`). Khi kết thúc giao hàng, bộ phận CS/Điều độ cần tính tiền cho khách hàng và lập bộ chứng từ quyết toán kèm Đề nghị thanh toán (Debit Note), Bảng kê lưu neo sà lan, và các bảng Weightlist chi tiết chia theo từng nghiệp vụ.

## 2. Locked Decisions (Quyết định đã thống nhất với người dùng)

### 2.1. Ưu tiên Web Local trước
- Toàn bộ tính năng, bảng tính, logic giá và xuất Excel phải được xây dựng và kiểm thử hoàn chỉnh trên môi trường web local (`npm run dev`) với dữ liệu đối chiếu chuẩn của tàu `EPOCH WIND`.

### 2.2. Ma trận Biểu giá Hợp đồng (Contract Pricing Matrix)
- Lưu trữ danh mục Hợp đồng theo Khách hàng, bao gồm:
  - Thông tin hợp đồng: Số hợp đồng, số phụ lục, tên khách hàng, tên hàng hóa.
  - Bảng giá dịch vụ cảng biển & sà lan theo 7 bậc giá dầu Diesel DO Petrolimex Vùng 1:
    - Bậc 1: `< 20,000 đ/lít`
    - Bậc 2: `20,000 - 25,000 đ/lít`
    - Bậc 3: `25,001 - 30,000 đ/lít` (Khung áp dụng tàu EPOCH WIND)
    - Bậc 4: `30,001 - 35,000 đ/lít`
    - Bậc 5: `35,001 - 40,000 đ/lít`
    - Bậc 6: `40,001 - 45,000 đ/lít`
    - Bậc 7: `45,001 - 50,000 đ/lít`
  - Các nghiệp vụ dịch vụ cảng biển:
    - Nghiệp vụ 1: Xuất hàng XÁ từ kho Nguyên Ngọc - sà lan ra phao Nhà Bè - cẩu tàu (181,000 đ/tấn tại bậc 25k-30k).
    - Nghiệp vụ 2: Xuất hàng từ xe tải xuống sà lan (không qua kho) ra phao Nhà Bè - cẩu tàu (136,000 đ/tấn tại bậc 25k-30k).
    - Nghiệp vụ 3: Xuất kho Nguyên Ngọc - sà lan ra phao Gò Gia - cẩu nổi.
    - Nghiệp vụ 4: Xe xuống sà lan - sà lan ra phao Gò Gia - cẩu nổi.
    - Phí khai hải quan hàng xuất: 3,500 đ/tấn.
  - Bảng cước vận tải đường bộ theo 10 tuyến đường/kho nhận hàng (Kho Tân Hiệp 115k, Kho Tân Khánh 115k, Kho Đồng Xoài/Green Wood 147.2k...).
  - Định mức lưu sà lan: 7 ngày cơ bản miễn phí; đơn giá lưu vượt: 3,000 đ/tấn/ngày.

### 2.3. Bảng kê Lưu neo Phương tiện (LƯU SÀ LAN)
- Danh sách sà lan và tổng tấn thực giao/nhận lấy tự động từ danh sách sà lan của tàu mẹ.
- **Ngày đến cảng** và **Ngày rời phao**: do **người dùng nhập vào** trực tiếp trên bảng kê cho từng sà lan.
- Công thức tính toán:
  - `Tổng ngày thực hiện = Ngày rời phao - Ngày đến cảng` (làm tròn 1 chữ số thập phân).
  - `Số ngày cơ bản = 7 ngày`.
  - `Số ngày vượt lưu thô = Tổng ngày thực hiện - 7`.
  - `Làm tròn cảng biển`:
    - Nếu `vượt lưu <= 0`: ghi `"-"` (không tính phạt).
    - Nếu `vượt lưu > 0`: phần nguyên `intPart = Math.floor(vượt lưu)`, phần lẻ `frac = vượt lưu - intPart`.
      - Nếu `frac == 0`: 0.
      - Nếu `0 < frac <= 0.5`: 0.5 ngày.
      - Nếu `frac > 0.5`: 1.0 ngày.
      - Số ngày tính tiền = `intPart + fracRounded`.
  - `Đơn giá lưu`: 3,000 đ/tấn/ngày.
  - `Thành tiền = Số ngày tính tiền * 3,000 * Khối lượng thực giao (tấn)`.

### 2.4. Trình Lập Đề nghị thanh toán (DNTT 1 & DNTT 2)
- Bao gồm cả 2 bảng DNTT:
  - **DNTT 1**: Dịch vụ cảng, sà lan ra phao, hải quan, lưu sà lan.
  - **DNTT 2**: Cước xe tải đường bộ từ các nhà máy/kho vệ tinh về cảng.
- Người dùng chọn mức giá dầu áp dụng (kèm bảng nhập giá dầu DO hàng ngày để tính giá dầu bình quân).
- Người dùng chọn các dịch vụ cần quyết toán: mỗi dịch vụ tự động gắn số Hợp đồng / Phụ lục tương ứng.
- Đơn giá tự động nhảy theo cặp `[Dịch vụ] + [Mức giá dầu]`.
- Khối lượng tự động lấy từ dữ liệu cân chia theo nghiệp vụ.
- Tự động tính VAT 8% và dịch số tiền thành chữ song ngữ Việt - Anh.

### 2.5. Trình Xuất File Excel Trọn Gói 8 Sheet
- Xuất file `.xlsx` gồm đúng 8 sheet:
  1. `DNTT 1`
  2. `Giá dầu`
  3. `BK SALAN`
  4. `EXPORT XUẤT KHO`
  5. `WL XUẤT SALAN`
  6. `LƯU SÀ LAN`
  7. `DNTT 2`
  8. `TRUCK `
- Giữ nguyên toàn bộ cấu trúc bảng biểu, công thức Excel sống (`SUM`, `ROUND`, `SUBTOTAL`), định dạng màu sắc Cambria và chuẩn in ấn khổ A4 ngang/dọc như file mẫu `DNTT_WOOD PELLET_EPOCH WIND_NHA BE_GWE.xlsx`.
