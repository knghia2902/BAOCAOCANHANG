# Phase 09: Allocator Database Migration & Data Recovery - Research Document

**Date:** 2026-09-17  
**Status:** Complete & Ready for Planning  
**Requirements Addressed:** `DB-MIGRATE-01`, `DATA-RECOVER-01`, `ALLOCATOR-SYNC-01`

---

## 1. Executive Summary & Root Cause Analysis

### 1.1 The Anti-Pattern
In `CargoAllocator.vue`, historical trips (`existingTrips`) are loaded from and persisted directly to the single row `id = 'main'` in the Supabase `content` table under `settings.allocator_history_trips`.
Over months of operation, this JSON array has accumulated **16,303 records**, resulting in a JSON payload of approximately **7.2 MB**.

### 1.2 The Failure Cascade
Whenever a user saves new trips or syncs data from Tab 2 or Tab 3:
1. `doExecuteSaveTicketsToSupabase()` serializes all 16,303 objects into `content.settings.allocator_history_trips`.
2. Supabase PostgREST rejects or times out on requests exceeding payload limits (HTTP 500 / 413 / Gateway Timeout).
3. The fallback mechanism (lines 1458–1465 in `CargoAllocator.vue`) caught the error and re-sent `content.settings` **without** `allocator_history_trips` to prevent breaking the rest of the application.
4. Consequently, trips generated between **11/09/2026 and 15/09/2026 (1,657 trips)** were never committed to `allocator_history_trips` in remote storage, even though truck weighings were stored in the relational table `weighbridge_trucks`.

### 1.3 The Solution Architecture
1. **Dedicated Relational Table**: Create `allocator_history_trips` in Supabase Postgres with appropriate typed columns, constraints, and indexes.
2. **Zero Data-Loss Migration**: Export static JSON backup (`.planning/backups/allocator_history_trips_backup_16303.json`), then migrate 16,303 historical records in chunks of 500.
3. **Audit-Grade Recovery**: Query `weighbridge_trucks` cross-referenced with `weighbridge_barges` for dates 11/09/2026–15/09/2026, generate a detailed Preview Report, and upon user confirmation insert the 1,657 reconstructed trips tagged with `is_recovered: true` and notes `Khôi phục từ phiếu cân`.
4. **Decoupled Service Layer**: Create `src/services/excel/AllocatorService.ts` encapsulating all Supabase queries, handling PostgREST 1,000-row pagination chunking, and mapping between snake_case DB columns and camelCase `SplitTrip`.
5. **Component Refactor**: Upgrade `CargoAllocator.vue` Tab 3 (Theo dõi) to default to a high-speed 30-day window (<0.5s initial load), lazy-load out-of-range dates or full history on demand, and replace monolithic array overwrites with atomic chunked inserts.
6. **Safe Cleanup**: After verifying parity (16,303 + 1,657 = 17,960 records), clean the 7MB blob from `content.settings`, shrinking `content` from 7MB to < 10KB.

---

## 2. Codebase Investigation Findings

### 2.1 `CargoAllocator.vue` Analysis

#### `SplitTrip` Interface (`src/components/tools/CargoAllocator.vue`: Lines 133–155)
```typescript
interface SplitTrip {
    stt: number;
    timeStr: string;
    plateNumber: string;
    tttp: number;
    limit: number;
    ticketNo: string;
    sourceTicketNo?: string; // Original CSV ticketNo for ALL splits (not just first)
    cargoType: string;
    weightTons: number;
    notes: string;
    isNew?: boolean;
    // Fields matching manual allocation format
    customer: string;
    weight1: number;
    weight2: number;
    weightNet: number;
    direction: string;
    bargeName: string;
    date1Obj: Date;
    date2Obj: Date;
    orderNo?: string;
}
```

#### State & Data Flow in Tab 3
- **Local State**: `const existingTrips = ref<SplitTrip[]>([]);`
- **Initial Load (`loadTicketsFromSupabase`, lines 1314–1327)**:
  Fetches `data.settings.allocator_history_trips`, passes it through `hydrateTrips()`, assigns to `existingTrips.value`, and saves into IndexedDB `allocator_history_trips`.
