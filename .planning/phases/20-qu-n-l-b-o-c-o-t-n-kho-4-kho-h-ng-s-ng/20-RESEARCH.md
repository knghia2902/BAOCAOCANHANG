# Phase 20: Quản lý & Báo cáo Tồn Kho 4 Kho Hàng Sáng — Technical Research

**Date:** 2026-10-21
**Phase:** 20

## 1. Domain & Excel Workbook Anatomy

Based on direct inspection of the user's production files:
1. **`WL GỖ NÉN_KHO 4 NGUYÊN NGỌC_21102026_EW.xlsx` (Single-Warehouse Layout, e.g., Kho 4 - Eastwood / Nhiệt Xanh / Bách Khoa):**
   - **`IMPORT 4`:**
     - Rows 1-5: Title (`BÁO CÁO CHI TIẾT CÂN NHẬP KHO`), Subtitle (`(WEIGHING LIST REPORT)`), `Kho (Warehouse): NGUYÊN NGỌC KHO 4`, `Hàng hóa (Cargo): VIÊN GỖ NÉN`, `Khách hàng (Customer): EAST WOOD`.
     - Row 6 Headers (14 cols): `STT (No) | Ngày nhập Date | Số phiếu (Serial) | Số xe (Truck no) | T.Lượng vào (Weight in) | T.Lượng ra (Weight out) | T.Lượng hàng (N.Weight) | Ngày cân vào | Ngày cân ra | Cân Nhà Máy | Chênh lệch | Ghi chú | Ghi chú 2 | Nhà xe`
     - Formulas: Col K (`Chênh lệch`) = `=G{row}-J{row}`, Col N (`Nhà xe`) = `=IFERROR(VLOOKUP(D{row},Data!C$3:D$500,2,FALSE),"")`. Bottom row: `SUBTOTAL(9, G7:G{last})`.
   - **`EXPORT 4`:**
     - Rows 1-5: Title (`BÁO CÁO CHI TIẾT CÂN XUẤT KHO`), Origin `KHO 4`, Cargo `VIÊN GỖ NÉN`, Customer `EASTWOOD`.
     - Row 7 Headers (14 cols): `STT (No) | Ngày xuất (Date) | Số phiếu (Serial) | Số xe (Truck no) | T.Lượng vào (Weight in) | T.Lượng ra (Weight out) | T.Lượng hàng (N.Weight) | Nhập/Xuất (In/Out) | Kho (Warehouse) | Ngày cân vào | Ngày cân ra | Salan | Tàu | Ghi chú`
   - **`ĐI THẲNG`:**
     - Row 7 Headers (17 cols): `STT (No) | Ngày nhập Date | Số phiếu (Serial) | Số xe (Truck no) | T.Lượng vào (Weight in) | T.Lượng ra (Weight out) | T.Lượng hàng (N.Weight) | Nhập/ Xuất | Ngày cân vào | Ngày cân ra | Cân Nhà Máy | Chênh lệch | Ghi chú (Sà lan) | Nơi nhận (Nhà máy/Cont) | Tàu | ... | Nhà xe`
   - **`FINAL 4`:**
     - Row 7 Headers (6 cols): `Ngày Date | Trọng lượng nhập Imported weight | Trọng lượng xuất Exported weight | Tồn cuối Stock | Xá thẳng | Ghi chú Remarks`
     - Row 8 (Initial stock baseline row): e.g. `2025-12-26 | 17652550 | SUMIFS(...) | 17652550 | ... | Tồn kho đến 26/12/2025`
     - Subsequent rows `r`:
       - Col A: Date (`YYYY-MM-DD`, formatted `dd/mm/yyyy`)
       - Col B: `=SUMIFS('IMPORT 4'!$G$7:$G$5000,'IMPORT 4'!$B$7:$B$5000,'FINAL 4'!A{r})`
       - Col C: `=SUMIFS('EXPORT 4'!$G$8:$G$5000,'EXPORT 4'!$B$8:$B$5000,'FINAL 4'!A{r})`
       - Col D: `=D{r-1}+B{r}-C{r}`
       - Col E: `=SUMIF('ĐI THẲNG'!B:B,'FINAL 4'!A{r},'ĐI THẲNG'!G:G)`
       - Col F: Daily note / remark
2. **`WEIGHT LIST GỖ NÉN_KHO NGUYÊN NGỌC_GBD_21102026.xlsx` (Multi-Warehouse Side-by-Side Layout for Kho 1, 2, 3 - Gỗ Bình Định):**
   - Contains sheets: `FINAL`, `IMPORT 1`, `EXPORT 1`, `IMPORT 2`, `EXPORT 2`, `IMPORT KHO 3`, `EXPORT KH 3`, `XÁ THẲNG`, `Data`.
   - Sheet `FINAL` places 3 tables horizontally side-by-side:
     - **Kho 1:** Cols A..E (`Ngày | NHẬP KHO 1 | XUẤT KHO 1 | Tồn cuối Stock | Ghi chú Remarks`), Col F blank separator.
     - **Kho 2:** Cols G..K (`Ngày | NHẬP KHO 2 | XUẤT KHO 2 | Tồn cuối Stock | Ghi chú Remarks`), Col L blank separator.
     - **Kho 3:** Cols M..Q (`Ngày | NHẬP KHO 3 | XUẤT KHO 3 | Tồn cuối Stock | Ghi chú Remarks`).

## 2. Classification & 6 AM Shift Cutoff Rules

