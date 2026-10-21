---
phase: quick
plan: 261021-h9k
subsystem: split-allocator
tags: [performance, cache, prefetch, allocator, weighbridge]
status: complete
completed_date: "2026-10-21"
key_files:
  modified:
    - src/components/tools/SingleBargeAllocator.vue
---

# Quick Task 261021-h9k Summary: Tối ưu tốc độ tải phiếu cân khi click chọn tàu / sà lan

## One-Liner
Eliminated the loading delay when clicking on a barge in `SingleBargeAllocator.vue` by adding batch prefetching (`prefetchDeHeusBargeTrucks`), an in-memory cache (`bargeTicketsCache`) + IndexedDB instant lookup, and decoupling background Supabase sync from the UI loading state.

## Root Cause & Fix
1. **Why it was slow before**:
   - Every click on a barge triggered a fresh network fetch (`WeighbridgeService.getTrucks(bId)`).
   - Even worse, `loadTicketsFromSourceBarge` awaited `saveTicketsToSupabase()` (which had a 200ms debounce, fetched `content.settings`, tried to upload 16,000+ `split_allocator_history_trips`, failed, and retried with fallback) AND awaited `LogService.logAction()` before setting `isLoadingSourceBargeTrucks.value = false`.
2. **Fixes applied**:
   - Added `bargeTicketsCache` (`Map<number, CSVRecord[]>`) and `prefetchDeHeusBargeTrucks()` which warms cache from IndexedDB and batch-fetches all De Heus barge trucks in a single `.in('barge_id', bargeIds)` Supabase query when vessels load.
   - Updated `loadTicketsFromSourceBarge()` to render cached/IndexedDB tickets immediately (0ms) with silent background refresh from Supabase, and removed blocking `await saveTicketsToSupabase()` / `await LogService.logAction()` calls.
   - Removed the redundant `split_allocator_history_trips` payload from `doExecuteSaveTicketsToSupabase()`.
