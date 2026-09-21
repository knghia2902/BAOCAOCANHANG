---
title: Quy trình đồng bộ trực tiếp Phiếu cân sang Sà lan và Sổ theo dõi
date: 2026-09-21
context: Quyết định loại bỏ tab Phân bổ trong Dữ liệu cân hàng (gsd-explore)
---

# Quy trình đồng bộ trực tiếp Phiếu cân sang Sà lan và Sổ theo dõi

## 1. Mục tiêu kiến trúc
Loại bỏ hoàn toàn bước tính toán phân bổ tải trọng trung gian (Tab 2 cũ). Dữ liệu phiếu cân thực tế sau khi import được dùng trực tiếp cho hai mục đích độc lập:
1. Đồng bộ vào từng Sà lan tương ứng bên Báo cáo tổng quan.
2. Lưu trữ vào Sổ theo dõi xếp hàng (Tab 2 mới) để làm lịch sử theo dõi.

## 2. Luồng nghiệp vụ chuẩn (3 bước)
`
[1. File Excel/CSV gốc] 
        │ (Import)
        ▼
[Tab 1: Phiếu cân] ────────────────────────┐
   (Lưu trữ sẵn sàng)                       │
        │                                  │
        │ (Đồng bộ từng sà lan)             │ (Lưu vào sổ theo dõi)
        ▼                                  ▼
[Báo cáo tổng quan -> Sà lan]      [Tab 2: Sổ theo dõi]
 (Lọc theo Mã lệnh orderNo)         (Lưu DB & Xóa sạch Tab 1)
`

- **Bước 1: Import phiếu cân tại Tab 1 (Dữ liệu cân hàng)**:
  - Người dùng tải lên file danh sách phiếu cân.
  - Dữ liệu hiển thị tại Tab 1 và được lưu trữ vào cache/cloud (llocator_tickets).

- **Bước 2: Đồng bộ vào từng Sà lan (Báo cáo tổng quan)**:
  - Người dùng vào Báo cáo tổng quan, chọn từng sà lan cần nhận hàng.
  - Bấm Đồng bộ từ Dữ liệu cân hàng: Hệ thống tự động so khớp arge.config.orderNo với cột orderNo trong danh sách phiếu cân import để đưa đúng các xe vào sà lan đó.
  - Quá trình đồng bộ là hoàn toàn độc lập, không thay đổi hay xóa dữ liệu ở Tab 1.

- **Bước 3: Lưu vào Sổ theo dõi và Dọn dẹp**:
  - Sau khi đã đồng bộ hết các sà lan trong ngày, người dùng quay lại Tab 1 bấm nút Lưu vào Sổ theo dõi.
  - Toàn bộ phiếu cân hiện tại ở Tab 1 được chuyển vào bảng weighbridge_tracking.
  - Dữ liệu tại Tab 1 được xóa sạch để sẵn sàng cho ngày làm việc tiếp theo.

## 3. Tiêu chí dữ liệu đồng nhất
- Tab 2 (Sổ theo dõi) hiển thị bảng và xuất Excel với cấu trúc cột tương đồng 100% với file gốc import ở Tab 1:
  1. STT
  2. Số phiếu (	icketNo)
  3. Mã lệnh (orderNo)
  4. Số xe (plateNumber)
  5. Khách hàng (customer)
  6. Loại hàng (cargoType)
  7. Trọng lượng 1 (weight1)
  8. Trọng lượng 2 (weight2)
  9. Khối lượng hàng (weightNet)
  10. Thời gian vào (dateIn / 	imeIn)
  11. Thời gian ra (dateOut / 	imeOut)
  12. Tên sà lan (argeName)
  13. Tài xế (driverName)
  14. Ghi chú (
otes)
