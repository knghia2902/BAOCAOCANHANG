---
phase: 24-web-query-speed-optimization
plan: 01
type: execute
wave: 1
depends_on: [22, 23]
files_modified:
  - src/services/storage/SettingsService.ts
  - src/services/ContentService.ts
  - src/services/auth/PermissionService.ts
  - src/services/weighbridge/WeighbridgeService.ts
  - src/services/weighbridge/WeighbridgeOtherService.ts
  - src/services/excel/VehicleService.ts
  - src/services/excel/WarehouseInventoryService.ts
  - src/services/excel/AllocatorService.ts
  - src/views/workspace/UnifiedWorkspaceView.vue
  - src/views/tools/UtilitiesView.vue
  - src/views/AdminView.vue
  - src/components/tools/WeighbridgePrinter.vue
  - src/components/tools/WarehouseInventoryManager.vue
  - src/components/tools/SingleBargeAllocator.vue
  - src/components/tools/CargoAllocator.vue
  - src/components/workspace/WeighbridgeDataImporter.vue
  - src/components/tools/GoodsManager.vue
  - src/components/tools/VehicleManager.vue
  - src/components/tools/BargeProfileManager.vue
  - src/components/tools/BargeMinutes.vue
autonomous: true
requirements:
  - PERF-HIGH-01
  - PERF-HIGH-02
  - PERF-HIGH-03
  - PERF-HIGH-04
  - PERF-MED-01
  - PERF-MED-02
  - PERF-MED-03
---

# Phase 24 — Plan: Tối Ưu Hóa Tốc Độ Truy Vấn Web & Hiệu Năng (GSD + GitNexus)

## Tổng Quan Chiến Lược 2 Đợt (2 Waves)

- **Wave 1 (Đang thực thi — Nhóm 1 High Impact + Nhóm 2 Medium Impact):** Giải quyết triệt để các điểm nghẽn mạng (N+1 queries, double/triple fetches, 2-RTT settings writes, sequential IndexedDB/Supabase waterfalls) và các điểm nghẽn CPU/DOM (eager loading 10 heavy components, `O(N²)` array scans, un-debounced `{ deep: true }` watchers, unpaginated input tables).
- **Wave 2 (Giai đoạn tiếp theo sau khi xong Wave 1 — Nhóm 3 Low Impact):** Bổ sung Composite Indexes trên PostgreSQL/Supabase (`database/migrations/`), tối ưu fast-path đăng nhập nội bộ trong `AuthService.login()`, và tối ưu serialization bất đồng bộ trong `DBContext.ts` + tra cứu `O(1)` trong `DemoSandboxService.ts`.

---

## Phân Tích Tác Động Đồ Thị GitNexus (Upstream Impact Analysis)

Đã chạy `node .gitnexus/run.cjs impact "<symbol>" --direction upstream --repo .` trên chỉ mục GitNexus v1.6.12 (`bf5e0a2`, 5,129 symbols, 12,148 edges, 178 flows):

