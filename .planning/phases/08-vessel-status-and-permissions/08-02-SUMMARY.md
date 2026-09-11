# Phase 08 Plan 02 Summary: UI 2-Tabs, Vessel Status Lifecycle, Read-Only Mode & Admin Re-open

**Status:** Completed
**Phase:** 08-vessel-status-and-permissions
**Wave:** 2 (UI, Interactivity & Permission Guarding)
**Date:** 2026-09-11

---

## 1. Accomplishments

1. **State & Computed Filters (`src/components/tools/WeighbridgePrinter.vue`):**
   - Added `selectedVesselStatusTab = ref<'in_progress' | 'done'>('in_progress')`.
   - Added computed properties `inProgressVessels`, `doneVessels`, `filteredSidebarVessels`, and `isCurrentVesselDone`.
   - Updated `allBarges` to filter barges according to `selectedVesselStatusTab`.
   - Auto-synchronized `selectedVesselStatusTab` upon selecting a vessel or barge.

2. **Sidebar 2-Tab Navigation:**
   - Added 2-Tab pill ("Đang làm" / "Đã xong") with live count badges in the sidebar.
   - Replaced default vessel loop with `filteredSidebarVessels`.
   - Added visual completion badge (`Xong`) for completed vessels.
   - Disabled adding, renaming, or deleting barges for vessels in "Đã xong" status.

3. **Global Dashboard Status Filter:**
   - Added 2-Tab switcher ("Đang làm hàng" / "Đã xong") in the welcome header banner.
   - Updated the "Tổng số tàu" stats card to dynamically display the count matching the active tab.

4. **Vessel Summary Dashboard:**
   - Displayed dynamic status badges: "Đang làm hàng" (blue) and "Đã xong" (emerald).
   - Added "Chốt số liệu: Đã xong" button with a comprehensive warning confirmation dialog.
   - Added Admin-only "Mở lại: Đang làm hàng" button (`v-if="activeVessel?.status === 'done' && authStore.role === 'admin'"`).
   - Added an amber warning banner informing users of the Read-only mode when `isCurrentVesselDone` is active.
   - Excel export remains fully functional.

5. **Active Barge Workspace (Read-Only Enforcement):**
   - Added a prominent amber banner notifying users of Read-only mode with an Admin quick-reopen action.
   - Disabled barge lock toggle button (`!isCurrentVesselDone`).
   - Hid template configuration tab (`v-if="... && !isCurrentVesselDone"`).
   - Hid Excel upload card, Direct Sync card, Add truck button, Excel import button, and Delete all trucks button.
   - Hid individual truck edit and delete buttons in the table.
   - Enforced handler guards in code (`openAddTruckDialog`, `openEditTruckDialog`, `deleteTruck`, `clearTrucks`, `handleExcelFile`, `syncFromAllocatorActiveBarge`, `toggleBargeLock`, `addBarge`, `renameBarge`, `deleteBarge`).
   - Kept Print A5 (single & batch) and Export Excel fully accessible.

6. **Toast Enhancement:**
   - Extended `toastType` and `showToast` to support `'warning'` alongside `'success'` and `'error'`.

---

## 2. Verification Results

- **Unit Tests:** `npm run test` passed (28/28 tests across 12 test suites, including 5 WeighbridgeService status tests).
- **TypeScript & Build:** `npm run build` completed successfully (`vue-tsc -b && vite build`) with zero errors.

---

## 3. Files Modified

- `src/components/tools/WeighbridgePrinter.vue`
- `.planning/phases/08-vessel-status-and-permissions/08-02-SUMMARY.md`
