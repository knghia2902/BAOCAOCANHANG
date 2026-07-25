# Project Research Summary

**Project:** Góc Nhỏ Tiện Ích Của Ánh (Ngoc Anh Portfolio & Utilities)
**Domain:** Document & Weighbridge Logistics Tracking
**Researched:** 2026-07-25
**Confidence:** HIGH

## Executive Summary

This research establishes the plan to add warehouse and container weighbridge log tracking to the existing application. The goal is to provide a client-side Excel import, cloud storage on Supabase, and lookup dashboard that integrates into the existing left navigation sidebar.

The system will leverage existing npm dependencies (`exceljs` and `@supabase/supabase-js`) to parse, write, and synchronize records. A new database table `weighbridge_other_tickets` will be added to store warehouse imports, container imports, and container exports.

Key risks include duplicate record insertions (mitigated via composite unique constraints on `ticket_no` and `type`), browser performance lag on large imports (mitigated by bulk chunk uploads), and date format inconsistencies.

## Key Findings

### Recommended Stack
We will use the existing stack (Vue 3, Tailwind, Supabase, and ExcelJS) and introduce a new database table `weighbridge_other_tickets` to store these tickets centrally.

### Expected Features

**Must have (table stakes):**
- Import Excel weighlist (`.xlsx`) files for warehouse receipts and container shipments.
- Store weighbridge records centrally in Supabase.
- Query/filter records by type, ticket number, plate, container number, and date range.
- Export query results back to `.xlsx` files.
- UI integrated into the left sidebar "Tiện ích quản lý" under `CargoAllocator.vue`.

**Should have (competitive):**
- Automatic deduplication using composite unique constraints.
- Batch deleting/clearing of records.

### Architecture Approach
Create a dedicated `WeighbridgeOtherService.ts` and a `WeighbridgeOtherManager.vue` component that integrates with `CargoAllocator.vue` via the sidebar sub-view routing.

### Critical Pitfalls
1. **Duplicate Records:** Mitigated via `unique (ticket_no, type)` constraint and upserting logic.
2. **Performance Lag on Uploads:** Mitigated via chunking insertions into batches of 100.
3. **Date parsing errors:** Mitigated via robust date parsing checks in the service layer.

## Implications for Roadmap

### Phase 1: Database & Services Setup
- **Rationale:** Lay down database tables and services before building the UI.
- **Delivers:** Database table, TypeScript types, and `WeighbridgeOtherService.ts`.
- **Addresses:** Supabase storage, excel parsing, and export logic.
- **Avoids:** Duplicate records and date parsing issues.

### Phase 2: UI View & Sidebar Integration
- **Rationale:** Hook up the service to the UI and add navigation.
- **Delivers:** `WeighbridgeOtherManager.vue` component and sidebar integration.
- **Addresses:** Left sidebar entry and basic import/table views.

### Phase 3: Advanced Filtering & Export
- **Rationale:** Complete the feature with robust search criteria and export functionality.
- **Delivers:** Query filters, search options, and export to Excel features.

---
*Research completed: 2026-07-25*
*Ready for roadmap: yes*
