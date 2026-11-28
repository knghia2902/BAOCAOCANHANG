# Phase 26 Plan 01 Summary: Khởi tạo Tồn đầu Bãi Container Eastwood

**Completed:** 2026-11-28
**Status:** Complete

## Changes Implemented
- **`src/services/excel/EastwoodContainerService.ts`**:
  - Added `isBaselineContainerEvent`, `parseContainerListFromText`, `buildBaselineContainerEvents`, `EastwoodContainerService.parseContainerListFile`, and `EastwoodContainerService.clearBaselineEvents`.
  - Updated `computeContainerDailyReport` and `exportContainerReportExcel` detail sheets to exclude baseline opening records (`BASELINE_...` / `TON_DAU`) so daily `REPORT` and detail logs cleanly start from `2026-11-26`.
  - Updated `computeContainerStatuses` to include baseline records in yard state and suppress false missing-Ha-Cont warnings on baseline empty containers.
- **`src/components/tools/EastwoodContainerManager.vue`**:
  - Added **"Nạp tồn đầu kỳ"** toolbar button and modal (`DESIGN.md` compliant) supporting Excel/CSV 1-column container list upload, target status selection (`Cont rỗng` / `Đã trả` / `Cont có hàng`), cutoff date picker (default `2026-11-25`), live preview of parsed/deduped container numbers, and a **"Xóa tồn đầu cũ"** action that preserves daily weighbridge tickets.
  - Excluded baseline records from the 3 daily detail tabs (`Hạ Cont`, `Load Cont`, `Trả Cont`).
- **`src/services/excel/__tests__/EastwoodContainerService.spec.ts`**:
  - Added unit tests covering 1-column CSV/list parsing, deduplication, baseline state calculation, `REPORT` exclusion, and `>= 26/11/2026` container state transitions.
