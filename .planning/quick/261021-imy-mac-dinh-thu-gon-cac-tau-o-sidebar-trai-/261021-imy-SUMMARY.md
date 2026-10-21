---
phase: quick
plan: 261021-imy
subsystem: weighbridge
tags: [ui, sidebar, weighbridge, vessels]
status: complete
completed_date: "2026-10-21"
key_files:
  modified:
    - src/components/tools/WeighbridgePrinter.vue
    - src/components/tools/BargeProfileManager.vue
---

# Quick Task 261021-imy Summary: Mặc định thu gọn các tàu ở sidebar trái trong Báo Cáo Tổng Quan

## One-Liner
Changed the default sidebar state of vessels in **BÁO CÁO TỔNG QUAN** (`WeighbridgePrinter.vue` and `BargeProfileManager.vue`) from expanded (`true`) to collapsed (`false`).

## Changes Made
- **`src/components/tools/WeighbridgePrinter.vue`**:
  - In `loadVessels`, initialized `expandedVesselIds.value[v.id] = false` when `undefined` so all vessels in the left sidebar start collapsed by default.
  - In `selectBarge`, set `expandedVesselIds.value[vesselId] = true` so clicking a barge from the right-side summary table automatically expands its parent vessel in the sidebar.
- **`src/components/tools/BargeProfileManager.vue`**:
  - In `loadData`, initialized `expandedVesselIds.value[v.id] = false` when `undefined`.