- **Filtering (`filteredHistoryTrips`, lines 2702–2719)**:
  Filters `existingTrips.value` by `historyFilterDate` (using `matchTripDate(t, date)`), `historySearchQuery` (matching `plateNumber`, `ticketNo`, `cargoType`), and sorts by `historySortKey` / `historySortDesc`.
- **Pagination (`pagedHistoryTrips`, lines 2721–2724)**:
  Slices `filteredHistoryTrips.value` using `historyCurrentPage` and `itemsPerPage`.
- **Append / Save from Tab 2 (`saveTripsToHistory`, lines 2826–2850)**:
  Concatenates `existingTrips.value = [...existingTrips.value, ...generatedTrips.value];` and invokes `saveTicketsToSupabase()`.
- **Supabase Persistence (`doExecuteSaveTicketsToSupabase`, lines 1422–1465)**:
  Maps `existingTrips.value` to `cleanHistory` and pushes the entire array into `content.settings.allocator_history_trips`.
- **Record Edits / Deletes (lines 2871–2908)**:
  `editHistoryTripOrderNo` and `deleteHistoryTrip` mutate `existingTrips.value` in memory and re-trigger full serialization via `saveTicketsToSupabase()`.

### 2.2 Weighbridge Schema & Relation Analysis

#### `weighbridge_trucks` Table
- Columns: `id` (bigint), `barge_id` (bigint FK), `ticket_no` (text), `plate_number` (text), `driver` (text), `weight_1` (numeric), `weight_2` (numeric), `weight_net` (numeric), `date_in` (text/timestamp), `date_out` (text/timestamp), `note` (text), `created_at` (timestamptz).
- Maps to `SplitTrip`:
  - `ticket_no` -> `ticketNo`
  - `plate_number` -> `plateNumber`
  - `weight_1` -> `weight1`
  - `weight_2` -> `weight2`
  - `weight_net` -> `weightNet`
  - `weight_net / 1000` -> `weightTons`
  - `date_in` -> `date1Obj`
  - `date_out` -> `date2Obj`

#### `weighbridge_barges` Table
- Columns: `id` (bigint PK), `vessel_id` (bigint), `name` (text), `config` (jsonb), `created_at` (timestamptz).
- JSONB `config` properties: `orderNo` (string), `goods` (string), `owner` (string), `operator` (string), `xn` (string).
- Maps to `SplitTrip`:
  - `barge.name` -> `bargeName`
  - `barge.config.orderNo` -> `orderNo`
  - `barge.config.goods` -> `cargoType`
  - `barge.config.owner || barge.config.operator` -> `customer`
  - `barge.config.xn || 'XUẤT KHẨU'` -> `direction`

#### Vehicle Capacities
- `getVehicleCapacity(plateNumber)` in `CargoAllocator.vue`: Computes `tttp` and `limit` from registry or default formula based on whether plate is a tractor-trailer (`mooc`).

---

## 3. Dedicated Table Schema Design

### 3.1 SQL Definition: `allocator_history_trips`

