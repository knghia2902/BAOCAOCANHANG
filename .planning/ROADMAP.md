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

- [x] **Phase 6: UI Dashboard & Sidebar Navigation**
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

- [x] **Phase 8: Phân loại tàu Đang làm hàng & Đã xong**
  - **Goal**: Tách riêng tàu Đang làm hàng và Đã xong với giao diện 2 tab tại Báo cáo tổng quan / Sidebar, hỗ trợ chốt trạng thái Đã xong (chuyển sang Read-only) và chỉ cho phép Admin mở lại.
  - **Depends on**: Phase 7
  - **Requirements**: VESSEL-01, VESSEL-02
  - **Success Criteria**:
    1. Tiêu đề báo cáo tổng hợp tàu có nút chuyển trạng thái "Đã xong" và badge hiển thị trực quan.
    2. Khi ở trạng thái "Đã xong", toàn bộ sà lan và phiếu cân thuộc tàu chuyển sang chế độ Chỉ xem (Read-only).
    3. Chỉ tài khoản Admin mới có quyền bấm nút "Mở lại: Đang làm hàng".
    4. Trang Báo cáo tổng quan và Sidebar phân tách rõ ràng thành 2 tab: "Đang làm hàng" và "Đã xong".
  - **Plans**: 2 plans
    - [x] 08-01: Cập nhật cấu trúc dữ liệu Tàu (status) và logic phân quyền Admin / Read-only trong WeighbridgeService.ts.
    - [x] 08-02: Tích hợp 2 tab chuyển đổi ở Báo cáo tổng quan & Sidebar, gắn nút chuyển trạng thái trên tiêu đề tàu trong WeighbridgePrinter.vue.

## Progress

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. Setup | v1.0 | 2/2 | Complete | 2026-05-29 |
| 2. Parsing & OCR | v1.0 | 3/3 | Complete | 2026-05-29 |
| 3. Pipelines | v1.0 | 2/2 | Complete | 2026-05-30 |
| 4. UI Dashboard | v1.0 | 2/2 | Complete | 2026-06-01 |
| 5. Schema & Service | v1.1 | 2/2 | Complete | 2026-07-27 |
| 6. UI Integration | v1.1 | 2/2 | Complete | 2026-07-27 |
| 7. Filtering & Export | v1.1 | 0/2 | Not started | - |
| 8. Phân loại tàu | v1.1 | 2/2 | Complete | 2026-09-11 |
| 9. Allocator DB & Recovery | v1.1 | 2/2 | Complete | 2026-09-17 |
| 10. Enterprise Upgrade | v1.1 | 4/4 | Complete | 2026-09-19 |
| 11. Direct Barge Sync | v1.1 | 2/2 | Complete | 2026-09-23 |
| 12. Single Barge Allocator | v1.1 | 2/2 | Complete | 2026-09-23 |
| 13. Sync Barge Profile | v1.1 | 1/1 | Complete | 2026-09-24 |

### Phase 9: allocator-database-migration-and-recovery

**Goal:** Thiết kế bảng quan hệ riêng `allocator_history_trips` trên Supabase, migrate 16,303 trips lịch sử từ content.settings, khôi phục an toàn 1,657 chuyến bị thiếu (từ 11/09 - 15/09) dựa trên weighbridge_trucks & barges config, và cập nhật CargoAllocator.vue đọc/ghi trực tiếp bảng mới.
**Requirements**: DB-MIGRATE-01, DATA-RECOVER-01, ALLOCATOR-SYNC-01
**Depends on:** Phase 8
**Plans:** 2 plans

Plans:

- [x] 09-01: Tạo bảng Supabase `allocator_history_trips`, script migrate 16,303 trips cũ và script khôi phục 1,657 trips thiếu với kiểm tra đối chiếu (verification check).
- [x] 09-02: Cập nhật `CargoAllocator.vue` và các service liên quan để load/save Tab 3 (Theo dõi) trực tiếp từ bảng Supabase mới, xóa bỏ phụ thuộc vào JSON blob 7MB.

### Phase 10: Enterprise Architecture Upgrade

**Goal:** Tái cấu trúc toàn diện kiến trúc enterprise: bảo mật Supabase Auth & khóa RLS policies, cài đặt Pinia với các domain stores tập trung, module hóa service layer (UserService, PermissionService, WeighbridgeService), phân rã mega-component WeighbridgePrinter thành sub-components (<500 dòng), chuẩn hóa BaseConfirmModal và thiết lập pipeline CI/CD với GitHub Actions.
**Requirements**: SEC-01, SEC-02, STATE-01, STATE-02, SVC-01, SVC-02, COMP-01, COMP-02
**Depends on:** Phase 9
**Plans:** 4 plans

