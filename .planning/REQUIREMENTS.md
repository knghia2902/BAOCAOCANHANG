# Requirements: Góc Nhỏ Tiện Ích Của Ánh (Warehouse & Container Weighing Log)

**Defined:** 2026-07-25
**Core Value:** Enable centralized, cloud-synced weighbridge records for warehouse imports and container shipments, accessible and filterable from the management sidebar.

## v1.1 Requirements

Requirements for this milestone. Each maps to roadmap phases.

### Import & Parsing (IMP)

- [ ] **IMP-01**: User can import Excel weight list (`.xlsx`) files for warehouse receipts (factory-to-warehouse).
- [ ] **IMP-02**: User can import Excel weight list (`.xlsx`) files for container shipments (export/import).

### Database & Storage (DB)

- [ ] **DB-01**: System stores imported warehouse/container weighbridge records centrally in Supabase.
- [ ] **DB-02**: System automatically deduplicates records during import using a composite unique constraint of ticket number and record type.

### Query & Export (QRY)

- [ ] **QRY-01**: User can query and filter weighbridge records by type, date range, plate number, container number, and ticket number.
- [ ] **QRY-02**: User can export the queried/filtered results back to a downloadable Excel file (`.xlsx`).

### User Interface (UI)

- [ ] **UI-01**: User can select the new "Lịch sử cân Kho & Container" navigation menu item in the left sidebar "Tiện ích quản lý" (CargoAllocator.vue).
- [ ] **UI-02**: User can view a paginated table of records, upload new files, and delete/clear records.

### Vessel Classification & Permissions (VESSEL)

- [x] **VESSEL-01**: Tàu có hai trạng thái: "Đang làm hàng" và "Đã xong". Người dùng có thể bấm nút chốt "Đã xong" để khóa tàu ở chế độ Chỉ xem (Read-only); chỉ Admin mới có quyền bấm nút "Mở lại: Đang làm hàng".
- [x] **VESSEL-02**: Màn hình Báo cáo tổng quan và thanh danh sách bên trái được phân tách thành 2 tab rõ ràng: Tab "Đang làm hàng" (mặc định) và Tab "Đã xong".

### Allocator Database Migration & Data Recovery (PHASE-09)

- [ ] **DB-MIGRATE-01**: Thiết kế bảng quan hệ riêng `allocator_history_trips` trên Supabase, migrate 16,303 trips lịch sử từ `content.settings` JSON blob sang bảng mới.
- [ ] **DATA-RECOVER-01**: Khôi phục an toàn 1,657 chuyến xe bị thiếu (từ ngày 11/09 - 15/09) từ `weighbridge_trucks` và cấu hình sà lan sang bảng `allocator_history_trips`.
- [ ] **ALLOCATOR-SYNC-01**: Cập nhật `CargoAllocator.vue` để load/save Tab 3 (Theo dõi) trực tiếp trên bảng Supabase mới, không còn lỗi 500 timeout và đồng bộ realtime/phân trang chuẩn.

### Direct Barge Sync & Allocator Streamlining (SYNC-DIRECT)

- [ ] **SYNC-DIRECT-01**: Bỏ tab Phân bổ ở màn hình "Dữ liệu cân hàng", giao diện chỉ còn 2 tab: Tab 1 "Phiếu cân" và Tab 2 "Theo dõi".
- [ ] **SYNC-DIRECT-02**: Loại bỏ các thẻ cấu hình không còn sử dụng: "Quy tắc phân bổ" (chiến lược chia, định thời gian) và "Cấu hình tải trọng xe" ở phần đầu màn hình Dữ liệu cân hàng.
- [ ] **SYNC-DIRECT-03**: Nâng cấp tính năng Đồng bộ tại từng Sà lan trong "Báo cáo tổng quan" để tự động lọc và nạp các chuyến xe trực tiếp từ danh sách phiếu cân đã import (Tab 1 / `allocator_tickets`) theo Mã lệnh (`orderNo`).
- [ ] **SYNC-DIRECT-04**: Bổ sung nút "Lưu vào Sổ theo dõi" tại Tab 1 (Phiếu cân). Thao tác lưu là độc lập với việc đồng bộ Sà lan. Sau khi lưu thành công vào Sổ theo dõi (Tab 2), toàn bộ dữ liệu ở Tab 1 được xóa sạch (reset về rỗng).
- [ ] **SYNC-DIRECT-05**: Chuẩn hóa cấu trúc dữ liệu, giao diện hiển thị bảng và mẫu xuất file Excel của Tab 2 (Sổ theo dõi) theo đúng form và các tiêu chí chuẩn giống hệt file gốc import ở Tab 1.


### Wharfage Billing Period & Excel Tonnage (PHASE-14)

