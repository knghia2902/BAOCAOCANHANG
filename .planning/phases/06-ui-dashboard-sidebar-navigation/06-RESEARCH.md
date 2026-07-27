# Phase 6: UI Dashboard & Sidebar Navigation - Research

**Phase:** 6
**Domain:** UI Layout and Sidebar Navigation
**Date:** 2026-07-27

## Technical Approach

We will integrate the Warehouse & Container weighing logs into the existing sidebar-based sub-view switcher of the CargoAllocator.

### 1. Sidebar Integration (`CargoAllocator.vue`)
- Add `'other_tickets'` as an allowable value in `activeSubViewMode` (currently `'allocator' | 'vehicles' | 'goods'`).
- In `CargoAllocator.vue` sidebar panel, add:
  ```html
  <div 
      @click="activeSubViewMode = 'other_tickets'"
      :class="['flex items-center gap-2.5 p-3 rounded-[16px] cursor-pointer transition-all text-xs font-black border', activeSubViewMode === 'other_tickets' ? 'bg-primary text-white border-primary shadow-soft' : 'bg-white text-gray-700 hover:bg-gray-50 border-gray-100']"
  >
      <span class="material-symbols-outlined text-base">history</span>
      Lịch sử cân Kho & Container
  </div>
  ```
- Import and register the new component:
  ```typescript
  import WeighbridgeOtherManager from './WeighbridgeOtherManager.vue';
  ```
- In the `<main>` area, conditionally render the component:
  ```html
  <div v-else-if="activeSubViewMode === 'other_tickets'" class="w-full max-w-[1500px] mx-auto flex-1 flex flex-col min-h-0">
      <WeighbridgeOtherManager />
  </div>
  ```

### 2. Component Design (`WeighbridgeOtherManager.vue`)
- **State Management:**
  - `activeTab`: `'warehouse' | 'container'` (reactively switch tables and headers).
  - `tickets`: list of loaded tickets from database.
  - `loading`: boolean state spinner.
  - `itemsPerPage`: reactive number (options: `10 | 20 | 50 | 100`).
  - `currentPage`: number.
- **Drag & Drop Upload Zone:**
  - Create a dragover/drop and click file uploader using standard Vue events.
  - Calls `weighbridgeOtherService.parseExcelFile(file, activeTab)` when file is uploaded, then previews rows, and prompts a save button that calls `weighbridgeOtherService.saveWarehouseTickets` or `saveContainerTickets`.
- **Paginated Table Layout:**
  - Implement a Tailwind styled table matching the existing look: Segoe UI, white background, teal/slate accents, rounded corners.
  - Paginate locally or fetch from Supabase.
  - Display page metrics ("Tổng: M", "Hiển thị: [select]", "Trang P/Q").

## Verification Strategy

- **Static analysis:** Ensure typechecks pass: `npx vue-tsc --noEmit`.
- **Manual UI test:** Deploy and verify the layout, drag-and-drop actions, pagination controls, and tabs.

---
*Research completed: 2026-07-27*
