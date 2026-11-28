---
phase: 25-chu-n-h-a-to-n-b-giao-di-n-theo-design-md
plan: 04
status: completed
requirements:
  - DESIGN-04
files_modified:
  - src/components/workspace/MasterCategoryManager.vue
  - src/components/tools/VehicleManager.vue
  - src/components/tools/GoodsManager.vue
  - src/components/tools/FormatConverter.vue
  - src/components/tools/ExcelMerger.vue
  - src/components/tools/PdfOcrTools.vue
  - src/layouts/ToolLayout.vue
---

# Plan 25-04 Summary: Chuẩn hóa Danh Mục Dùng Chung, Bộ Tiện Ích & ToolLayout

## Task 25-04-01: Chuẩn hóa nhóm Danh mục (`MasterCategoryManager`, `VehicleManager`, `GoodsManager`)
- **`src/components/workspace/MasterCategoryManager.vue`**:
  - Nâng `text-[11px]` → `text-xs` cho chú thích mã hiệu kho.
  - Chuẩn hóa tiêu đề section lên `text-xl font-display font-black text-primary`, mô tả phụ `text-slate-500`.
  - Chuẩn hóa toàn bộ ô nhập liệu form (`input`/`textarea`) sang `rounded-2xl`, nút submit sang chuẩn Puffy `rounded-full` (`shadow-[0_4px_0_0_#6495ed]`), nút Hủy sang `bg-[#f1f5f9] rounded-2xl`.
  - Đổi ô tìm kiếm sang chuẩn Toolbar `h-7 rounded-[8px] border-slate-200`.
  - Bọc bảng dữ liệu trong container `rounded-[24px] border-primary/5` với vùng cuộn `overflow-auto scrollbar-none`.
- **`src/components/tools/VehicleManager.vue`**:
  - Chuẩn hóa tiêu đề section `text-xl font-display font-black text-primary`.
  - Chuẩn hóa thanh nút toolbar (Nhập Excel, Xuất Excel, Xóa sạch) và ô tìm kiếm sang `h-7 px-3 rounded-[8px]` theo Mục 6 `DESIGN.md`.
  - Chuẩn hóa input form sang `rounded-2xl`, nút submit sang Puffy `rounded-full`.
  - Bọc bảng dữ liệu `rounded-[24px] border-primary/5` với `overflow-auto scrollbar-none`.
  - Thay màu `amber-*` trong confirm modal sang `rose-*` và `primary`, nâng tiêu đề modal lên `text-xl font-display font-black text-[#1e293b]`, thêm `scrollbar-none` cho nội dung cuộn.
- **`src/components/tools/GoodsManager.vue`**:
  - Chuẩn hóa tiêu đề section `text-xl font-display font-black text-primary`.
  - Chuẩn hóa nút Xóa sạch & ô tìm kiếm sang `h-7 rounded-[8px]` theo Mục 6 `DESIGN.md`.
  - Chuẩn hóa input form sang `rounded-2xl`, nút submit sang Puffy `rounded-full`.
  - Bọc bảng dữ liệu trong container `rounded-[24px] border-primary/5` với vùng cuộn `overflow-auto scrollbar-none`.
  - Thay màu `amber-*` trong confirm modal sang `rose-*` và `primary`, nâng tiêu đề modal lên `text-xl font-display font-black text-[#1e293b]`.

## Task 25-04-02: Xóa tàn dư theme cũ & chuẩn hóa `FormatConverter`, `ExcelMerger`, `PdfOcrTools`, `ToolLayout`
- **`src/components/tools/FormatConverter.vue`**:
  - Xóa hoàn toàn `#ff85a2`, `bg-pastel-pink/30`, `bg-cute-peach`, `rounded-cloud`, `rounded-puffy`, `text-green-500`.
  - Chuyển sang hệ màu `primary`, `bg-white`, `bg-[#f1f5f9]`, `text-[#1e293b]`, `text-slate-500`, `text-teal-600`, `text-rose-600`.
  - Chuẩn hóa khung ngoài `rounded-[2.5rem]`, tiêu đề `text-xl font-display font-black`, nút Biến hoá & Tải file sang Puffy `rounded-full`, nút reset sang Icon Button tròn, vùng log có `scrollbar-none`, viền `.dashed-cloud` đổi sang xanh `#4a78c2`.
- **`src/components/tools/ExcelMerger.vue`**:
  - Xóa hoàn toàn `#1b0d11`, `bg-background-dark`, `rgba(255,133,162,...)`, `text-yellow-400`.
  - Chuyển card Log Công việc sang `bg-white rounded-[2.5rem]` với hộp log `bg-[#f1f5f9] rounded-2xl overflow-y-auto scrollbar-none` và màu trạng thái `text-teal-600` / `text-rose-600` / `text-primary`.
  - Chuẩn hóa tiêu đề các bước `text-xl font-display font-black text-[#1e293b]`, input/select nền `bg-[#f1f5f9] rounded-2xl`, nút Trộn & Tải tệp kết quả sang Puffy `rounded-full`, nút xóa tệp sang Icon Button tròn.
- **`src/components/tools/PdfOcrTools.vue`**:
  - Thay toàn bộ `#1b0d11` → `#1e293b` và `font-serif`/`font-sans` trong vùng xem trước sang `font-body`.
  - Chuẩn hóa tab switcher sang `flex bg-slate-100/80 p-1 rounded-xl border border-slate-200/60 shrink-0 h-8 items-center` với các nút `px-3 py-1 rounded-lg text-xs font-display font-bold h-6.5`.
  - Chuẩn hóa nút tải xuống sang Puffy `rounded-full`, nút đóng xem trước `bg-[#f1f5f9] rounded-2xl`, tiêu đề xem trước `text-xl font-display font-black`.
  - Chuẩn hóa hộp preview & bảng Excel preview `rounded-[24px] border-primary/5` có `<thead class="bg-gray-50 sticky top-0 z-10">` và vùng cuộn `overflow-auto scrollbar-none`.
- **`src/layouts/ToolLayout.vue`**:
  - Thay `text-[#1b0d11]/50` → `text-slate-500`.
  - Nâng `h2` từ `text-base` → `text-xl font-display font-black`.
  - Đổi nút đóng sang Icon Button tròn chuẩn `size-10 bg-[#f1f5f9] rounded-full flex items-center justify-center text-gray-400 hover:text-red-400 hover:scale-105 active:scale-95 transition-all`.

## Verification (Grep Check)
- Primary pattern `#ff85a2|#1b0d11|pastel-pink|cute-peach|rounded-cloud|rounded-puffy|text-\[(9|10|11)px\]` across all 7 files: **`MATCH_COUNT=0`**.
- Extra legacy check `bg-background-dark|255,133,162|amber-|text-green-500|text-yellow-400|font-serif|font-sans` across all 7 files: **`EXTRA_COUNT=0`**.