- [x] **WHARFAGE-FILTER-01**: Cung cấp bộ lọc theo chu kỳ chốt phí cầu bến (ngày 26 tháng trước đến 25 tháng này) và tùy chọn khoảng ngày linh hoạt (từ ngày - đến ngày) tại Báo cáo tổng quan sà lan, căn cứ vào thời gian kết thúc làm hàng (`dateEnd`) của sà lan.
- [x] **EXCEL-TONNAGE-01**: Bổ sung cột "Trọng tải (tấn)" vào file Excel xuất ra từ danh sách quản lý tất cả sà lan, lấy chính xác thông số kỹ thuật của sà lan và định dạng số phân cách hàng nghìn.

### Global Overview Barge Unification & Vessel Status Filter (PHASE-16)

- [ ] **UNIFY-BARGES-01**: Bảng Danh sách quản lý tất cả sà lan tại Báo cáo tổng quan hiển thị 100% sà lan của toàn bộ hệ thống (cả tàu đang làm hàng và tàu đã xong), không bị chia cắt theo tab của Sidebar.
- [ ] **VESSEL-FILTER-01**: Bổ sung bộ lọc Trạng thái tàu độc lập trên thanh công cụ lọc [Tất cả tàu | Tàu đang làm hàng | Tàu đã xong], hoạt động độc lập hoặc kết hợp linh hoạt với bộ lọc Kỳ tính phí.


### Allocator Barge Status Grouping (PHASE-17)

- [ ] **ALLOC-GROUP-01**: Phân nhóm danh sách sà lan của tàu Nông Sản De Heus tại Sidebar thành 2 tab trạng thái trực quan [⏳ Chưa phân bổ (X) | ✅ Đã phân bổ (Y)] kèm số lượng đếm.
- [ ] **ALLOC-GROUP-02**: Hiển thị danh sách thẻ sà lan chi tiết (tên sà lan, mã lệnh, hàng hóa, khối lượng/số chuyến). Khi bấm chọn sà lan trong "Đã phân bổ", hệ thống tự động chuyển sang Tab 3 (Sổ theo dõi) để xem dữ liệu và xuất Excel.
- [ ] **ALLOC-GROUP-03**: Tự động chuyển trạng thái của sà lan từ "Chưa phân bổ" sang "Đã phân bổ" ngay khi người dùng lưu các chuyến xe phân bổ vào Sổ theo dõi.

## Future Requirements (v2+)

- **QRY-03**: Interactive dashboard charts showing monthly tonnage and volume trends.
- **IMP-03**: Support importing weighlist from PDF/CSV files directly.

## Out of Scope

- Real-time cloud sync push notifications when other users import files (simple page refresh/requery is sufficient).
- Custom Excel layout configuration per file type (all files must follow the standard weighbridge column format).

## Traceability

Which phases cover which requirements.

| Requirement | Phase | Status |
|-------------|-------|--------|
| IMP-01 | Phase 5 | Pending |
| IMP-02 | Phase 5 | Pending |
| DB-01 | Phase 5 | Pending |
| DB-02 | Phase 5 | Pending |
| QRY-01 | Phase 6 | Pending |
| QRY-02 | Phase 7 | Pending |
| UI-01 | Phase 6 | Pending |
| UI-02 | Phase 6 | Pending |
| VESSEL-01 | Phase 8 | Complete |
| VESSEL-02 | Phase 8 | Complete |
| DB-MIGRATE-01 | Phase 9 | Complete |
| DATA-RECOVER-01 | Phase 9 | Complete |
| ALLOCATOR-SYNC-01 | Phase 9 | Complete |
| SYNC-DIRECT-01 | Phase 11 | Complete |
| SYNC-DIRECT-02 | Phase 11 | Complete |
| SYNC-DIRECT-03 | Phase 11 | Complete |
| SYNC-DIRECT-04 | Phase 11 | Complete |
| SYNC-DIRECT-05 | Phase 11 | Complete |
| WHARFAGE-FILTER-01 | Phase 14 | Complete |
| EXCEL-TONNAGE-01 | Phase 14 | Complete |
| UNIFY-BARGES-01 | Phase 16 | Complete |
| VESSEL-FILTER-01 | Phase 16 | Complete |
| ALLOC-GROUP-01 | Phase 17 | Pending |
| ALLOC-GROUP-02 | Phase 17 | Pending |
| ALLOC-GROUP-03 | Phase 17 | Pending |

**Coverage:**
- v1.1 / v1.2 requirements: 25 total
- Mapped to phases: 25
- Unmapped: 0 ✓


---
*Requirements defined: 2026-07-25*
*Last updated: 2026-10-19 after Phase 17 specification*
