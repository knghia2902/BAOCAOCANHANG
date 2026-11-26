# Phase 25 Research: Kiểm toán tuân thủ DESIGN.md toàn bộ hệ thống

**Ngày khảo sát:** 2026-11-26
**Phạm vi:** Toàn bộ 39 tệp giao diện (`src/views/`, `src/components/`, `src/layouts/`, `src/App.vue`, `tailwind.config.js`, `src/style.css`, `index.html`).
**Nguồn chuẩn:** `DESIGN.md` (6 mục: Color System, Typography >= 12px, Border Radius, Buttons Spec, Layout & Data Table, 3-Card Layout & Toolbar).

## 1. Tổng hợp điểm gốc cần sửa toàn cục (Wave 1 — Plan 25-01)
1. **`tailwind.config.js`**:
   - Đang khai báo thêm font `Fredoka` và ưu tiên `Noto Sans` trước `Quicksand` (vi phạm Mục 2: chỉ dùng 2 font `Space Grotesk` + `Quicksand`).
   - Đang ghi đè `borderRadius.lg = "2.5rem"` và `borderRadius.xl = "4rem"` — làm vỡ `rounded-lg` (tab switcher) và `rounded-xl` (nút nhỏ/badge `12px`) trên toàn web. Cần trả `lg`/`xl` về mặc định Tailwind hoặc dùng token riêng (`card-xl`, `modal-lg`) và định nghĩa `shadow-soft` trong `boxShadow`.
2. **`src/style.css` & `index.html`**:
   - `index.html` tải 4 Google Fonts; cần gọn còn đúng `Space Grotesk` và `Quicksand`.
   - `src/style.css` đặt `body { @apply font-display; }` đè mất font `Quicksand` cho nội dung/bảng; cần đổi `body` sang `font-body` (`Quicksand`), định nghĩa utility `.shadow-soft` đồng bộ với `DESIGN.md` Mục 6, và cập nhật `.glass-nav` sang `bg-white/80 border-soft-pink`.
3. **Shell & Views (`App.vue`, `HomeView.vue`, `LoginView.vue`, `ChangePasswordView.vue`, `AdminView.vue`, `AboutView.vue`, `DocumentsView.vue`, `UnifiedWorkspaceView.vue`, `WorkspaceTreeSidebar.vue`)**:
   - Xóa màu hồng/nâu cũ (`#ff85a2`, `#1b0d11`), màu ngoài bảng (`indigo`, `purple`, `green`, `emerald` → `primary`/`teal`/`rose`), class không tồn tại (`border-gray-150`).
   - Nâng 19 vị trí chữ `< 12px` (`HomeView` 9×, `DocumentsView` 9×, `LoginView` 1×) lên `text-xs`.
   - Chuẩn hóa nút Primary Puffy, nút đóng modal `size-10`, modal `rounded-[2rem]`, tiêu đề modal `text-xl font-display font-black`, bảng dữ liệu `rounded-[24px]` kèm `sticky top-0 z-10`.

