# Plan Summary: 12-01 Dedicated Single-Barge Allocator Tool (Setup & Tab 1)

## Summary of Accomplishments
1. **Route & Navigation**:
   - Registered `/split` route in `src/router.ts` using `SplitAllocatorView.vue` with `requiresAuth: true`.
   - Added legacy redirect alias `/tools/split` -> `/split`.
   - Added `split` tool permissions to `src/App.vue` for authenticated admins/staff.
   - Added "Phân Bổ Tải Trọng 🚢" tool card to `src/views/ToolsView.vue` with icon `call_split` and routing logic.
2. **View Wrapper**:
   - Created `src/views/tools/SplitAllocatorView.vue` wrapped in `ToolLayout.vue`.
3. **Core Component Layout & Tab 1**:
   - Built `src/components/tools/SingleBargeAllocator.vue` with responsive 3-tab navigation:
     - `1. Phiếu cân`
     - `2. Phân bổ`
     - `3. Sổ theo dõi`
   - Tab 1 supports uploading `.xlsx`, `.xls`, and `.csv` tickets using `cleanHeader` and `formatExcelDateCell` for fault-tolerant parsing.
   - 14-column data table displaying all essential weighbridge ticket fields.
   - Summary statistics (Total tickets, Total tons, Unique vehicles, Total kg).
   - Modal for manual ticket creation and editing.
   - Delete single ticket and clear all tickets actions.
   - Export source tickets to formatted Excel `.xlsx` file.
4. **Configuration Sidebar**:
   - Target barge dropdown selector from `WeighbridgeService.getVessels()`.
   - Custom order number input.
   - Time interval slider (3 to 60 minutes).
   - Weight distribution strategy selector (`even`, `random`, `max`).
   - Time spacing strategy selector (`forward`, `backward`, `even`).
   - Default vehicle capacity limit input (in tons).
   - Auto-generated ticket numbering rules (Prefix, Start, Padding, Suffix).
   - Per-vehicle limit management list synced from `VehicleService.getVehicles()`.

## Verification
- Verified compilation with `npm run build` (`vue-tsc -b && vite build`) passing with 0 errors.