| Symbol | File Định Nghĩa | Kết Quả Đồ Thị GitNexus | Xác Thực Cross-Language (Vue `<script setup>` & Namespace Object) |
|---|---|---|---|
| `WeighbridgeService.getTrucks` | `src/services/weighbridge/WeighbridgeService.ts` | `risk: UNKNOWN` (Namespace object export) | Được gọi tại `WeighbridgePrinter.vue` (7 vị trí: `refreshGlobalBargesSummary`, `refreshVesselSummary`, `openSettlementModal`, `selectBarge`, `autoSyncAllBarges`, watchers), `BargeMinutes.vue`, `ShipmentSettlementService.ts`, `WeighbridgeService.ts` (`deleteTruck`). Giữ nguyên chữ ký `getTrucks(bargeId, forceRefresh = false)` và bổ sung `getTrucksByBargeIds(bargeIds, forceRefresh = false)` để tương thích ngược 100%. |
| `VehicleService.getVehicles` & `WarehouseInventoryService.getVehicles` | `src/services/excel/VehicleService.ts:27` & `WarehouseInventoryService.ts:1893` | `VehicleService.getVehicles`: `risk: LOW` (3 direct callers); `WarehouseInventoryService.getVehicles`: `risk: UNKNOWN` | Được gọi từ `WarehouseInventoryService.ts` (`getVehicles`, `getValidCarriers`, `importWeighbridgeCsvFiles`, `reapplyVehicleCarriersAndWarehouses`), `WarehouseInventoryManager.vue`, `VehicleManager.vue`, `SingleBargeAllocator.vue`, `CargoAllocator.vue`, `WeighbridgeDataImporter.vue`. Thêm tham số tùy chọn `forceRefresh = false` giữ nguyên tương thích ngược. |
| `WarehouseInventoryService.getAllTickets` | `src/services/excel/WarehouseInventoryService.ts:2079` | `risk: UNKNOWN` (Namespace object export) | Được gọi trong `WarehouseInventoryService.ts` (`exportSingleWarehouseWorkbook`, `exportCombined123WarehouseWorkbook`, `reapplyVehicleCarriersAndWarehouses`, `clearWarehouseTickets`, `importWeighbridgeCsvFiles`) và `WarehouseInventoryManager.vue` (`loadAllData`). Thêm bộ đệm TTL 30s + `invalidateCache()`. |
| `WarehouseInventoryService.getConfigs` | `src/services/excel/WarehouseInventoryService.ts:1788` | `risk: UNKNOWN` (Namespace object export) | Được gọi trong `WarehouseInventoryService.ts` và `WarehouseInventoryManager.vue`. Thêm bộ đệm TTL 30s + in-flight deduplication. |
| `ContentService.loadAll` | `src/services/ContentService.ts:11` | `risk: UNKNOWN` (Namespace object export) | Được gọi đồng thời từ `src/App.vue:106`, `src/views/HomeView.vue:19`, `src/views/AdminView.vue:942`. Thêm in-flight promise deduplication + TTL cache 30s. |
| `SettingsService.getSettings` | `src/services/storage/SettingsService.ts:13` | `risk: LOW` (12 direct callers across services) | Đã có in-memory cache + in-flight deduplication. Bổ sung `updateSettings(patch)` để hợp nhất các luồng đọc-sửa-ghi `content.settings` về 1 RTT và đồng bộ cache tức thì. |
| `WeighbridgeService.saveTrucks` | `src/services/weighbridge/WeighbridgeService.ts:1535` | `risk: UNKNOWN` (Namespace object export) | Được gọi từ `WeighbridgePrinter.vue`, `WeighbridgeDataImporter.vue`, `WarehouseInventoryService.ts`. Tăng `chunkSize` từ 100 lên 500 và tự động xóa/cập nhật `trucksMemoryCache`. |
| `AllocatorService.syncScaleHeadByTicketNo` | `src/services/excel/AllocatorService.ts:211` | `risk: LOW` (1 direct caller: `getAllTrips` tại dòng 312) | Chỉ kích hoạt khi `allRows.some(r => !r.file_source)` để tránh 2 lệnh `UPDATE ... ILIKE` quét toàn bảng trên mỗi lần đọc. |

---

## WAVE 1 (ĐANG THỰC THI): NHÓM 1 (HIGH IMPACT) + NHÓM 2 (MEDIUM IMPACT)

### Phân hệ A — Tầng Services (`src/services/**` — Owner: `@perf-services`)

1. **[HIGH-4] `src/services/storage/SettingsService.ts`:**
   - Bổ sung `updateSettings(patch: Record<string, any>): Promise<boolean>` thực hiện merge `patch` với cấu hình hiện tại (từ cache hoặc `getSettings()`), gọi `supabase.from('content').update({ settings: merged }).eq('id', 'main')` trong **1 RTT**, và cập nhật `settingsCache`.
2. **[HIGH-4] `src/services/ContentService.ts` & `src/services/auth/PermissionService.ts`:**
   - Thêm in-flight promise deduplication + TTL cache (30s) cho `ContentService.loadAll()`.
   - Chuyển `saveStaffTools` và `saveRolePermissions` trong `PermissionService.ts` sang dùng `SettingsService.updateSettings()`.
3. **[HIGH-1, HIGH-3, HIGH-4, MED-2] `src/services/weighbridge/WeighbridgeService.ts` & `WeighbridgeOtherService.ts`:**
   - Thêm `trucksMemoryCache` (TTL 30s, tắt trong môi trường test) + `trucksInFlightMap` cho `getTrucks(bargeId, forceRefresh = false)`.
   - Thêm `getTrucksByBargeIds(bargeIds: number[], forceRefresh = false): Promise<Record<number, Truck[]>>` dùng `.in('barge_id', missingIds)` gom 50–100+ truy vấn N+1 thành **1 truy vấn duy nhất**.
   - Tự động xóa/cập nhật `trucksMemoryCache` khi gọi `saveTrucks`, `saveSingleTruck`, `deleteTruck`, `clearBargeTrucks`, `deleteAllTrucksForBarge`.
   - Tối ưu `deduplicateBargeTrucks()` từ `.some()` lồng nhau `O(N²)` sang `Set`/`Map` `O(1)`.
   - Dùng `SettingsService.updateSettings` trong `saveMasterData` và `saveGlobalTicketTemplate`.
   - Tăng `chunkSize = 500` trong `WeighbridgeService.saveTrucks` và `WeighbridgeOtherService.saveWarehouseTickets` / `saveContainerTickets`; dùng `Promise.all` trong `deleteTruck(id)`.
