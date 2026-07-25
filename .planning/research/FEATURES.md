# Features Research

**Project:** Góc Nhỏ Tiện Ích Của Ánh
**Feature:** Theo dõi Cân Kho và Container
**Researched:** 2026-07-25

## Requirements & Scope

### Must Have (Table Stakes)
- **Excel Import:** Import Excel weight lists (`.xlsx`) for both warehouse receipt (factory-to-warehouse) and container shipments.
- **Supabase Cloud Sync:** Centralized storage of weighbridge records in Supabase to sync across multiple devices.
- **Search & Filtering:** Users can filter and lookup records based on ticket number, plate number, container number, date range, and record type.
- **Excel Export:** Export filtered records back to an Excel file (`.xlsx`).
- **Sidebar Navigation:** Integrated navigation item inside the left sidebar "Tiện ích quản lý" in `CargoAllocator.vue`.

### Should Have
- **Deduplication:** Auto-detect and prevent duplicate imports using unique constraint combination `(ticket_no, type)`.
- **Bulk Delete:** Allow deleting filtered records or clearing all imported records for a specific type.
- **Pagination:** Handle large imports (e.g. thousands of rows) gracefully with client-side or server-side pagination.

### Defer (v2+)
- **Charts and Analytics:** Dashboard statistics showing monthly tonnage of warehouse vs container.
- **Role-based edit permissions:** Locking/unlocking specific older logs.

---
*Research completed: 2026-07-25*
