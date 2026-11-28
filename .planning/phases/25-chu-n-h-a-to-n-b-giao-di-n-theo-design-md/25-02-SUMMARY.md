---
phase: 25-chu-n-h-a-to-n-b-giao-di-n-theo-design-md
plan: 02
status: completed
requirements:
  - DESIGN-02
---

# Plan 25-02 Summary: Chuẩn Hóa Giao Diện Tồn Kho, Lô Hàng, Weighbridge, Settlement & Workspace

## Scope Completed (14 files)

### Task 25-02-01 — `WarehouseInventoryManager.vue`
- Raised all 83 occurrences of `< 12px` text (`text-[10px]`, `text-[11px]`) to `text-xs`.
- Preserved intentional Excel header/footer colors (`#92d050`, `#c6e0b4`, `#d8e4bc`, `#fff2cc`, `#d9e1f2` — 15 references intact).
- Replaced out-of-system UI colors (`purple-700/800`, `blue-50/700`, `emerald-600/700`) with `primary`, `teal-600`, `amber-50/700`, and `hover:bg-gray-50`.
- Added `sticky top-0 z-10` to the Combined 3-Warehouse (`Kho 1-2-3`) table `thead`.
- Standardized all scrollable table wrappers to `rounded-[24px] border border-primary/5 overflow-auto scrollbar-none` (pagination remains pinned outside scrollable containers).
- Standardized the Missing Info modal header (`text-xl font-display font-black`) and close button (`size-10`).

### Task 25-02-02 — `WeighbridgePrinter.vue` (A5 `@media print` preserved)
- Replaced all UI `emerald-*` -> `teal-*`, `blue-*` -> `primary/*`, removed `#1b0d11` (`text-slate-500`) and `bg-cute-gradient` (`bg-background-light`).
- Raised all 44 occurrences of `< 12px` text (`text-[7px]`, `text-[10px]`, `text-[11px]`) to `text-xs`.
- Added `sticky top-0 z-10` to both missing `thead` elements (All Barges table & Vessel Barges table), and updated scrollable table wrappers to `rounded-[24px] border border-primary/5 overflow-auto scrollbar-none`.
- Standardized toolbar buttons from `h-[32px]` / `h-8 rounded-xl` to `h-7 rounded-[8px]`.
- Standardized tab switchers (sidebar vessel status, active barge tabs, master data modal tabs) to DESIGN.md `h-8 p-1 rounded-xl` with `h-6.5` buttons.
- Updated teleport modal titles to `text-xl font-display font-black text-[#1e293b]`, modal close buttons to `size-10 bg-[#f1f5f9] rounded-full`, and master data delete action icons to `size-8 rounded-full`.
- Preserved `@media print` and the A5 print template (`#print-section`) untouched.

### Task 25-02-03 — 7 `weighbridge/` Sub-components + UTF-8 Mojibake Recovery
- Restored clean UTF-8 Vietnamese text (0 mojibake) in:
  - `WbTruckListTable.vue`
  - `WbVesselSidebar.vue`
  - `WbPrintConfigForm.vue`
  - `WbPrintPreviewCanvas.vue`
- Replaced out-of-system colors (`indigo-*` -> `primary/*` in `WbKpiCards.vue`; `emerald-*` -> `teal-*` in `WbTruckListTable.vue`, `WbVesselSidebar.vue`, `WbPrintPreviewCanvas.vue`).
- Raised all `< 12px` text (`text-[10px]`, `text-[11px]`) to `text-xs` across `WbFileUpload.vue`, `WbTicketTable.vue`, `WbTruckListTable.vue`, `WbVesselSidebar.vue`, `WbPrintConfigForm.vue`, `WbPrintPreviewCanvas.vue`.
- Standardized `sticky top-0 z-10` headers, `rounded-[24px] overflow-auto scrollbar-none` table wrappers (with pagination pinned outside), `size-8 rounded-full` action buttons, `h-7 rounded-[8px]` search inputs, `rounded-2xl bg-[#f1f5f9]` form inputs, Primary Puffy save button, and `h-8` tab switcher.

### Task 25-02-04 — 3 `settlement/` Components & 2 `workspace/` Components
- `ShipmentSettlementModal.vue`: Updated modal title to `text-xl font-display font-black`, close button to `size-10`, replaced `blue-*` with `primary/*`, added `sticky top-0 z-10` and `rounded-[24px] overflow-auto scrollbar-none` on the fuel price table, raised `text-[11px]` -> `text-xs`, and standardized delete row button to `size-8 rounded-full`.
- `DebitNotePreview.vue`: Replaced `blue-*` with `primary/*`, raised `text-[10px]` / `text-[11px]` -> `text-xs`, added `sticky top-0 z-10` and `rounded-[24px] overflow-auto scrollbar-none` on the service items table.
- `BargeDemurrageTable.vue`: Raised `text-[11px]` -> `text-xs`, added `sticky top-0 z-10` and `rounded-[24px] overflow-auto scrollbar-none` on the demurrage table.
- `VesselSourceManager.vue`: Raised `text-[10px]` -> `text-xs` on the auto order number badge and updated the barge table wrapper to `rounded-[24px] border border-primary/5 overflow-auto scrollbar-none`.
- `WeighbridgeDataImporter.vue`: Updated both main table wrappers (`source` and `history`) to `rounded-[24px] border border-primary/5 overflow-auto scrollbar-none`, and standardized the manual ticket modal title (`text-xl font-display font-black`) and close button (`size-10`).

## Verification Results (PowerShell `Select-String`)
- Forbidden tokens (`#ff85a2|#1b0d11|bg-cute-gradient|text-\[(7|8|9|10|11)px\]|border-gray-150`) across all 14 files: **0 matches (CLEAN)**
- Non-DESIGN UI colors (`\b(bg|text|border|ring|from|to|via)-(emerald|indigo|purple|blue)-`) across all 14 files: **0 matches (CLEAN)**
- Mojibake check (`\uFFFD|[a-zA-Z]\?[a-zA-Z]`) in `src/components/tools/weighbridge/*.vue`: **0 matches (CLEAN)**
- Preservation checks: `WeighbridgePrinter.vue` `@media print` intact (1); `WarehouseInventoryManager.vue` Excel header/footer colors intact (15).