4. **[HIGH-3, HIGH-4, MED-2] `src/services/excel/VehicleService.ts`, `WarehouseInventoryService.ts` & `AllocatorService.ts`:**
   - Thêm in-memory cache (TTL 30s, tắt khi test) + in-flight deduplication cho `VehicleService.getVehicles()` và các hàm `getConfigs()`, `getVehicles()`, `getAllTickets()`, `getVisualMapState()` trong `WarehouseInventoryService.ts`.
   - Song song hóa `Promise.all` trong `WarehouseInventoryService.getVehicles()`, `importWeighbridgeCsvFiles()`, `exportSingleWarehouseWorkbook()`, `exportCombined123WarehouseWorkbook()`; bỏ lệnh gọi thừa `VehicleService.getVehicles()` trong `getValidCarriers()`.
   - Tối ưu `findMatchingExistingTicket()` và `syncRowsToAllocator()` sang tra cứu `Map` `O(1)`; gom nhóm `whTickets` theo `reportDate` trước vòng lặp ngày trong `computeWarehouseFinalTable()`.
   - Trong `AllocatorService.getAllTrips()`, chỉ gọi `syncScaleHeadByTicketNo()` khi `allRows.some(r => !r.file_source)`.

### Phân hệ B — Tầng Views & Components (`src/views/**`, `src/components/**` — Owner: `@perf-views`)

1. **[HIGH-2] Lazy-load Heavy Components (`UnifiedWorkspaceView.vue` & `UtilitiesView.vue`):**
   - Chuyển 9 component không phải tab mặc định trong `UnifiedWorkspaceView.vue` và 3 component công cụ trong `UtilitiesView.vue` sang `defineAsyncComponent(() => import(...))`.
2. **[HIGH-1, HIGH-4] `src/components/tools/WeighbridgePrinter.vue`:**
   - Chuyển `refreshGlobalBargesSummary()`, `refreshVesselSummary()`, `openSettlementModal()`, `autoSyncAllBarges()` sang sử dụng `WeighbridgeService.getTrucksByBargeIds(bargeIds)`.
   - Gộp 2 watcher rời `watch(activeVesselId)` và `watch(activeBargeId)` thành 1 watcher chung `watch([activeVesselId, activeBargeId])`.
   - Dùng `SettingsService` thay cho truy vấn `content.settings` trực tiếp.
3. **[HIGH-3, MED-3] `src/components/tools/WarehouseInventoryManager.vue`:**
   - Chống gọi kép `loadAllData()` khi `onMounted` và `onActivated` chạy cùng lúc.
   - Bổ sung phân trang client-side (100 dòng/trang, chuẩn DESIGN.md) cho bảng chi tiết phiếu cân (`filteredDetailTickets`).
4. **[MED-1, HIGH-4] `SingleBargeAllocator.vue`, `CargoAllocator.vue`, `WeighbridgeDataImporter.vue` & các Component Danh mục / Admin:**
   - Gom chuỗi `await dbContext.get(...)` tuần tự trong `onMounted` vào `Promise.all`.
   - Debounce `300ms` cho các `watch(..., { deep: true })` lưu IndexedDB / tái tạo chuyến.
   - Tạo `computed Map` cho `formatPlate()` (`O(1)`) và `computed Set` cho `isAlreadySaved()` (`O(1)`).
   - Song song hóa `Promise.all` trong `AdminView.vue` `onMounted` và dùng `SettingsService` cho `GoodsManager.vue`, `VehicleManager.vue`, `BargeProfileManager.vue`, `BargeMinutes.vue`.

---

## WAVE 2 (GIAI ĐOẠN TIẾP THEO SAU WAVE 1): NHÓM 3 (LOW IMPACT)

1. **[LOW-1] Database Composite Indexes (`database/migrations/`):**
   - Tạo file migration SQL mới bổ sung composite indexes cho `warehouse_inventory_tickets (report_date ASC, weigh_out_time ASC)`, `warehouse_inventory_tickets (so_phieu)`, `weighbridge_allocation_tracking (barge_id, created_at DESC)`, và `weighbridge_trucks (barge_id, created_at ASC)`.
   - Nhắc người dùng chạy file SQL trong Supabase SQL Editor theo đúng quy tắc Database Migration Workflow.
2. **[LOW-2] Tối ưu `AuthService.login()` (`src/services/storage/AuthService.ts`):**
   - Khi đăng nhập bằng username nội bộ (không chứa `@`), tra cứu bảng `public.users` trước hoặc song song thay vì luôn chờ `supabase.auth.signInWithPassword` trả lỗi 400.
3. **[LOW-3] Tối ưu `DBContext.ts` & `DemoSandboxService.ts`:**
   - Không chặn câu lệnh `return` chờ ghi cache IndexedDB ở các luồng đọc mạng; dùng `Promise.all` trong `clearDemoData()`; dùng `Map` `O(1)` trong `DemoSandboxService.addInserted()`.
