---
phase: 25-chu-n-h-a-to-n-b-giao-di-n-theo-design-md
plan: 03
status: completed
files_modified:
  - src/components/tools/SingleBargeAllocator.vue
  - src/components/tools/CargoAllocator.vue
  - src/components/tools/BargeProfileManager.vue
  - src/components/tools/BargeMinutes.vue
  - src/components/tools/WeighbridgeOtherManager.vue
---

# Plan 25-03 Summary — Chuẩn hóa Phân Bổ, Hồ Sơ Sà Lan, Biên Bản & Lịch Sử Cân

## Changes Executed

### Task 25-03-01: `SingleBargeAllocator.vue` & `CargoAllocator.vue`
- **`src/components/tools/SingleBargeAllocator.vue`**:
  - Replaced all invalid Tailwind classes: `bg-gray-55` → `bg-gray-50` (40×), `text-teal-655` → `text-teal-600` (1×), `border-gray-150` → `border-slate-200` (3×).
  - Upgraded all 29× sub-12px font classes (`text-[10px]` 6×, `text-[11px]` 23×) to `text-xs`.
  - Standardized out-of-palette colors: `emerald-*` → `teal-*` (15×), `blue-*` → `primary` (`bg-primary/10 text-primary border-primary/20`).
  - Added `sticky top-0 z-10 bg-gray-50` on `<thead>` and `scrollbar-none` on scrollable wrappers for all 4 tables (pagination remains pinned outside scrollable wrappers).
  - Standardized Tab Switcher to `flex bg-slate-100/80 p-1 rounded-xl border border-slate-200/60 shrink-0 h-8 items-center` (`bg-primary text-white shadow-soft` active, `text-slate-600` inactive).
  - Updated "Lưu vào Sổ theo dõi" button to `bg-teal-600 hover:bg-teal-700 border-teal-600`.
- **`src/components/tools/CargoAllocator.vue`**:
  - Replaced all `bg-gray-55` → `bg-gray-50` (31×) and `border-gray-150` → `border-slate-200` (4×).
  - Added `sticky top-0 z-10 bg-gray-50` on `<thead>` and `scrollbar-none` on scrollable wrappers for both tables (pagination remains pinned outside scrollable wrappers).
  - Standardized Tab Switcher to `h-8 p-1 rounded-xl bg-slate-100/80 border-slate-200/60`.

### Task 25-03-02: `BargeProfileManager.vue`
- Replaced all out-of-palette colors (`emerald-*` → `teal-*`, `blue-*` → `primary`) and fixed all `gray-150` (`border-gray-150` → `border-slate-200`, `hover:bg-gray-150` → `hover:bg-slate-100`).
- Upgraded all 7× sub-12px font classes (`text-[10px]` 1×, `text-[11px]` 6×) to `text-xs`.
- Standardized toolbar search input and action buttons from `h-8 rounded-xl` → `h-7 rounded-[8px]`.
- Standardized table container wrapper from `rounded-[16px] border-gray-100` → `rounded-[24px] border-primary/5` and added `scrollbar-none` to scrollable wrappers.

### Task 25-03-03: `BargeMinutes.vue` & `WeighbridgeOtherManager.vue`
- **`src/components/tools/BargeMinutes.vue`**:
  - Removed legacy `#fcedf0` pink select background and burgundy `.soft-shadow` (`rgba(128, 0, 32, 0.05)`), switching cards to standard `shadow-soft`.
  - Replaced `emerald-*` badges/icons/toast with `teal-*` / `primary` and upgraded the primary submit CTA button to Puffy `rounded-full bg-primary shadow-[0_4px_0_0_#6495ed]`.
  - Added `font-display` across all 6 headings (`h1`, 4× `h3`, `h4`) and upgraded `h1` to `text-xl font-display font-black`.
  - Standardized all 10 form inputs + select + date/time inputs to `rounded-2xl bg-[#f1f5f9] border-slate-200`.
- **`src/components/tools/WeighbridgeOtherManager.vue`**:
  - Upgraded 1× `text-[10px]` badge to `text-xs`.
  - Upgraded `h3` title from `text-lg` to `text-xl font-display font-black`.

## Verification Results

PowerShell `Select-String` across all 5 files in Plan 25-03:
- Pattern `bg-gray-55|text-teal-655|border-gray-150|#fcedf0|text-\[(10|11)px\]`: **0 matches**
- Extended check `emerald-|blue-|gray-150|rgba\(128`: **0 matches**
