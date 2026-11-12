---
status: resolved
trigger: "Investigate whether Demo Sandbox mode affects or leaks into the main production execution flow"
created: "2026-11-12T04:18:00Z"
updated: "2026-11-12T04:44:30Z"
---

## Current Focus
- **hypothesis**: All 4 isolation boundary defects between Demo Sandbox and the Main Production Flow have been resolved and verified by unit tests (`DemoSandboxIsolation.spec.ts`) and the full test/build suite.
- **test**: Executed `npx vitest run` (19 test files, 101 tests passed) and `npm run build` (`vue-tsc -b && vite build`).
- **expecting**: 100% pass with zero cross-contamination between Demo Sandbox and Main Production Flow.
- **next_action**: Hand off to `@verifier` for independent verification.

## Symptoms
- **Expected behavior**: Demo Sandbox (`loginAsDemo` / `user === 'demo'`) must be 100% isolated from the main production flow. Normal/admin users and guest visitors must never have their IndexedDB cache, `localStorage` keys, in-memory caches, or Supabase queries polluted or altered by Demo mode.
- **Actual behavior**:
  1. `DBContext.ts` wrote raw unprefixed keys (`wb_vessels`, `warehouse_inventory_tickets`, `warehouse_configs`, `allocator_tickets`, `master_category-warehouses`, etc.) to IndexedDB `'ngocanh-portfolio-db'` and `localStorage` fallback regardless of Demo mode.
  2. When a Demo user edited a barge config (`WeighbridgeService.updateBargeConfig`), `wb_vessels` in real IndexedDB received a newer `updatedAt` timestamp; when an Admin later logged in, `WeighbridgeService.getVessels()` saw `localTime > remoteTime` and automatically wrote the Demo barge config into production Supabase.
  3. `auth.ts` used an asynchronous Vue `watch(authStore)` without `{ flush: 'sync' }`: calling `logout()` removed `auth_session` synchronously and then the queued watcher re-wrote `auth_session` on the next microtask tick; calling `login(username, pass)` executed `authService.login()` before clearing `isDemoMode`, routing real login queries through `createDemoQueryBuilder`.
  4. `isDemoActive()` in `src/supabase.ts` did not check `portfolio_login_expiry` / session expiry or strict `user === 'demo' && isAuthenticated !== false`.
  5. Direct `localStorage` writes (`weighbridge_master_data`, `weighbridge_default_layout`, `weighbridge_default_company_details`) overwrote production defaults during Demo mode.
  6. In-memory caches (`vesselsMemoryCache`, `tripsCache`, `settingsCache`, `cachedCustomPlaceMap`) and `<KeepAlive>` component instances were not invalidated/re-keyed when switching between Demo and Admin/guest.
  7. `createDemoQueryBuilder` in `src/supabase.ts` failed to update `currentBuilder` when `.select()` returned a `PostgrestFilterBuilder`, breaking chained methods (`.order()`, `.range()`, `.single()`, `.maybeSingle()`, `.in()`, `.neq()`), `.upsert()` deduplication, and `.range()` pagination.
- **Error messages**: `TypeError: ... is not a function` in Demo query chains and silent data corruption in production IndexedDB/Supabase after exiting Demo mode.
- **Timeline**: Present since initial Demo Sandbox implementation.
- **Reproduction**: Log in via Demo Sandbox (`loginAsDemo`), modify vessels/configs/tickets, then log out and log in as Admin.

## Evidence
- timestamp: 2026-11-12T04:18:20Z
  source: `src/services/storage/DBContext.ts:35-139`
  finding: `DBContext` (`get`, `set`, `delete`, `clear`) used raw keys without checking `DemoSandboxService.isDemoMode()`.
