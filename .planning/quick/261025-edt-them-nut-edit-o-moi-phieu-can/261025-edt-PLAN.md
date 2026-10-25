---
phase: quick
plan: 261025-edt
type: execute
wave: 1
depends_on: []
files_modified:
  - src/components/tools/WarehouseInventoryManager.vue
autonomous: true
must_haves:
  truths:
    - "Mỗi dòng phiếu cân ở tất cả các bảng chi tiết (IMPORT, EXPORT, XÁ THẲNG ở cả Kho 4 và Gỗ Bình Định) đều có nút Sửa (icon edit) bên cạnh nút Xóa."
    - "Bấm nút Sửa mở modal chỉnh sửa đầy đủ thông tin phiếu cân (Số phiếu, Biển số xe, Ngày báo cáo, Giờ vào/ra, Trọng lượng Gross/Tare/Net, Cân nhà máy, Kho, Nơi nhận, Sà lan, Tàu, Nhà xe, Ghi chú)."
    - "Lưu phiếu cân cập nhật tức thì vào bộ nhớ và đồng bộ xuống cơ sở dữ liệu/IndexedDB."
---

<objective>
Thêm nút Edit (chỉnh sửa) tại mỗi phiếu cân trong Quản Lý Tồn Kho 4 Kho (`WarehouseInventoryManager.vue`), kèm Modal chỉnh sửa đầy đủ các trường của phiếu cân.
</objective>

<tasks>
<task type="auto">
  <name>Task 1: Thêm modal chỉnh sửa phiếu cân và nút Edit ở 6 bảng chi tiết phiếu</name>
  <files>src/components/tools/WarehouseInventoryManager.vue</files>
  <action>
    - Thêm `showEditTicketModal`, `editingTicketForm`, `openEditTicketModal(t)`, `saveEditTicketModal()`, `onModalGrossOrTareChange()` và `handleDeleteFromEditModal()`.
    - Cập nhật cột Thao tác (header `Thao tác`, w-20) có cả 2 nút: Edit (xanh) và Delete (đỏ) ở 6 bảng chi tiết:
      1. Tab IMPORT - GBD (Kho 1-2-3)
      2. Tab IMPORT - Kho 4
      3. Tab EXPORT - GBD (Kho 1-2-3)
      4. Tab EXPORT - Kho 4
      5. Tab DIRECT - GBD
      6. Tab DIRECT - Kho 4
    - Thêm Modal `Edit Ticket Details` với giao diện chuyên nghiệp, hỗ trợ tự tính Net = Gross - Tare, lưu dữ liệu thông qua `WarehouseInventoryService.updateTicket`.
  </action>
  <verify>Chạy `npm test` và `npm run build` không lỗi biên dịch.</verify>
  <done>Nút edit xuất hiện ở từng dòng phiếu cân và modal sửa hoạt động chính xác.</done>
</task>
</tasks>
