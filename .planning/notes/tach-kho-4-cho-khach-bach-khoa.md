---
title: "Kiến trúc tách kho 4 thành 2 phân hệ độc lập cho khách hàng Eastwood và Bách Khoa"
date: "2026-11-09"
context: "Mở rộng hệ thống Quản lý Tồn Kho Cảng Nguyên Ngọc khi Kho 4 có thêm khách Bách Khoa lưu trữ hàng song song cùng Eastwood"
---

# Kiến trúc tách Kho 4 cho khách hàng Eastwood và Bách Khoa

## 1. Bối cảnh & Mục tiêu
Trước đây, Kho 4 tại Cảng Nguyên Ngọc được thiết kế như một thực thể đơn nhất phục vụ riêng cho khách hàng Eastwood (với 1 bộ cấu hình tồn đầu kỳ, 1 bộ bảng Nhập/Xuất/Tồn và 1 file Excel báo cáo).

Hiện tại, Kho 4 tiếp nhận thêm khách hàng **Bách Khoa** cùng lưu hàng. Cần tách riêng toàn bộ báo cáo tồn kho, luồng phiếu cân và sơ đồ trực quan giữa 2 khách hàng mà không làm xáo trộn số liệu lịch sử của nhau.

## 2. Mô hình Thiết kế: 2 Kho Logic Độc Lập
Kho 4 được phân chia thành 2 phân hệ độc lập:
- **Kho 4 (Eastwood):** Kế thừa toàn bộ cấu hình tồn đầu kỳ, lịch sử nhập xuất và báo cáo hiện hữu.
- **Kho 4 (Bách Khoa):**
  - Tồn đầu kỳ ban đầu = **0 tấn** (hoặc cấu hình theo ngày chốt bắt đầu lưu hàng).
  - Cấu hình riêng biệt: `initialStock`, `initialDate`, `currentCustomer: 'BÁCH KHOA'`, `dailyRemarks`.
  - Bộ bảng tính toán Nhập / Xuất / Tồn (`FINAL`) tách biệt hoàn toàn.

## 3. Quy tắc Tự động Phân luồng Phiếu cân (Keyword-based Routing)
Khi nạp phiếu cân từ file trạm cân (Weight List) hoặc đồng bộ từ Supabase:
- **Điều kiện Kho 4:** Phiếu có kho liên quan là `KHO 4` (hoặc luồng Xá thẳng liên quan).
- **Phân luồng khách hàng dựa trên từ khóa trong trường `customerName`:**
  - **Bách Khoa:** Tên khách hàng chứa `BÁCH KHOA`, `BACH KHOA`, `BK`,...
  - **Eastwood:** Tên khách hàng chứa `EASTWOOD`, `EAST WOOD`, `EW`,... (mặc định cho các phiếu còn lại của Kho 4).
- Hỗ trợ đổi nhóm/khách hàng thủ công trên từng phiếu trong trường hợp tên khách hàng trên phiếu bị viết tắt dị biệt.

## 4. Định dạng Báo cáo & Xuất File Excel
Mỗi khách hàng xuất file Excel độc lập theo đúng quy chuẩn:
- **Eastwood:** File `WEIGHT LIST GỖ NÉN_KHO NGUYÊN NGỌC_EW_<DDMMYYYY>.xlsx` gồm các sheet `IMPORT 4`, `EXPORT 4`, `FINAL 4`.
- **Bách Khoa:** File `WEIGHT LIST GỖ NÉN_KHO NGUYÊN NGỌC_BK_<DDMMYYYY>.xlsx` gồm các sheet `IMPORT 4`, `EXPORT 4`, `FINAL 4` của riêng Bách Khoa với đầy đủ công thức tính toán `SUMIFS` và số dư lũy kế.

## 5. Sơ đồ Kho Trực quan (Warehouse Visual Map)
- Trên giao diện sơ đồ mặt bằng Kho 4 (2D/3D), quy hoạch **tách riêng một góc** khoang chứa dành riêng cho khách hàng Bách Khoa.
- Thể hiện màu sắc, khối lượng tồn và tên khách hàng trực quan trên từng ô/khoang hàng của góc này.
