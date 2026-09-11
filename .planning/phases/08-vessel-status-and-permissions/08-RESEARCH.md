# Phase 08: Phân loại tàu Đang làm hàng & Đã xong — Research & Architecture

**Created:** 2026-09-11  
**Author:** GSD Phase Researcher  
**Status:** Completed  
**Requirements:** VESSEL-01, VESSEL-02  
**Roadmap Phase:** Phase 8 (v1.1)

---

## 1. Executive Summary & Goals

Phase 8 introduces a two-tier lifecycle status for vessels in the Weighbridge Printing utility (`WeighbridgePrinter.vue` & `WeighbridgeService.ts`):
1. **Status Classification (`status: 'in_progress' | 'done'`):**
   - Default status is `'in_progress'` (*"Đang làm hàng"*).
   - Backward compatibility: Existing records without a status field default to `'in_progress'`.
2. **2-Tab Segregation in UI:**
   - Sidebar and Global Dashboard separated into 2 synced tabs: **"Đang làm hàng"** (default) and **"Đã xong"**.
   - Dynamic badges displaying vessel counts: `Đang làm hàng (N)` | `Đã xong (M)`.
3. **Closing & Locking (Read-Only Mode):**
   - Action button *"Chốt số liệu: Đã xong"* on the vessel summary dashboard header.
   - Shows confirmation modal before locking.
   - When marked `'done'`, the vessel, its barges, and its trucks switch into strict **Read-only** mode (locks add barge, rename/delete vessel, add/edit/delete trucks, excel import, barge lock toggle).
   - Viewing details, printing A5 tickets, and exporting Excel remain fully operational.
4. **Admin-Only Re-Opening:**
   - The button *"Mở lại: Đang làm hàng"* is visible **ONLY** for users where `authStore.role === 'admin'`.
   - Clicking displays confirmation modal and resets vessel status to `'in_progress'`.

---

## 2. Target Files & Code Locations

### 2.1 `src/services/excel/WeighbridgeService.ts`
- **Lines 4-10 (`interface Vessel`):**
  - Add `status?: 'in_progress' | 'done';`
- **Lines 113-119 (`getLocalVessels`, `saveLocalVessels`):**
  - Ensure any vessels read from IndexedDB without `status` default to `'in_progress'`.
- **Lines 125-177 (`getVessels`):**
  - Backward compatibility mapping: `status: vessel.status || 'in_progress'`.
- **Lines 182-214 (`createVessel`):**
  - Assign `status: 'in_progress'` to `newVessel` and include in Supabase insert payload.
- **New Method: `updateVesselStatus(id: number, status: 'in_progress' | 'done'): Promise<boolean>`:**
  - Updates local IndexedDB cache (`saveLocalVessels`).
  - Calls Supabase `.from('weighbridge_vessels').update({ status }).eq('id', id)`.
  - Graceful fallback: If Supabase query fails or client is offline, local cache is preserved and returns `true`.

### 2.2 `src/components/tools/WeighbridgePrinter.vue`
- **Lines 140-165 (State declarations):**
  - Add `selectedVesselStatusTab = ref<'in_progress' | 'done'>('in_progress');`
  - Add `isUpdatingVesselStatus = ref(false);`
- **Lines 518-550 (Computed state & filtering):**
  - `inProgressVessels = computed(() => vessels.value.filter(v => (v.status || 'in_progress') === 'in_progress'))`
  - `doneVessels = computed(() => vessels.value.filter(v => v.status === 'done'))`
  - `filteredSidebarVessels = computed(() => selectedVesselStatusTab.value === 'done' ? doneVessels.value : inProgressVessels.value)`
  - Update `allBarges` computed: Filter vessels by `selectedVesselStatusTab` so the Global Dashboard table and statistics reflect the selected tab.
  - Add helper `isCurrentVesselDone = computed(() => activeVessel.value?.status === 'done')`
- **Lines 203-235 (Modal Confirmations):**
  - Re-use existing `showConfirm(...)` helper function for prompt dialogues.
- **Lines 2480-2550 (Action Handlers):**
  - Add `handleCloseVessel(vesselId: number)`: prompts confirmation, invokes `WeighbridgeService.updateVesselStatus(vesselId, 'done')`, updates reactive state in `vessels.value`, updates tab to `'done'`, shows toast.
  - Add `handleReopenVessel(vesselId: number)`: checks `authStore.role === 'admin'`, prompts confirmation, invokes `WeighbridgeService.updateVesselStatus(vesselId, 'in_progress')`, updates reactive state, updates tab to `'in_progress'`, shows toast.
- **Lines 4037-4050 (Sidebar Tab Header):**
  - Insert 2-Tab button pills under "Tổng quan" / "Tải lại danh sách":
    - Tab "Đang làm hàng" with count badge `inProgressVessels.length`
    - Tab "Đã xong" with count badge `doneVessels.length`
  - Change `v-for="vessel in vessels"` to `v-for="vessel in filteredSidebarVessels"`.
  - For vessels in `'done'` status: hide or disable edit actions (`addBarge`, `renameVessel`, `deleteVessel`, `renameBarge`, `deleteBarge`).
