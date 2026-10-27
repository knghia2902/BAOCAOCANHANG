---
phase: quick
plan: 261027-uiy
type: execute
wave: 1
depends_on: []
files_modified:
  - src/types/excel.ts
  - src/services/excel/WarehouseInventoryService.ts
  - src/components/tools/WarehouseInventoryManager.vue
  - src/services/excel/__tests__/WarehouseInventoryService.spec.ts
autonomous: true
must_haves:
  truths:
    - "Re-importing the exact same CSV/Excel file does not create duplicate tickets and preserves user-edited fields (vesselName, factoryWeight, rawNote)"
    - "Importing a daily CSV/Excel file containing tickets already imported via Historical Excel (_rowNum ID vs _HH:mm:ss ID) merges them without creating duplicate rows"
    - "Re-importing a Historical Excel workbook after row numbers shift merges existing tickets by soPhieu instead of duplicating them"
    - "Re-importing a corrected CSV row whose flowType/warehouseId changed (e.g. DIRECT -> EXPORT KHO 4) replaces the old misclassified ticket ID and removes the obsolete ID from storage"
    - "Tickets without soPhieu (excluding XECLEAR adjustments) are deduplicated by flowType + warehouseId + reportDate + vehiclePlate + netWeight + weighOutTime"
    - "WarehouseImportSummary reports newCount and duplicateCount accurately"
---

<objective>
Kiểm thử và nâng cấp toàn diện cơ chế quét trùng lặp (Duplicate Detection & Smart Merge) của Báo Cáo Tồn Kho (`WarehouseInventoryService.ts` & `WarehouseInventoryManager.vue`).
</objective>

<tasks>

<task type="auto">
  <name>Task 1: Nâng cấp cơ chế quét trùng lặp đa tầng trong WarehouseInventoryService</name>
  <files>src/types/excel.ts, src/services/excel/WarehouseInventoryService.ts, src/components/tools/WarehouseInventoryManager.vue</files>
  <action>
    1. Bổ sung `newCount?: number` và `duplicateCount?: number` vào `WarehouseImportSummary` trong `src/types/excel.ts`.
    2. Xây dựng hàm `findMatchingExistingTicket` và `mergeDuplicateTicket` trong `WarehouseInventoryService.ts`:
       - Khớp theo `id` chính xác.
       - Khớp theo `soPhieu` (với phiếu cân thật không phải dòng `Clear chênh lệch` / `XE_CLEAR`) bất kể khác hậu tố ID giữa file Lịch sử Excel (`_rowNum`), file CSV trạm cân (`_HH:mm:ss`), hay phiếu khuyết giờ (`_00:00:00`), hoặc phiếu bị phân loại nhầm luồng (`DIRECT` sang `EXPORT`).
       - Khớp dự phòng cho phiếu không có `soPhieu` (dựa trên `flowType + warehouseId + reportDate + normalizePlateKey(vehiclePlate) + netWeight + weighOutTime`).
       - Khi gộp phiếu trùng lúc import (`preserveExistingFields: true`), giữ nguyên các thông tin người dùng đã chỉnh sửa/bổ sung trên web (`factoryWeight`, `vesselName`, `bargeInfo`, `originWarehouseName`, `originArea`, `rawNote`, `weighInTime`, `weighOutTime`) nếu bản ghi mới bị trống, đồng thời xóa `existingId` cũ khỏi IndexedDB và Supabase nếu ID thay đổi.
    3. Hiển thị số lượng phiếu mới và phiếu trùng đã gộp trong thông báo Toast tại `WarehouseInventoryManager.vue`.
  </action>
  <verify>npx vue-tsc -b</verify>
  <done>TypeScript biên dịch không lỗi, logic quét trùng hoạt động trên cả `getAllTickets`, `saveTicketsBulk`, `importWeighbridgeCsvFiles` và `importHistoricalExcelWorkbook`.</done>
</task>

<task type="auto">
  <name>Task 2: Viết bộ Unit Test toàn diện cho 6 kịch bản quét trùng lặp Báo cáo tồn kho</name>
  <files>src/services/excel/__tests__/WarehouseInventoryService.spec.ts</files>
  <action>
    Bổ sung suite test `Duplicate Scanning & Smart Deduplication` kiểm thử:
    1. Import lặp lại cùng 1 file CSV trạm cân -> không nhân đôi bản ghi, báo đúng `newCount` và `duplicateCount`, giữ nguyên `factoryWeight` / `vesselName` đã sửa tay.
    2. Import giao thoa giữa file Lịch Sử Excel (ID hậu tố `_rowNum`) và file CSV hàng ngày (ID hậu tố `_HH:mm:ss`) có cùng `soPhieu` -> tự động nhận diện trùng, gộp dữ liệu và giữ nguyên số lượng bản ghi.
    3. Import lại file Lịch Sử Excel khi số dòng (`_rowNum`) bị lệch do chèn thêm dòng -> không tạo bản ghi trùng lặp.
    4. Import lại phiếu cân sau khi sửa cột bị lệch (từ `DIRECT` sang `EXPORT KHO 4` cùng `soPhieu`) -> tự động thay thế bản ghi `DIRECT` cũ bằng `EXPORT KHO 4` mới.
    5. Import trùng lặp ngay trong cùng 1 file CSV (2 dòng giống hệt nhau trong cùng 1 file) -> tự động gộp chỉ còn 1 bản ghi.
    6. Import phiếu không có `soPhieu` nhưng trùng `Biển số + Ngày + Khối lượng + Giờ cân` -> tự động chặn trùng, trong khi vẫn cho phép nhiều dòng `Clear chênh lệch` (`XE_CLEAR`) khác nhau.
  </action>
  <verify>npm test -- --run</verify>
  <done>Toàn bộ unit tests pass 100%.</done>
</task>

</tasks>
