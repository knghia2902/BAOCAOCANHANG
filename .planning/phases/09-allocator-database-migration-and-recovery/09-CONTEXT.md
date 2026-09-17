# Phase 09: Allocator Database Migration & Data Recovery - Context

**Gathered:** 2026-09-17
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 09 delivers the transition from an anti-pattern 7MB JSON blob (`allocator_history_trips` inside `content.settings`) to a high-performance relational table on Supabase, along with recovering 1,657 missing trips between 11/09/2026 and 15/09/2026.

Specifically, this phase delivers:
1. **Supabase Schema**: A dedicated table `allocator_history_trips` with typed columns matching `SplitTrip`, indexes on `date1_obj`, `time_str`, `plate_number`, `order_no`, `ticket_no`, and `customer`.
2. **Migration & Backup**: A static JSON backup file of the existing 16,303 trips, followed by a migration script inserting them into the new table.
3. **Data Recovery**: A preview-first recovery script reconstructing 1,657 missing trips from `weighbridge_trucks` and `weighbridge_barges`, executed only after user confirmation, tagging recovered trips with `is_recovered = true`.
4. **App Integration**: Refactoring `CargoAllocator.vue` (and adding an `AllocatorService.ts`) to query Tab 3 (Theo dõi) with a default 30-day window, bulk inserting new trips from Tab 2, and removing dependence on `content.settings.allocator_history_trips`.
5. **Safe Cleanup**: Verification of data parity before cleaning up the 7MB blob from `content.settings`.

</domain>

<decisions>
## Implementation Decisions

### Data Loading Strategy for Tab 3 (Theo dõi)
- **D-01:** Mặc định khi mở Tab 3 chỉ tải các chuyến xe trong vòng 30 ngày gần nhất (khoảng 2,000 - 3,000 chuyến) để thời gian mở trang siêu tốc (<0.5 giây).
- **D-02:** Cung cấp nút bấm "Tải toàn bộ lịch sử" (Load all) ở thanh công cụ khi người dùng cần tra cứu toàn bộ dữ liệu lịch sử nhiều tháng.
- **D-03:** Nếu người dùng sử dụng bộ lọc ngày (Date filter) và chọn một ngày nằm ngoài khoảng 30 ngày đã tải, hệ thống sẽ tự động gửi truy vấn tới Supabase để lấy các bản ghi của đúng ngày đó.
- **Reversibility:** `reversible` — UI data fetching strategy can be adapted without altering the schema.

### Data Recovery for 1,657 Missing Trips (11/09 - 15/09)
- **D-04:** Xây dựng script đối chiếu và xuất báo cáo xem trước (Preview Report) chi tiết: phân rã số chuyến theo từng ngày (11/09 - 15/09), tổng khối lượng (tấn), đối chiếu với danh sách sà lan và khách hàng tương ứng.
- **D-05:** Chỉ thực hiện chèn 1,657 chuyến xe vào bảng `allocator_history_trips` sau khi người dùng xem báo cáo Preview và xác nhận phê duyệt.
- **D-06:** Toàn bộ các chuyến xe khôi phục sẽ được gắn cờ `is_recovered = true` và ghi chú `notes: 'Khôi phục từ phiếu cân'` để đảm bảo minh bạch, dễ dàng kiểm toán và lọc riêng khi cần.
- **Reversibility:** `one-way` — Inserts thousands of production records; tracking with flags enables rollback if ever necessary.

### Save & Append Mechanism from Tab 2 (Phân bổ)
- **D-07:** Khi người dùng bấm "Lưu vào Sổ Theo Dõi" ở Tab 2, hệ thống chỉ thực hiện Bulk INSERT những chuyến xe mới sinh ra (thường từ vài chục đến vài trăm chuyến) vào bảng `allocator_history_trips`.
- **D-08:** Thực hiện kiểm tra chống trùng lặp (Deduplication) ở cả client và DB dựa trên `ticket_no` hoặc cặp `(plate_number, time_str)`.
- **D-09:** Loại bỏ hoàn toàn cơ chế ghi đè toàn bộ mảng dữ liệu lịch sử, giúp thao tác lưu hoàn thành trong ~0.2 giây và không bao giờ gây rủi ro đè mất các ngày cũ.
- **Reversibility:** `costly` — Alters the contract between Tab 2 generation and Tab 3 persistence.