```sql
-- 1. Create table
CREATE TABLE IF NOT EXISTS public.allocator_history_trips (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    stt INTEGER,
    time_str TEXT,
    plate_number TEXT NOT NULL,
    tttp NUMERIC(10,2) DEFAULT 0,
    limit_weight NUMERIC(10,2) DEFAULT 0,
    ticket_no TEXT,
    source_ticket_no TEXT,
    cargo_type TEXT,
    weight_1 NUMERIC(12,2) DEFAULT 0,
    weight_2 NUMERIC(12,2) DEFAULT 0,
    weight_net NUMERIC(12,2) NOT NULL DEFAULT 0,
    weight_tons NUMERIC(10,3) NOT NULL DEFAULT 0,
    direction TEXT DEFAULT 'Xuất',
    barge_name TEXT,
    order_no TEXT,
    customer TEXT,
    date1_obj TIMESTAMPTZ,
    date2_obj TIMESTAMPTZ,
    notes TEXT,
    is_recovered BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Performance Indexes
CREATE INDEX IF NOT EXISTS idx_allocator_history_date1 ON public.allocator_history_trips (date1_obj DESC);
CREATE INDEX IF NOT EXISTS idx_allocator_history_plate ON public.allocator_history_trips (plate_number);
CREATE INDEX IF NOT EXISTS idx_allocator_history_ticket ON public.allocator_history_trips (ticket_no);
CREATE INDEX IF NOT EXISTS idx_allocator_history_order ON public.allocator_history_trips (order_no);
CREATE INDEX IF NOT EXISTS idx_allocator_history_customer ON public.allocator_history_trips (customer);
CREATE INDEX IF NOT EXISTS idx_allocator_history_time_str ON public.allocator_history_trips (time_str);
CREATE INDEX IF NOT EXISTS idx_allocator_history_recovered ON public.allocator_history_trips (is_recovered);

-- 3. Row Level Security (RLS) for Frontend Client (anon key)
ALTER TABLE public.allocator_history_trips ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow anon read allocator_history_trips" ON public.allocator_history_trips;
CREATE POLICY "Allow anon read allocator_history_trips" ON public.allocator_history_trips FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow anon insert allocator_history_trips" ON public.allocator_history_trips;
CREATE POLICY "Allow anon insert allocator_history_trips" ON public.allocator_history_trips FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Allow anon update allocator_history_trips" ON public.allocator_history_trips;
CREATE POLICY "Allow anon update allocator_history_trips" ON public.allocator_history_trips FOR UPDATE USING (true);

DROP POLICY IF EXISTS "Allow anon delete allocator_history_trips" ON public.allocator_history_trips;
CREATE POLICY "Allow anon delete allocator_history_trips" ON public.allocator_history_trips FOR DELETE USING (true);
```

*Note on Column Naming:* Postgres treats `limit` as a reserved SQL keyword. The column is named `limit_weight` in Postgres and mapped to `limit` in TypeScript.

---

## 4. Migration & Recovery Pipeline

### 4.1 Step 1: Backup Script (`scripts/backup_allocator_history.cjs`)
- Queries `content.settings.allocator_history_trips`.
- Validates that array length is >= 16,000.
- Writes to `.planning/backups/allocator_history_trips_backup_16303.json`.
- Prints MD5 checksum and file size for provenance.

### 4.2 Step 2: Migration Script (`scripts/migrate_allocator_history.cjs`)
- Reads the static backup JSON or fetches from `content.settings`.
- Transforms camelCase properties to snake_case table columns:
  - Parses dates (`date1Obj`, `date2Obj`) into ISO strings.
  - Formats numbers (`weightNet`, `weightTons`, `tttp`, `limit`).
  - Sets `is_recovered: false`.
- Performs chunked batch inserts (batches of 500 records) to avoid PostgREST payload limits.
- Progress reporting: `[Chunk 1/33] Inserted 500 records... Done.`

### 4.3 Step 3: Reconstruction & Recovery Script (`scripts/recover_missing_trips.cjs`)
- **Query Missing Window**: Fetches `weighbridge_trucks` where date (`date_in` or `date_out` or `created_at`) is between `2026-09-11 00:00:00` and `2026-09-15 23:59:59`.
- **Joins**: Matches `barge_id` against `weighbridge_barges` to extract `name`, `orderNo`, `goods`, `owner`.
- **Deduplication against Migrated Trips**: Excludes any ticket or `(plateNumber, timeStr)` combination already in `allocator_history_trips`.
- **Preview Mode**:
  Outputs a markdown table to console:
  - Breakdown by Date (11/09, 12/09, 13/09, 14/09, 15/09).
  - Breakdown by Barge / Order No / Customer.
  - Trip count and total tonnage per day and overall (~1,657 trips).
- **Execution Mode (`--confirm`)**:
  Inserts records into `allocator_history_trips` with:
  - `is_recovered = true`
  - `notes = note ? note + ' (Khôi phục từ phiếu cân)' : 'Khôi phục từ phiếu cân'`

### 4.4 Step 4: Parity Verification Script (`scripts/verify_parity.cjs`)
- Verifies total count: Expects ~17,960 records (16,303 original + 1,657 recovered).
- Validates random sample: 50 random records compared against backup JSON.
- Validates daily tonnage totals across July, August, September.

---

## 5. `AllocatorService.ts` Specification

### 5.1 Service Location
`src/services/excel/AllocatorService.ts` (re-exported via `src/services/index.ts`).