Plans:

- [x] 10-01: Bảo mật và chuyển đổi Supabase Auth (SQL RLS migration, cập nhật AuthService & session JWT).
- [x] 10-02: Cài đặt Pinia và xây dựng các domain store tập trung (useWeighbridgeStore, useAllocatorStore, useAuthStore).
- [x] 10-03: Tách god-service ContentService và tổ chức lại thư mục domain services (auth, cms, weighbridge).
- [x] 10-04: Phân rã mega-component WeighbridgePrinter, tích hợp BaseConfirmModal và thiết lập GitHub Actions CI workflow.

### Phase 11: Direct Barge Sync & Allocator Streamlining

**Goal:** Bỏ tab Phân bổ trong Dữ liệu cân hàng, đồng bộ trực tiếp phiếu cân đã import sang sà lan ở Báo cáo tổng quan theo Mã lệnh (OrderNo), độc lập hành động lưu vào Sổ theo dõi tại Tab 1 (kèm xóa sạch Tab 1 sau khi lưu), loại bỏ các thẻ cấu hình phân bổ thừa, và chuẩn hóa Tab 2 Sổ theo dõi theo form gốc import.
**Requirements**: SYNC-DIRECT-01, SYNC-DIRECT-02, SYNC-DIRECT-03, SYNC-DIRECT-04, SYNC-DIRECT-05
**Depends on:** Phase 10
**Plans:** 2 plans

Plans:

- [x] 11-01: Cập nhật hàm đồng bộ sà lan tại Báo cáo tổng quan (WeighbridgePrinter.vue) để đọc trực tiếp từ phiếu cân import (`allocator_tickets`) theo Mã lệnh (`orderNo`).
- [x] 11-02: Tinh gọn Dữ liệu cân hàng (CargoAllocator.vue): bỏ tab Phân bổ, bỏ thẻ Quy tắc phân bổ & Tải trọng xe, thêm nút Lưu vào Sổ theo dõi tại Tab 1 (kèm dọn dẹp Tab 1 sau khi lưu) và chuẩn hóa form hiển thị/xuất Excel Tab 2 theo form gốc Tab 1.

### Phase 12: Dedicated Single-Barge Allocator Tool

**Goal:** Xây dựng công cụ riêng biệt "Phân bổ" với route `/split` (và alias `/tools/split`), triển khai trọn vẹn luồng 3 tab (1. Phiếu cân, 2. Phân bổ, 3. Sổ theo dõi) theo đúng logic phân bổ cũ, cho phép chọn 1 sà lan đích (mặc định/hỗ trợ NÔNG SẢN_DE HEUS hoặc sà lan bất kỳ), cấu hình giới hạn tải trọng xe & khoảng cách thời gian, tự động tách chuyến, hiển thị bảng Sổ theo dõi sau phân bổ và hỗ trợ xuất Excel.
**Requirements**: SPLIT-01, SPLIT-02, SPLIT-03, SPLIT-04
**Depends on:** Phase 11
**Plans:** 2 plans

Plans:

- [x] 12-01: Khởi tạo View/Component Phân bổ, cấu hình Route `/split` & `/tools/split`, tích hợp Tab 1 (Import phiếu cân nguồn) và Sidebar cấu hình tải trọng xe / khoảng cách thời gian.
- [x] 12-02: Tái hiện thuật toán phân bổ tách tải theo 1 sà lan đích tại Tab 2 (Xem trước & phân bổ) và xây dựng Tab 3 (Sổ theo dõi sau phân bổ kèm xuất Excel chuẩn mẫu).

### Phase 13: Truy xuất và đồng bộ hồ sơ sà lan từ lịch sử

**Goal:** Bổ sung nút "Truy xuất hồ sơ cũ" trong form hồ sơ sà lan (BargeProfileManager.vue), tự động quét tìm bản ghi sà lan có cùng tên gần nhất trong toàn bộ lịch sử các tàu/chuyến, mở hộp thoại xác nhận và nạp toàn bộ thông số kỹ thuật (trọng tải, công suất), bộ 3 giấy tờ (GCN, ĐK, BH), toàn bộ hình ảnh đính kèm và thông tin thuyền bộ sang sà lan mới (giữ nguyên thông tin chuyến hiện tại như số lệnh, hàng hóa, thời gian cập/rời).
**Requirements**: BARGE-SYNC-01, BARGE-SYNC-02
**Depends on:** Phase 12
**Plans:** 1 plan

Plans:

- [x] 13-01: Triển khai nút "Truy xuất hồ sơ cũ", logic tìm kiếm sà lan lịch sử mới nhất theo tên, hộp thoại xác nhận và nạp toàn bộ thông số, giấy tờ, ảnh và thuyền viên vào form.


