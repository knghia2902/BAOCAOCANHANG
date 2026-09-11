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

- [ ] **VESSEL-01**: Tàu có hai trạng thái: "Đang làm hàng" và "Đã xong". Người dùng có thể bấm nút chốt "Đã xong" để khóa tàu ở chế độ Chỉ xem (Read-only); chỉ Admin mới có quyền bấm nút "Mở lại: Đang làm hàng".
- [ ] **VESSEL-02**: Màn hình Báo cáo tổng quan và thanh danh sách bên trái được phân tách thành 2 tab rõ ràng: Tab "Đang làm hàng" (mặc định) và Tab "Đã xong".

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
| VESSEL-01 | Phase 8 | Pending |
| VESSEL-02 | Phase 8 | Pending |

**Coverage:**
- v1.1 requirements: 10 total
- Mapped to phases: 10
- Unmapped: 0 ✓

---
*Requirements defined: 2026-07-25*
*Last updated: 2026-09-11 after Phase 8 exploration*