### 5.2 TypeScript Interface & Column Mapping
```typescript
export interface AllocatorTripRow {
    id?: number;
    stt: number;
    time_str: string;
    plate_number: string;
    tttp: number;
    limit_weight: number;
    ticket_no: string;
    source_ticket_no?: string;
    cargo_type: string;
    weight_1: number;
    weight_2: number;
    weight_net: number;
    weight_tons: number;
    direction: string;
    barge_name: string;
    order_no?: string;
    customer: string;
    date1_obj: string | Date | null;
    date2_obj: string | Date | null;
    notes: string;
    is_recovered?: boolean;
    created_at?: string;
}
```

### 5.3 Methods & Pagination Handling
**Critical PostgREST Constraint**: Supabase defaults to a max limit of 1,000 records per request. Methods fetching large datasets MUST page with `.range(start, start + 999)`.

1. `getRecentTrips(days: number = 30): Promise<SplitTrip[]>`
   - Calculates cutoff ISO date.
   - Queries `allocator_history_trips` where `date1_obj >= cutoff` ordered by `date1_obj DESC`.
   - Loops pages of 1,000 until all ~2,500 recent records are retrieved.
   - Converts rows to `SplitTrip` (`limit_weight` -> `limit`, string dates -> `Date`).

2. `getAllTrips(onProgress?: (loaded: number) => void): Promise<SplitTrip[]>`
   - Loops with `.range(from, from + 999)` until returned count < 1,000.
   - Invokes `onProgress(allTrips.length)` so UI can show a smooth progress bar for all 18,000 trips.

3. `getTripsByDate(ymd: string): Promise<SplitTrip[]>`
   - Queries between `ymd + 'T00:00:00.000Z'` and `ymd + 'T23:59:59.999Z'` (and checks `time_str` fallback).

4. `insertTrips(trips: SplitTrip[]): Promise<{ count: number; error: any }>`
   - Maps `SplitTrip[]` to `allocator_history_trips` rows.
   - Chunks into batches of 500 rows.
   - Runs `supabase.from('allocator_history_trips').insert(chunk)`.

5. `updateTripOrderNo(identifier: { id?: number; ticketNo?: string; plateNumber?: string; timeStr?: string }, orderNo: string): Promise<boolean>`
   - Executes precise row update.

6. `deleteTrip(identifier: { id?: number; ticketNo?: string; stt?: number }): Promise<boolean>`
   - Executes row deletion.

7. `clearAllTrips(): Promise<boolean>`
   - Truncates/deletes table data (admin only).

---

## 6. `CargoAllocator.vue` Refactoring Specification

### 6.1 Tab 3 Default 30-Day Window & UI Controls
- Replace the monolithic load in `loadTicketsFromSupabase`:
  ```typescript
  // Load recent trips from AllocatorService
  const recentTrips = await AllocatorService.getRecentTrips(30);
  existingTrips.value = recentTrips;
  await dbContext.set('allocator_history_trips', recentTrips);
  ```
- Add Toolbar Action:
  ```html
  <button 
      v-if="!isFullHistoryLoaded"
      @click="loadFullHistory" 
      :disabled="isLoadingFullHistory"
      class="px-3 py-1.5 text-xs font-semibold bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-lg flex items-center gap-1.5 transition-colors shadow-sm"
  >
      <span v-if="isLoadingFullHistory" class="animate-spin material-icons text-xs">refresh</span>
      <span v-else class="material-icons text-xs">cloud_download</span>
      {{ isLoadingFullHistory ? `Đang tải lịch sử... (${loadedHistoryCount})` : 'Tải toàn bộ lịch sử (18k+)' }}
  </button>
  <span v-else class="text-xs text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-md font-medium flex items-center gap-1">
      <span class="material-icons text-xs">check_circle</span> Đã tải toàn bộ
  </span>
  ```

