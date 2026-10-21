---
phase: 20-qu-n-l-b-o-c-o-t-n-kho-4-kho-h-ng-s-ng
plan: 01
status: completed
completed_at: "2026-10-21T20:05:00+07:00"
requirements_completed:
  - INV-01
  - INV-02
  - INV-03
files_modified:
  - database/migrations/20261021_create_warehouse_inventory.sql
  - src/types/excel.ts
  - src/services/excel/WarehouseInventoryService.ts
  - src/services/excel/__tests__/WarehouseInventoryService.spec.ts
---

# Plan 20-01 Summary: Database Schema, 6:00 AM Shift Cutoff & WarehouseInventoryService

## Accomplishments
1. **Database Schema & Cloud Fallback (`database/migrations/20261021_create_warehouse_inventory.sql` & `src/types/excel.ts`):**
   - Created SQL migration for `warehouse_inventory_tickets`, `warehouse_configs`, and `warehouse_vehicles`.
   - Added dual-layer persistence in `WarehouseInventoryService.ts` combining IndexedDB (`dbContext`), Supabase dedicated tables, and automatic fallback to `content.settings.warehouse_inventory_state` so cloud sync works immediately even before running the SQL migration.
2. **06:00 AM Shift Cutoff & 3-Way CSV Classification (`src/services/excel/WarehouseInventoryService.ts`):**
   - Implemented `computeReportDate(weighOutDate, weighOutTime)` shifting any ticket weighed out between `00:00:00` and `05:59:59` on date `D` to `reportDate = D - 1`.
   - Implemented `classifyWeighbridgeRow` to split CSV/Excel weighbridge rows into `IMPORT` (`Xuat/Nhap = Nhap` & `Loai Salan = KHO 1..4`), `EXPORT` (`Xuat/Nhap = Xuat` & `Tai Xe = KHO 1..4`), and `DIRECT` (`Xuat/Nhap = Xuat` & `Tai Xe != KHO 1..4`), while ignoring non-warehouse agricultural imports.
3. **Single-Point Sync & Historical Excel Bootstrap:**
   - Implemented `syncExportRowsToAllocator` so importing CSV files at Warehouse Inventory automatically updates `allocator_tickets` and unlocked Barges in `WeighbridgeService`.
   - Implemented `importHistoricalExcelWorkbook` supporting both Single-Warehouse (`IMPORT 4`, `EXPORT 4`, `FINAL 4`, `ĐI THẲNG`, `Data`) and Multi-Warehouse (`FINAL` 3 horizontal tables, `IMPORT 1..3`, `EXPORT 1..3`, `XÁ THẲNG`, `Data`) Excel workbooks.
   - Implemented `computeWarehouseFinalTable` for continuous cumulative stock calculation across customer changes without lot splitting.
