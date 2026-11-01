---
phase: quick-261101-tnn
plan: "01"
subsystem: weighbridge-sync
tags: [weighbridge, cargo-allocator, deduplication, sync, broadcast-channel]
dependency_graph:
  requires: []
  provides:
    - normalizeMainPlate
    - normalizeDateTimeMinute
    - isSameScaleTicket
    - deduplicateBargeTrucks
  affects:
    - src/services/weighbridge/WeighbridgeService.ts
    - src/components/tools/WeighbridgePrinter.vue
    - src/components/tools/CargoAllocator.vue
    - src/services/excel/WarehouseInventoryService.ts
tech_stack:
  added: []
  patterns:
    - Two-layer scale ticket identity matching (Ticket Code + Physical Trip Signature)
    - Async mutex with pending re-run queue and BroadcastChannel debounce
    - Vue nextTick-guarded BroadcastChannel watch suppression
key_files:
  created:
    - src/services/excel/__tests__/WeighbridgeSyncDedup.spec.ts
  modified:
    - src/services/weighbridge/WeighbridgeService.ts
    - src/components/tools/WeighbridgePrinter.vue
    - src/components/tools/CargoAllocator.vue
    - src/services/excel/WarehouseInventoryService.ts
decisions:
  - Use a 2-layer identity matcher (`isSameScaleTicket`) combining ticket codes (`ticketNo`/`sourceTicketNo`) and Physical Trip Signature (`normalizeMainPlate` + `weightNet` + `dateOut`/`dateIn` minute or same day + `weight1`/`weight2`) because `weighbridge_trucks` in Supabase does not persist `sourceTicketNo` and `WeighbridgePrinter.vue` overwrites `ticketNo` to `000001/MMYY`.
  - Automatically deduplicate barge trucks and delete duplicate `removedIds` from Supabase inside both `WeighbridgeService.getTrucks` and `WeighbridgeService.saveTrucks`.
  - Guard `CargoAllocator.vue` BroadcastChannel and initial load mutations with `await nextTick()` before resetting `isSyncingFromChannel` / `isInitLoading` so Vue deep watchers do not re-broadcast incoming sync payloads.
metrics:
  duration: 14m
  completed_date: "2026-11-01"
  status: complete
---

# Quick Task 261101-tnn: Kiểm tra lại cơ chế đồng bộ phiếu cân từ Phân bổ hàng hóa sang In phiếu cân xe Summary

**Two-layer physical trip signature deduplication (`isSameScaleTicket` & `deduplicateBargeTrucks`), mutex-locked sync in `WeighbridgePrinter.vue`, and `nextTick`-guarded `BroadcastChannel` handling in `CargoAllocator.vue` to eliminate duplicate weighbridge tickets.**

## Performance

- **Duration:** 14 min
- **Started:** 2026-11-01T14:34:00Z
- **Completed:** 2026-11-01T14:48:00Z
- **Tasks:** 3 / 3 completed
- **Files modified:** 5

## Accomplishments

- Implemented and exported `normalizeMainPlate`, `normalizeDateTimeMinute`, `isSameScaleTicket`, and `deduplicateBargeTrucks` in `WeighbridgeService.ts` so tickets remain uniquely matched even after `ticketNo` is re-numbered to `000001/MMYY` and reloaded from Supabase without `sourceTicketNo`.
- Automatic cleanup of existing duplicate trucks in `WeighbridgeService.getTrucks(bargeId)` and `WeighbridgeService.saveTrucks(bargeId, trucks)`, deleting redundant `removedIds` from Supabase `weighbridge_trucks` and updating IndexedDB (`wb_trucks_${bargeId}`).
- Protected `autoSyncAllBarges` and `syncFromAllocatorActiveBarge` in `WeighbridgePrinter.vue` with an async mutex (`isAllocatorSyncRunning` + `pendingAllocatorSync`), 150ms `BroadcastChannel` debounce, preserved `sourceTicketNo` in `regenerateAllTicketNumbers()`, and fixed `dateIn` fallback parsing so `date1Obj` is used when `dateInStr` is malformed.
- Fixed the `BroadcastChannel` echo loop in `CargoAllocator.vue` by awaiting `nextTick()` in `finally` blocks before resetting `isSyncingFromChannel` and `isInitLoading`, removed the `STT` fallback from `idxTicket` in CSV/Excel parsers, and unified duplicate checks across `CargoAllocator.vue` and `WarehouseInventoryService.syncRowsToAllocator`.
- Added unit tests in `src/services/excel/__tests__/WeighbridgeSyncDedup.spec.ts` covering re-numbered `ticketNo` matching, trailer plate / timestamp normalization, multi-trip same-day distinction, and `deduplicateBargeTrucks` cleanup.

