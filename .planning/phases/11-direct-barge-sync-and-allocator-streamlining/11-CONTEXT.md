# Phase 11: Direct Barge Sync & Allocator Streamlining - Context

## Domain
Báo cáo tổng quan (WeighbridgePrinter) & Dữ liệu cân hàng (CargoAllocator)

## Locked Decisions
- **Bỏ Tab Phân bổ**: Không còn sinh các chuyến xe chia nhỏ hoặc chạy thuật toán phân bổ tải trọng (generatedTrips). Giao diện Dữ liệu cân hàng chỉ còn 2 tab:
  1. Tab 1: Phiếu cân (csvRecords)
  2. Tab 2: Theo dõi (existingTrips / weighbridge_tracking)
- **Loại bỏ cấu hình phân bổ không cần thiết**: Ẩn/xóa bỏ 2 card ở đầu trang: Quy tắc phân bổ (chiến lược chia, định thời gian, giãn cách) và Cấu hình tải trọng xe (TTTP, giới hạn tải trọng). Giữ lại thẻ cấu hình chung (mẫu số, số serial...).
- **Đồng bộ Sà lan trực tiếp từ Phiếu cân import**:
  - Tại Báo cáo tổng quan (WeighbridgePrinter.vue), khi đồng bộ sà lan (hàm syncFromAllocatorActiveBarge / syncFromAllocator), hệ thống đọc trực tiếp từ llocator_tickets (dữ liệu phiếu cân import từ Tab 1).
  - Lọc theo orderNo trùng khớp giữa arge.config.orderNo và phiếu cân 	icket.orderNo (không phân biệt hoa thường).
  - Map trực tiếp các trường sang model Truck.
  - Hành động đồng bộ không thay đổi hay xóa dữ liệu ở Tab 1.
- **Lưu vào Sổ theo dõi độc lập & Reset Tab 1**:
  - Thêm nút Lưu vào Sổ theo dõi ngay trên thanh công cụ của Tab 1 Phiếu cân.
  - Khi người dùng bấm lưu: Lưu toàn bộ phiếu cân Tab 1 vào bảng weighbridge_tracking.
  - Sau khi lưu thành công: Xóa sạch danh sách phiếu cân ở Tab 1 (reset csvRecords về rỗng, xóa file đính kèm, cập nhật cloud/IndexedDB).
- **Chuẩn hóa form Tab 2 (Sổ theo dõi)**:
  - Bảng hiển thị và file xuất Excel của Tab 2 sử dụng các cột/tiêu chí giống hệt form gốc import ở Tab 1 (Số phiếu, Mã lệnh, Số xe, Khách hàng, Loại hàng, TL1, TL2, Khối lượng hàng, Giờ vào, Giờ ra, Sà lan, Tài xế, Ghi chú).

## Requirements Addressed
- SYNC-DIRECT-01: Bỏ tab Phân bổ, giao diện còn 2 tab (Phiếu cân, Theo dõi).
- SYNC-DIRECT-02: Bỏ thẻ Quy tắc phân bổ và Cấu hình tải trọng xe.
- SYNC-DIRECT-03: Đồng bộ Sà lan tại Báo cáo tổng quan đọc trực tiếp từ Phiếu cân import theo Mã lệnh.
- SYNC-DIRECT-04: Nút Lưu vào Sổ theo dõi ở Tab 1, lưu độc lập và xóa sạch Tab 1 sau khi lưu.
- SYNC-DIRECT-05: Tab 2 Theo dõi dùng form tiêu chí giống hệt file gốc import ở Tab 1.