### Backup & Safe Cleanup Plan for content.settings
- **D-10:** Trước khi thực hiện bất kỳ thao tác thay đổi nào, xuất toàn bộ 16,303 bản ghi hiện tại ra file sao lưu tĩnh tại `.planning/backups/allocator_history_trips_backup_16303.json`.
- **D-11:** Migrate toàn bộ 16,303 bản ghi vào bảng Supabase mới và chạy script verify parity (đối chiếu số lượng, mẫu ngẫu nhiên, tổng tải trọng theo ngày).
- **D-12:** Chỉ xóa key `allocator_history_trips` trong `content.settings` sau khi đã kiểm thử và xác nhận giao diện web CargoAllocator hoạt động hoàn hảo 100% trên bảng mới, giảm kích thước hàng `main` từ 7MB xuống còn vài KB.
- **Reversibility:** `one-way` — Permanently removes the JSON key from `content.settings`, guarded by verified static file backup.

### the agent's Discretion
- Chi tiết cấu trúc tên cột trong bảng `allocator_history_trips` (chuyển sang snake_case chuẩn Postgres: `plate_number`, `order_no`, `date1_obj`, `date2_obj`, `time_str`, `weight_net`, v.v. và mapping tự động sang TypeScript model).
- Cách viết service trung gian `AllocatorService.ts` để bọc các thao tác gọi Supabase, tách biệt khỏi mã giao diện Vue component.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project Roadmap & Requirements
- `.planning/ROADMAP.md` § Phase 9 — Mục tiêu và các plan của phase 9.
- `.planning/REQUIREMENTS.md` § DB-MIGRATE-01, DATA-RECOVER-01, ALLOCATOR-SYNC-01 — Các yêu cầu chức năng.

### Source Code Context
- `src/components/tools/CargoAllocator.vue` — Component chính quản lý Tab 1, 2, 3 và logic phân bổ, theo dõi.
- `src/services/excel/WeighbridgeService.ts` — Cấu trúc dữ liệu `weighbridge_trucks` và `weighbridge_barges`.
- `src/supabase.ts` — Cấu hình kết nối Supabase client.

### Analysis & Verification Scripts
- `scratch/verify_recovery.cjs` — Script đối chiếu logic khôi phục từ `weighbridge_trucks` sang `SplitTrip`.
- `scratch/inspect_trips.cjs` — Script kiểm tra cấu trúc dữ liệu thực tế của 16,303 trips lịch sử.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `supabase` client từ `@/supabase`: Đã có sẵn hàm query, insert, upsert.
- `CapacityConfig` và `getVehicleCapacity()` trong `CargoAllocator.vue`: Tính toán giới hạn tải trọng xe.
- `ensureDate()`, `extractDateYMD()`, `matchTripDate()` trong `CargoAllocator.vue`: Bộ tiện ích xử lý ngày tháng chuẩn múi giờ địa phương.

### Established Patterns
- Service-based architecture: Nghiệp vụ cơ sở dữ liệu được đặt trong `src/services/` (ví dụ `WeighbridgeService.ts`, `WeighbridgeOtherService.ts`). Phase này sẽ tạo thêm `AllocatorService.ts`.
- Notification / Toast: Sử dụng `addToast(msg, type)` trong component Vue.

### Integration Points
- `src/components/tools/CargoAllocator.vue`:
  - `loadTicketsFromSupabase()`: Đổi phần load `existingTrips` sang gọi `AllocatorService.getHistoryTrips()`.
  - `saveTicketsToSupabase()`: Xóa bỏ việc serialize `existingTrips` vào `content.settings`.
  - `saveTripsToHistory()`: Thay vì ghi đè mảng, gọi `AllocatorService.insertTrips(newTrips)`.

</code_context>

<specifics>
## Specific Ideas
- Người dùng yêu cầu xem trước (Preview) chi tiết số lượng chuyến, khối lượng và danh sách ngày khôi phục từ 11/09 - 15/09 trước khi chèn vào database thật.
- Gắn cờ ghi chú `notes: 'Khôi phục từ phiếu cân'` và `is_recovered: true` cho 1,657 chuyến xe khôi phục để dễ dàng phân biệt.

</specifics>

<deferred>
## Deferred Ideas
- None — Tất cả các nội dung thảo luận đều nằm trong phạm vi của Phase 9.

</deferred>

---

*Phase: 09-allocator-database-migration-and-recovery*
*Context gathered: 2026-09-17*
