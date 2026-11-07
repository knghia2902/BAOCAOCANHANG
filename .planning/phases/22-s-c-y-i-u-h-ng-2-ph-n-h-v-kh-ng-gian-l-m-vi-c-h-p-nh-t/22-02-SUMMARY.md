# Plan 22-02 Summary: Tách Tạo Nguồn Tàu Tinh Gọn & Cổng Nạp 2 File Cân

## Kết quả đạt được
- Xây dựng component `VesselSourceManager.vue`: Khai báo danh sách tàu mẹ, các hầm hàng, sà lan tiếp nhận (kèm mã lệnh OrderNo, định mức nhận, trạng thái khóa/mở) hoàn toàn tách biệt khỏi các bảng cân xe nặng nề.
- Xây dựng component `WeighbridgeDataImporter.vue`: Đóng vai trò là cổng tiếp nhận tập trung 2 file cân nguồn:
  * File 1: Cân xe chở xá thẳng xuống sà lan (tự động đưa vào `allocator_tickets`).
  * File 2: Cân xe nhập kho (tự động phân luồng sang `WarehouseInventoryService`).
- Thêm các lối tắt điều hướng thông minh (Action Chaining) sang Báo cáo tồn kho, Báo cáo tiến độ tàu và Phân bổ De Heus sau khi nạp.
