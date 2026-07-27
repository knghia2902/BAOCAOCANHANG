# Roadmap: Góc Nhỏ Tiện Ích Của Ánh (PDF & OCR Utilities)

## Overview

Implement serverless, client-side PDF document parsing, Optical Character Recognition (OCR), and file formatting conversions directly in the browser using Web Workers. This roadmap goes from installing core dependencies to writing text/table coordinate grouping algorithms, setting up background Tesseract.js threads, building HTML-to-PDF preview streams, and deploying the new utilities tab inside the Vue 3 portfolio app.

## Milestones

- ✅ **v1.0 MVP** — Phases 1-4 (shipped 2026-07-25)
- 🚧 **v1.1 Theo dõi Cân Kho và Container** — Phases 5-7 (in progress)

## Phases

<details>
<summary>✅ v1.0 MVP (Phases 1-4) — SHIPPED 2026-07-25</summary>

- [x] Phase 1: Dependency Setup & Worker Infrastructure (2/2 plans) — completed 2026-05-29
- [x] Phase 2: PDF Parsing & OCR Implementation (3/3 plans) — completed 2026-05-29
- [x] Phase 3: Document Conversion Pipelines (2/2 plans) — completed 2026-05-30
- [x] Phase 4: UI Integration & Formats Dashboard (2/2 plans) — completed 2026-06-01

</details>

### 🚧 v1.1 Theo dõi Cân Kho và Container (In Progress / Planned)

- [x] **Phase 5: Supabase Schema & WeighbridgeOtherService**
  - **Goal**: Create Supabase table `weighbridge_other_tickets` and implement `WeighbridgeOtherService.ts` for Excel import/parsing and Supabase CRUD.
  - **Depends on**: v1.0
  - **Requirements**: IMP-01, IMP-02, DB-01, DB-02
  - **Success Criteria**:
    1. Table schema `weighbridge_other_tickets` created on Supabase.
    2. WeighbridgeOtherService implements Excel parsing and bulk chunk uploading.
    3. Imported records are successfully saved to Supabase without duplicates.
  - **Plans**: 2 plans
    - 05-01: Create Supabase table schema and TypeScript models.
    - 05-02: Implement WeighbridgeOtherService.ts with Excel parsing and Supabase CRUD.

- [ ] **Phase 6: UI Dashboard & Sidebar Navigation**
  - **Goal**: Integrate the lookup dashboard into the left sidebar of CargoAllocator.vue and build the core import/table views.
  - **Depends on**: Phase 5
  - **Requirements**: UI-01, UI-02
  - **Success Criteria**:
    1. Navigation item "Lịch sử cân Kho & Container" is added to CargoAllocator.vue left sidebar.
    2. Selecting navigation loads the WeighbridgeOtherManager.vue view component.
    3. UI displays imported records in a clean, paginated table list.
  - **Plans**: 2 plans
    - 06-01: Hook sidebar navigation in CargoAllocator.vue to a new sub-view `'other_tickets'`.
    - 06-02: Build WeighbridgeOtherManager.vue with upload panel and records table.

- [ ] **Phase 7: Advanced Filtering & Excel Export**
  - **Goal**: Finish the lookup dashboard with advanced search filters and Excel export capability.
  - **Depends on**: Phase 6
  - **Requirements**: QRY-01, QRY-02
  - **Success Criteria**:
    1. Records can be filtered by plate number, container number, ticket number, date range, and record type.
    2. Filtered records can be exported and downloaded back as an Excel (.xlsx) file.
  - **Plans**: 2 plans
    - 07-01: Implement search filters in WeighbridgeOtherManager.vue.
    - 07-02: Add Excel export logic to WeighbridgeOtherService.ts and hook up download button.

## Progress

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. Setup | v1.0 | 2/2 | Complete | 2026-05-29 |
| 2. Parsing & OCR | v1.0 | 3/3 | Complete | 2026-05-29 |
| 3. Pipelines | v1.0 | 2/2 | Complete | 2026-05-30 |
| 4. UI Dashboard | v1.0 | 2/2 | Complete | 2026-06-01 |
| 5. Schema & Service | v1.1 | 2/2 | Complete | 2026-07-27 |
| 6. UI Integration | v1.1 | 0/2 | Not started | - |
| 7. Filtering & Export | v1.1 | 0/2 | Not started | - |