- timestamp: 2026-11-12T04:26:06Z
  source: `@storage-auditor` report (#6) — `src/services/weighbridge/WeighbridgeService.ts:754-780` & `src/services/excel/WarehouseInventoryService.ts:1749-1998`
  finding: Confirmed production write-back leak (`WeighbridgeService.getVessels()` pushed Demo `wb_vessels` barge configs with newer `updatedAt` to production Supabase on Admin login) and local IndexedDB precedence pollution in `WarehouseInventoryService.getVehicles()`, `getConfigs()`, `getAllTickets()`, and `MasterCategoryManager.vue` (`master_category-warehouses`, `weighbridge_custom_place_map`).
- timestamp: 2026-11-12T04:26:06Z
  source: `@storage-auditor` report (#6) — `src/App.vue:280-284`, `src/views/workspace/UnifiedWorkspaceView.vue:221-232`, `src/stores/auth.ts:103-192`
  finding: Confirmed in-memory caches (`WeighbridgeService.invalidateVesselsCache`, `AllocatorService.invalidateCache`, `SettingsService.invalidateCache`, `WarehouseInventoryService` `cachedCustomPlaceMap`) and `<KeepAlive>` component instances persisted across Demo <-> Admin transitions.
- timestamp: 2026-11-12T04:27:27Z
  source: `@supabase-auditor` report (#7) — `src/stores/auth.ts:96-174` & `src/supabase.ts:17-206`
  finding: Confirmed async `watch(authStore)` race condition on `logout()` / `login()` / `loginAsDemo()`, missing `portfolio_login_expiry` check in `isDemoMode()`, and `createDemoQueryBuilder` failing to update `currentBuilder` to the `PostgrestFilterBuilder` returned by `.select()`.

## Eliminated
- hypothesis: `supabase` Proxy alters or intercepts queries when `isDemoMode()` is `false`
  reason: When `isDemoMode()` evaluates to `false`, `supabase.from(tableName)` returns `rawSupabase.from(tableName)` directly without wrapping in `createDemoQueryBuilder`. Hardened `Reflect.get` receiver binding (`val.bind(target)`) on `supabase` Proxy.

## Resolution
- **root_cause**:
  1. `DBContext` did not namespace IndexedDB / fallback `localStorage` keys with `demo_sandbox_` when `DemoSandboxService.isDemoMode()` is active, allowing Demo operations to overwrite production IndexedDB keys (`wb_vessels`, `warehouse_inventory_tickets`, `warehouse_configs`, `allocator_tickets`, etc.) and even sync back to production Supabase upon subsequent Admin login.
  2. `DemoSandboxService` lacked a centralized `isDemoMode()` check validating `auth_session` (`isAuthenticated !== false && isDemoMode === true && user === 'demo'`) and `portfolio_login_expiry`, while `auth.ts` had async watcher race conditions during `login()`, `loginAsDemo()`, and `logout()`.
  3. Direct `localStorage` keys (`weighbridge_master_data`, `weighbridge_default_layout`, `weighbridge_default_company_details`), in-memory service caches, and `<KeepAlive>` views were not isolated or invalidated across Demo/Production transitions.
  4. `createDemoQueryBuilder` in `src/supabase.ts` discarded the `PostgrestFilterBuilder` returned by `.select()` and lacked complete handling for `.upsert()`, `.range()`, `.single()`, `.maybeSingle()`, `.in()`, and `.neq()`.
- **fix**:
  1. **`src/services/storage/DemoSandboxService.ts`**: Added `isDemoMode()` (checking `portfolio_login_expiry`, `expiresAt`, `isAuthenticated`, `user === 'demo'`, and `isDemoMode`), `resolveKey(key)` (`demo_sandbox_` prefix), `getLocalItem`/`setLocalItem`/`removeLocalItem`, `onReset` callbacks, upsert deduplication by conflict/natural keys, `.delete().in()` (`addDeletedMany`), `.delete().neq()` (`addDeleteNeq`), and pagination-safe `applyOverlay` (`rangeFrom === 0`).
  2. **`src/services/storage/DBContext.ts`**: Isolated `get`, `set`, `delete`, and `clear` in Demo mode using `resolveKey(key)` (`demo_sandbox_` prefix) plus `clearDemoData()` registered via `DemoSandboxService.onReset`, ensuring production IndexedDB and `localStorage` keys are never overwritten or cleared in Demo mode. Also guarded `typeof indexedDB === 'undefined'` to prevent unhandled rejections in headless/SSR environments.
  3. **`src/supabase.ts`**: Updated `isDemoActive()` to use `DemoSandboxService.isDemoMode()`, updated `createDemoQueryBuilder` to track `currentBuilder` when `.select()` transitions from `PostgrestQueryBuilder` to `PostgrestFilterBuilder`, added full support for `.upsert()`, `.range()`, `.single()`, `.maybeSingle()`, `.in()`, `.neq()`, and bound `rawSupabase` receiver in `supabase` Proxy.
  4. **`src/stores/auth.ts`**: Added `{ flush: 'sync' }` to `watch(authStore)`, ensured `login()` exits Demo mode and resets sandbox BEFORE calling `authService.login()`, ensured `logout()` clears `authStore` and `localStorage` BEFORE awaiting `authService.logout()`, and added `invalidateAllSessionCaches()` across `loginAsDemo()`, `login()`, `logout()`, and cross-tab `storage` events.
  5. **`src/App.vue`, `src/views/workspace/UnifiedWorkspaceView.vue`, `src/services/weighbridge/WeighbridgeService.ts`, `src/components/tools/WeighbridgePrinter.vue`, `src/services/excel/WarehouseInventoryService.ts`**: Keyed `<KeepAlive>` components by `${authStore.user}-${authStore.isDemoMode}`, reloaded `ContentService.loadAll()` on auth transitions, routed direct `localStorage` template/master-data writes through `DemoSandboxService.setLocalItem`/`getLocalItem`, and added `WarehouseInventoryService.clearPlaceMapCache()`.
- **verification**:
  - Added 8 unit tests in `src/services/storage/__tests__/DemoSandboxIsolation.spec.ts` covering `isDemoMode()` expiry/auth transitions, `DBContext` key isolation, `localStorage` isolation, and `createDemoQueryBuilder` chaining/upsert/pagination.
  - `npm test`: 19 test files passed, 101 tests passed.
  - `npm run build`: `vue-tsc -b && vite build` passed with exit code 0.
- **files_changed**:
  - `src/services/storage/DemoSandboxService.ts`
  - `src/services/storage/DBContext.ts`
  - `src/supabase.ts`
  - `src/stores/auth.ts`
  - `src/App.vue`
  - `src/views/workspace/UnifiedWorkspaceView.vue`
  - `src/services/weighbridge/WeighbridgeService.ts`
  - `src/components/tools/WeighbridgePrinter.vue`
  - `src/services/excel/WarehouseInventoryService.ts`
  - `src/services/storage/__tests__/DemoSandboxIsolation.spec.ts`
