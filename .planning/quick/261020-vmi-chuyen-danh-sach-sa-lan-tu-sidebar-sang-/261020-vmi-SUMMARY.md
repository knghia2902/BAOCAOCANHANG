---
phase: quick
plan: 261020-vmi
subsystem: split-allocator
tags: [ui, allocator, barge-list, weighbridge]
status: complete
completed_date: "2026-10-20"
key_files:
  modified:
    - src/components/tools/SingleBargeAllocator.vue
---

# Quick Task 261020-vmi Summary: Chuyển danh sách sà lan từ Sidebar sang bảng bên phải

## One-Liner
Removed the barge card list from the left sidebar in `SingleBargeAllocator.vue` and updated the right panel (`Tab 1. Phiếu cân`) to display the barge list first, opening and loading weighbridge tickets when a barge is clicked.

## Changes Made
1. **Left Sidebar (`SingleBargeAllocator.vue`)**:
   - Removed the barge card list container below the `Chưa phân bổ` / `Đã phân bổ` status tabs in `Khối 1: Sà lan Nông Sản De Heus`.
   - Set `isConfigExpanded = ref(true)` so configuration sections (`Số phiếu tự động`, `Quy tắc phân bổ`, `Hạn mức tải trọng`) are visible by default in the left sidebar.
   - Clicking `Chưa phân bổ` or `Đã phân bổ` (`switchBargeStatusTab`) resets `activeBargeId = null` and displays the corresponding list of barges in the right panel.
2. **Right Panel (`SingleBargeAllocator.vue`)**:
   - Prevented automatic selection of the first barge on initial load so `activeBargeId` starts as `null` and the right panel displays the **Barge List Table** (`STT`, `Tên tàu / Sà lan`, `Mã lệnh`, `Tàu chủ quản`, `Loại hàng`, `Trạng thái`, `Thao tác`).
   - Clicking a barge row calls `selectBargeFromSidebar(barge, ...)`, sets `activeBargeId = barge.id`, automatically loads its weighbridge tickets via `loadTicketsFromSourceBarge(false)`, and displays the **Weighbridge Tickets Table** (`Phiếu cân`).
   - Added `← Danh sách tàu` (`backToBargeList`) buttons in both the top banner and Tab 1 toolbar to return to the barge list at any time.