### 6.2 Out-of-Range Date Fetching
When the user picks a date via `historyFilterDate`:
- If `existingTrips` has no trips matching that date AND full history is not loaded:
  ```typescript
  watch(historyFilterDate, async (newDate) => {
      if (!newDate) return;
      const hasLocalMatch = existingTrips.value.some(t => matchTripDate(t, newDate));
      if (!hasLocalMatch && !isFullHistoryLoaded.value) {
          isDateFetching.value = true;
          try {
              const remoteDayTrips = await AllocatorService.getTripsByDate(newDate);
              if (remoteDayTrips.length > 0) {
                  // Merge without duplicates
                  existingTrips.value = mergeTripsDeduplicated(existingTrips.value, remoteDayTrips);
                  addToast(`Đã tải ${remoteDayTrips.length} chuyến xe ngày ${newDate}`, 'success');
              }
          } finally {
              isDateFetching.value = false;
          }
      }
  });
  ```

### 6.3 Fast Save from Tab 2 (`saveTripsToHistory`)
- Instead of serializing 18,000 records into `content.settings`:
  ```typescript
  // 1. Bulk insert generated trips into allocator_history_trips
  const res = await AllocatorService.insertTrips(generatedTrips.value);
  if (res.error) throw res.error;

  // 2. Prepend/append to local existingTrips
  existingTrips.value = [...generatedTrips.value, ...existingTrips.value];

  // 3. Clear Tab 1 & generated tickets in content.settings (WITHOUT allocator_history_trips)
  csvRecords.value = [];
  await saveTicketsToSupabase(); // Now lightweight (< 5KB)!
  ```

### 6.4 Clean Removal of 7MB JSON Blob
- Update `doExecuteSaveTicketsToSupabase()`:
  Remove `allocator_history_trips: cleanHistory` from the update payload.
- Execute standalone script `scripts/cleanup_content_settings.cjs` to delete `settings.allocator_history_trips` from the `content` table once parity verification passes.

---

## 7. Verification Architecture & Quality Gates

### 7.1 Automated Verification Checks
1. **Count & Parity**:
   - Total rows in `allocator_history_trips` = 16,303 + 1,657 = 17,960.
   - Count with `is_recovered = true` = 1,657.
   - Count with `is_recovered = false` = 16,303.
2. **Date Range Validation**:
   - July 2026, August 2026, September 2026 continuity check: No gaps between 11/09 and 15/09.
3. **TypeScript Build Verification**:
   - `npm run build` must compile cleanly with 0 TypeScript/Vue errors.

### 7.2 Manual UI Verification Steps
1. Navigate to `/allocator` -> Switch to Tab 3 (Theo dõi). Initial load completes in < 0.5s.
2. Verify trips from September 2026 appear seamlessly.
3. Filter by date: Test date `2026-09-12` (recovered data) -> displays recovered trips with note "Khôi phục từ phiếu cân".
4. Click "Tải toàn bộ lịch sử" -> Progress indicator increments until all ~18,000 trips are loaded.
5. In Tab 1, upload tickets -> generate trips in Tab 2 -> click "Lưu vào Sổ Theo Dõi" -> save completes instantly (< 0.2s) without HTTP 500 payload errors.
6. Verify record edit and delete operations update Supabase directly.

---

## 8. Recommended Plan Structure

### Plan 09-01: Schema Creation, Migration & Data Recovery
- **Deliverable 1**: SQL migration script creating `allocator_history_trips`, indexes, and RLS policies.
- **Deliverable 2**: Backup script `scripts/backup_allocator_history.cjs` producing `.planning/backups/allocator_history_trips_backup_16303.json`.
- **Deliverable 3**: Migration script `scripts/migrate_allocator_history.cjs` batch-inserting 16,303 records.
- **Deliverable 4**: Recovery script `scripts/recover_missing_trips.cjs` with Preview report and confirmed execution for 1,657 trips.
- **Deliverable 5**: Parity verification script `scripts/verify_parity.cjs`.

### Plan 09-02: App Integration & Blob Cleanup
- **Deliverable 1**: `src/services/excel/AllocatorService.ts` service implementation.
- **Deliverable 2**: Refactoring `CargoAllocator.vue` (Tab 3 30-day window, "Tải toàn bộ lịch sử", remote date fetch, atomic Tab 2 append, direct edit/delete).
- **Deliverable 3**: Safe cleanup script `scripts/cleanup_content_settings.cjs` to remove `allocator_history_trips` from `content.settings`.
- **Deliverable 4**: Full application build verification (`npm run build`) and live testing.

---

## RESEARCH COMPLETE