- **Lines 4140-4210 (Global Dashboard / Báo cáo tổng quan):**
  - Insert 2-Tab button toggle at the top of Global Dashboard synced with `selectedVesselStatusTab`.
  - Stats row updates: Display vessel count and barge count according to active tab.
  - Table `filteredAllBarges`: Displays filtered barges matching the selected tab.
- **Lines 4310-4350 (Vessel Summary Dashboard Header):**
  - Display status badge next to vessel name:
    - If `'in_progress'`: `<span class="bg-teal-50 text-teal-700 border border-teal-200">Đang làm hàng</span>`
    - If `'done'`: `<span class="bg-gray-100 text-gray-700 border border-gray-300">Đã xong</span>`
  - Action buttons:
    - When `status === 'in_progress'`: Show button *"Chốt số liệu: Đã xong"* (amber/orange themed).
    - When `status === 'done'` and `authStore.role === 'admin'`: Show button *"Mở lại: Đang làm hàng"* (primary/indigo themed).
  - When `isCurrentVesselDone`: Show alert banner *"Tàu đã chốt số liệu — Chế độ chỉ xem"* with `lock` icon.
- **Lines 4470-4850 (Active Barge Workspace):**
  - When `isCurrentVesselDone`:
    - Show banner alert on top of workspace indicating read-only state.
    - Disable/hide: barge lock toggle, "Nhập Excel", "Đồng bộ từ Phân bổ", "Thêm xe", "Xóa tất cả", edit truck button, delete truck button.
    - Keep enabled: Print button, Batch print A5, Export Excel.

---

## 3. Database Schema & Supabase Note

The Supabase table is `weighbridge_vessels`.
SQL migration needed on Supabase (idempotent):
```sql
ALTER TABLE weighbridge_vessels 
ADD COLUMN IF NOT EXISTS status text DEFAULT 'in_progress';
```
In case client runs before or during migration, code handles fallback gracefully:
- `status || 'in_progress'` ensures old records without the column evaluate properly as `'in_progress'`.
- IndexedDB stores `status` immediately, maintaining state across reloads even if offline.

---

## 4. Implementation Plans Breakdown

### Plan 08-01: Service & Data Model (Core Foundation)
- Update `Vessel` interface with `status?: 'in_progress' | 'done'`.
- Update `getLocalVessels()`, `getVessels()`, and `createVessel()` in `WeighbridgeService.ts` to handle default `'in_progress'`.
- Implement `WeighbridgeService.updateVesselStatus(id: number, status: 'in_progress' | 'done'): Promise<boolean>`.
- Create unit test file `tests/WeighbridgeService.spec.ts` covering:
  - Default status assignment (`in_progress`).
  - Creation of vessel with status.
  - Updating status to `'done'` and `'in_progress'`.
  - Offline/fallback resilience.

### Plan 08-02: UI 2-Tabs, Confirmation Modals & Read-Only Permissions
- Implement reactive `selectedVesselStatusTab` and computed filters (`inProgressVessels`, `doneVessels`, `filteredSidebarVessels`, filtered `allBarges`) in `WeighbridgePrinter.vue`.
- Build 2-Tab selector in Sidebar with count badges.
- Build 2-Tab selector in Global Dashboard with count badges and sync with Sidebar.
- Implement `handleCloseVessel` with `showConfirm` modal warning.
- Implement `handleReopenVessel` guarded by `authStore.role === 'admin'`.
- Add Status Badge and Action Buttons to Vessel Summary Dashboard header.
- Add Read-only state enforcement and warning banners across Vessel Summary and Active Barge views.

---

## 5. Validation Architecture (Nyquist / Dimension 8)

### Automated Tests (`tests/WeighbridgeService.spec.ts`)
- **T1: Status Defaulting:** `getVessels()` transforms vessels without `status` into `status: 'in_progress'`.
- **T2: Create Vessel:** `createVessel('Test Vessel')` sets `status: 'in_progress'`.
- **T3: Update Vessel Status to Done:** `updateVesselStatus(id, 'done')` updates local cache and issues Supabase update with `{ status: 'done' }`.
- **T4: Update Vessel Status to In Progress:** `updateVesselStatus(id, 'in_progress')` updates local cache and issues Supabase update with `{ status: 'in_progress' }`.
- **T5: Error Resilience:** When Supabase update rejects with network error, `updateVesselStatus` retains IndexedDB local modification and returns `true`.

### Manual / Verification Checkpoints
- **UAT-01: Tab Switching & Badges:** Verify clicking tabs in Sidebar or Global Dashboard filters vessels and barges, and displays correct badge counts `(N)`.
- **UAT-02: Close Vessel Flow:** Verify clicking *"Chốt số liệu: Đã xong"* shows warning modal. Upon confirm, status updates to `'done'`, tab switches to `'done'`, and read-only banner appears.
- **UAT-03: Read-Only Enforcement:** In `'done'` vessel/barge, verify "Thêm xe", "Sửa xe", "Xóa xe", "Nhập Excel", "Thêm sà lan", "Đổi tên/Xóa" are disabled/hidden, while Print and Export Excel function normally.
- **UAT-04: Admin Re-open Flow:** Log in as staff/operator (`role !== 'admin'`) and verify *"Mở lại: Đang làm hàng"* button is HIDDEN. Switch to Admin account (`role === 'admin'`), verify button is visible and clicking prompts confirm and reopens vessel to `'in_progress'`.
