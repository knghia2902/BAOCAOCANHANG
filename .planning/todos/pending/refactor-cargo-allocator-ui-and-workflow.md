---
title: Tái cấu trúc Dữ liệu cân hàng: Bỏ tab Phân bổ, đồng bộ form Sổ theo dõi theo form gốc
date: 2026-09-21
priority: high
status: pending
---

# Tái cấu trúc Dữ liệu cân hàng: Bỏ tab Phân bổ, đồng bộ form Sổ theo dõi theo form gốc

## Bối cảnh
Đơn giản hóa màn hình Dữ liệu cân hàng (CargoAllocator.vue) từ 3 tab xuống còn 2 tab, loại bỏ logic phân bổ tải trọng tự động, chuyển nút lưu sang Tab 1 và chuẩn hóa Tab 2 theo cấu trúc file import gốc.

## Yêu cầu kỹ thuật
- **Giao diện tab**:
  - Bỏ hoàn toàn Tab 2 (Phân bổ).
  - Chỉ giữ 2 tab:
    - Tab 1: 1. Phiếu cân (danh sách csvRecords).
    - Tab 2: 2. Theo dõi (Sổ theo dõi lưu trữ lịch sử các chuyến xe).
- **Phần cấu hình trên đầu trang**:
  - Bỏ thẻ Quy tắc phân bổ (chiến lược chia, định thời gian, giãn cách).
  - Bỏ thẻ Cấu hình tải trọng xe (TTTP, giới hạn tải trọng).
  - Giữ thẻ cấu hình chung (mẫu số, số serial...).
- **Nút Lưu vào Sổ theo dõi tại Tab 1**:
  - Đặt nút Lưu vào Sổ theo dõi tại thanh công cụ của Tab 1.
  - Khi người dùng bấm lưu: Chuyển toàn bộ phiếu cân ở Tab 1 lưu vào cơ sở dữ liệu bảng theo dõi (weighbridge_tracking).
  - Sau khi lưu thành công: Xóa sạch danh sách phiếu cân ở Tab 1 (reset csvRecords về rỗng, xóa file đang chọn, cập nhật Supabase / IndexedDB).
- **Chuẩn hóa form Tab 2 (Sổ theo dõi)**:
  - Bảng hiển thị của Tab 2 sử dụng các cột và tiêu chí giống hệt file gốc import ở Tab 1:
    - STT, Số phiếu, Mã lệnh, Số xe, Khách hàng, Loại hàng, TL1 (kg), TL2 (kg), Khối lượng (kg), Giờ vào, Giờ ra, Tên sà lan, Tài xế, Ghi chú.
  - Tính năng xuất Excel (compileAndDownload) của Tab 2 xuất theo đúng form chuẩn các cột này, bỏ các cột chia nhỏ cũ (TTTP, Giới hạn tải trọng...).