From sample CSV (`2010ok.csv`):
- **6:00 AM Shift Cutoff (`computeReportDate`):**
  - Given `dateOutStr` (`DD/MM/YYYY` or `YYYY-MM-DD`) and `timeOutStr` (`H:mm:ss` or `HH:mm`):
  - Parse hours `h` from `timeOutStr`. If `0 <= h < 6`, subtract 1 calendar day from `dateOut` to obtain `reportDate` (`YYYY-MM-DD`). Otherwise `reportDate = dateOut`.
- **3-Way Ticket Classification:**
  - Normalize `direction = removeAccents(row.direction).toLowerCase()` (`nhap` vs `xuat`).
  - Normalize `bargeCol = row.bargeName.trim().toUpperCase()` and `driverCol = row.driverName.trim().toUpperCase()`.
  - Helper `extractWarehouseId(str)`: matches `/^KHO\s*([1-4])\b/i` -> returns `'KHO 1' | 'KHO 2' | 'KHO 3' | 'KHO 4' | null`.
  - **Rule 1 — Warehouse Import (`import`):**
    - `direction.includes('nhap')` AND `extractWarehouseId(bargeCol)` is `'KHO 1'..'KHO 4'`.
    - `warehouseId = extractWarehouseId(bargeCol)`.
    - `factoryName = row.driverName.trim()` (stored in `origin_note`).
    - `factoryWeight = parseFloat(row.notes) || 0` (if `Ghi Chu` is numeric weight).
    - Non-warehouse `Nhap` rows (e.g., `BẮP` with `Loai Salan = SG 7272`) return `null` for warehouse inventory (ignored for warehouse stock, though still available if needed).
  - **Rule 2 — Warehouse Export (`export`):**
    - `direction.includes('xuat')` AND `extractWarehouseId(driverCol)` is `'KHO 1'..'KHO 4'`.
    - `warehouseId = extractWarehouseId(driverCol)`.
    - `bargeName = row.bargeName.trim()`, `orderNo = row.orderNo.trim()`.
    - Vessel name (`vesselName`) is resolved automatically by matching `orderNo` (or barge name) against loaded `vessels` from `WeighbridgeService.getVessels()`.
  - **Rule 3 — Direct Shipment (`direct`):**
    - `direction.includes('xuat')` AND `extractWarehouseId(driverCol) === null`.
    - Associated with the warehouse/customer group via `customer` name (or target warehouse selection if needed, plus matched to the customer of Kho 1..4).
    - `factoryOrContNote = row.driverName.trim()` (e.g. `CHƠN THÀNH`, `CT04`, `VÁN`, `KHÔNG VÁN`).
    - If `row.notes` is a numeric weight (e.g. `39210`), `factoryWeight = Number(row.notes)`; if alphanumeric container code (e.g. `OOLU1019754`), stored in `container_or_note`.

## 3. Single-Point Import Sync to Overview & Cargo Allocator (`INV-03`)

- When the user imports a Weight List CSV/Excel in the Warehouse Inventory screen:
  - All `Xuat` rows (both Warehouse Export and Direct Shipment) are also formatted as `CSVRecord` items and merged into `allocator_tickets` (in `content.settings` + `dbContext`) and automatically synced to matching Barges (by `orderNo`) via `WeighbridgeService`, broadcasting on `BroadcastChannel('allocator_sync_channel')`.
  - This guarantees the user only imports the file **once** at the Inventory screen and both Warehouse Inventory and Barge Overview (`WeighbridgePrinter.vue` / `CargoAllocator.vue`) are updated simultaneously.

## 4. Storage Architecture (Supabase + IndexedDB Fallback)

- Create SQL migration `database/migrations/20261021_create_warehouse_inventory.sql` with:
  1. `public.warehouse_inventory_tickets`: stores all historical & daily `import`, `export`, and `direct` tickets across `KHO 1..4`, with unique constraint on `(ticket_no, record_type, warehouse_id)` for idempotent upserts.
  2. `public.warehouse_inventory_settings`: stores per-warehouse metadata (`warehouse_id` PK `'KHO 1'..'KHO 4'`, `customer_name`, `cargo_name`, `initial_date`, `initial_stock`, `daily_remarks` JSONB), plus global `vehicle_Directory` (`Data` sheet plate -> transport company mapping).
- Provide full offline-resilient dual-persistence in `dbContext` (`idb`) + `supabase` (`content.settings` backup / dedicated tables) so the app works seamlessly even before SQL migration is run on Supabase.

## 5. Zalo Image Capture (`INV-04`)

- Use pure HTML5 Canvas 2D table rendering (or `html2pdf.js`'s bundled `html2canvas`) to render the crisp `FINAL` summary table (header info + recent N days or selected date range + totals + current stock) into a high-DPI PNG image, supporting both **"Copy ảnh vào Clipboard (Dán thẳng Zalo)"** (`navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })])`) and **"Tải ảnh PNG"**.

## Validation Architecture

- Unit tests in `src/services/excel/__tests__/WarehouseInventoryService.spec.ts` using `vitest`:
  - Verify 6:00 AM shift cutoff (`computeReportDate`) for timestamps before and after 06:00:00.
  - Verify 3-way ticket classification (`import`, `export`, `direct`, and ignoring barge-import `BẮP`).
  - Verify cumulative stock calculation (`Stock[d] = Stock[d-1] + Import[d] - Export[d]`) across customer changes without resetting lots.
  - Verify Excel workbook generation (`IMPORT`, `EXPORT`, `FINAL`, `ĐI THẲNG`, `Data`).