## Task Commits

1. **Task 1: Xây dựng bộ nhận diện trùng lặp vật lý (`isSameScaleTicket` & `deduplicateBargeTrucks`) và khóa Mutex đồng bộ tại `WeighbridgeService.ts` + `WeighbridgePrinter.vue`** — `e6517c3` (`fix`)
2. **Task 2: Chặn vòng lặp BroadcastChannel (`nextTick`), bỏ fallback cột `STT` làm `ticketNo` và siết chặt khử trùng lặp tại `CargoAllocator.vue` + `WarehouseInventoryService.ts`** — `7089848` (`fix`)
3. **Task 3: Viết Unit Test kiểm증 toàn diện cơ chế khử trùng lặp đồng bộ phiếu cân** — `a78a5ef` (`test`)

## Files Created/Modified

- `src/services/weighbridge/WeighbridgeService.ts` — Added `normalizeMainPlate`, `normalizeDateTimeMinute`, `isSameScaleTicket`, `deduplicateBargeTrucks`, and integrated automatic deduplication + Supabase deletion into `getTrucks` and `saveTrucks`.
- `src/components/tools/WeighbridgePrinter.vue` — Added sync mutex + debounce on `weighbridge_sync_channel`, preserved `sourceTicketNo` during `regenerateAllTicketNumbers`, fixed `if (!dIn && t.date1Obj)` fallback, and filtered synced trips via `isSameScaleTicket` and `deduplicateBargeTrucks`.
- `src/components/tools/CargoAllocator.vue` — Added `await nextTick()` before resetting `isSyncingFromChannel` / `isInitLoading`, removed `h === 'stt'` from `idxTicket`, and upgraded `getHistoryDuplicates`, `mergeTickets`, `loadTicketsFromSupabase`, and `onMounted` with `isSameScaleTicket` & `deduplicateBargeTrucks`.
- `src/services/excel/WarehouseInventoryService.ts` — Updated `syncRowsToAllocator` to match existing allocator tickets using `ticketNo`/`sourceTicketNo`, `isSameScaleTicket`, and physical signature fallback.
- `src/services/excel/__tests__/WeighbridgeSyncDedup.spec.ts` — Unit tests for `normalizeMainPlate`, `normalizeDateTimeMinute`, `isSameScaleTicket`, and `deduplicateBargeTrucks`.

## Decisions Made

- Used a two-layer physical trip matcher (`isSameScaleTicket`) rather than relying solely on `ticketNo`/`sourceTicketNo` because `weighbridge_trucks` in Supabase does not store `source_ticket_no`, and `WeighbridgePrinter.vue` overwrites `ticketNo` with sequential `000001/MMYY` numbers.
- Cleaned up existing duplicates transparently inside `WeighbridgeService.getTrucks` and `WeighbridgeService.saveTrucks` so any barge already affected by duplicated rows is healed automatically on load or save.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- In `WeighbridgeSyncDedup.spec.ts`, importing `WeighbridgeService` without mocking `DBContext` triggered an unhandled `ReferenceError: indexedDB is not defined` in Vitest's Node environment; resolved by mocking `@/services/storage/DBContext` and `@/supabase` in the test file (matching `tests/WeighbridgeService.spec.ts`).

## Self-Check: PASSED

- All 3 tasks executed and committed atomically (`e6517c3`, `7089848`, `a78a5ef`).
- All 15 unit test files (64 tests) pass and production build (`npm run build`) succeeds with exit code 0.