## 2. Báo Cáo Tồn Kho, Báo Cáo Lô Hàng & Quyết Toán (Wave 2 — Plan 25-02)
- **`WarehouseInventoryManager.vue`**: 9 dòng màu ngoài bảng (`purple`, `blue`, `emerald`), 83× chữ `text-[10px]`/`text-[11px]`, 1 bảng gộp 3 kho thiếu `sticky thead`, bảng wrapper `rounded-2xl` → `rounded-[24px]`, nút đóng modal `size-8` → `size-10`. *(Giữ nguyên màu header Excel `#92d050`, `#c6e0b4`, `#fff2cc`, `#d9e1f2` để đồng bộ bản xuất Excel/Zalo.)*
- **`WeighbridgePrinter.vue`**: 11 dòng `emerald`/`blue`, 7 chỗ `#1b0d11`/`bg-cute-gradient`, 44× chữ `< 12px` (gồm `text-[7px]`), 2 bảng thiếu `sticky thead`, nút toolbar `h-[32px]` → `h-7`, 9 nút action chưa chuẩn `size-8 rounded-full`. *(Giữ nguyên `@media print` & phôi in A5 10pt Arial.)*
- **Sub-components `weighbridge/` (`WbKpiCards`, `WbFileUpload`, `WbTicketTable`, `WbTruckListTable`, `WbVesselSidebar`, `WbPrintConfigForm`, `WbPrintPreviewCanvas`)**: Sửa màu `indigo`/`emerald`, nâng 23× chữ `< 12px` lên `text-xs`, bổ sung `sticky thead`, nút `size-8 rounded-full`, và **khắc phục toàn bộ chuỗi tiếng Việt bị mojibake** trong 4 file `WbTruckListTable`, `WbVesselSidebar`, `WbPrintConfigForm`, `WbPrintPreviewCanvas`.
- **Sub-components `settlement/` (`ShipmentSettlementModal`, `DebitNotePreview`, `BargeDemurrageTable`)**: Đổi `blue-*` → `primary/*`, nâng 7× chữ `< 12px`, bổ sung `sticky thead`, chuẩn hóa icon `size-8` / `size-10`.
- **`VesselSourceManager.vue` & `WeighbridgeDataImporter.vue`**: Chỉnh nhẹ 1× `text-[10px]`, nút đóng modal `size-10`, wrapper bảng `rounded-[24px]`.

## 3. Phân Bổ, Hồ Sơ Phương Tiện & Biên Bản (Wave 2 — Plan 25-03)
- **`SingleBargeAllocator.vue`**: 29× chữ `< 12px`, 19× màu `amber`/`emerald`/`blue`, class lỗi `bg-gray-55` / `text-teal-655` / `border-gray-150`, 4 bảng thiếu `sticky thead`, tab switcher thiếu khung `h-8 bg-slate-100/80 p-1 rounded-xl`.
- **`CargoAllocator.vue`**: Class lỗi `bg-gray-55` / `border-gray-150`, 2 bảng thiếu `sticky thead`, tab switcher chưa chuẩn `h-8`.
- **`BargeProfileManager.vue`**: 21× màu `emerald`/`blue`/`amber`, 7× chữ `< 12px`, toolbar `h-8` → `h-7`, `gray-150` → `gray-200`, bảng wrapper `rounded-[24px]`.
- **`BargeMinutes.vue`**: 7× màu `emerald`/`amber`/`sky`, `#fcedf0` & bóng đỏ burgundy, input `rounded-xl` → `rounded-2xl`, nút xuất chính đổi sang Puffy `bg-primary rounded-full`.
- **`WeighbridgeOtherManager.vue`**: 1× `text-[10px]` → `text-xs`, `h3` `text-lg` → `text-xl`.

## 4. Danh Mục Dùng Chung, Tiện Ích & ToolLayout (Wave 2 — Plan 25-04)
- **`MasterCategoryManager.vue`, `VehicleManager.vue`, `GoodsManager.vue`**: Chuẩn hóa thanh tìm kiếm & nút toolbar sang `h-7 rounded-[8px]`, bảng wrapper `rounded-[24px]`, bỏ `amber` thừa trong confirm modal, nâng 1× `text-[11px]` lên `text-xs`.
- **`FormatConverter.vue`, `ExcelMerger.vue`, `PdfOcrTools.vue`, `ToolLayout.vue`**: Xóa sạch màu hồng/tối cũ (`#ff85a2`, `#1b0d11`, `pastel-pink`, `cute-peach`, `bg-background-dark`), bo góc cũ (`rounded-cloud`, `rounded-puffy`), nút đóng `ToolLayout` chuẩn `size-10 bg-[#f1f5f9] rounded-full`, tab switcher `PdfOcrTools` chuẩn `h-8`.

## 5. Ngoại lệ được giữ nguyên (Không tính vi phạm)
- Phôi in A5 `@media print` trong `WeighbridgePrinter.vue` (Arial, 10pt, đen/trắng).
- Màu header giống file Excel trong `WarehouseInventoryManager.vue` (`#92d050`, `#c6e0b4`, `#fff2cc`, `#d9e1f2`).
- Canvas SVG sơ đồ cảng trong `WarehouseVisualMap.vue` (Cambria & mã màu bản đồ kho).
