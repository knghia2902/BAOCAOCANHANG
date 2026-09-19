# Phase 10: Enterprise Architecture Upgrade - Context

__Gathered:__ 2026-09-19
**Status:j* Ready for planning

<domain>
## Phase Boundary

Phase 10 delivers a comprehensive architectural and security overhaul for BAOCAOCANHANG to bring the application up to enterprise-grade standards. It addresses critical tech debt identified during the audit:
1. Security & Authentication Overhaul: Supabase Auth migration and RLS hardening.
2. Centralized State Management: Pinia integration for domain stores.
3. Service Layer & Domain Boundaries: Split ContentService, relocate domain services, remove supabase/exceljs direct calls from Vue components.
4. Mega-Component Decomposition: Split WeighbridgePrinter.vue and CargoAllocator.vue into sub-components and composables.
5. Build & Quality: CI/CD github workflow, strict typing, component testing.
</domain>

<decisions>
## Implementation Decisions

### D-01: Authentication & Authorization (Supabase Auth & RLS)
- Chuyên đổi hoàn toàn cơ chế đăng nhập sang Supabase Auth (JWT, session an toàn).
- Kháa toàn bộ các policy mở Allow anon với USING (true) trên PostgreSQL.
- Tuyệt đối không lðu mật khẩu rõ (content.settings) hay hash tự băm trên bảng dù liệu public.

### D-02: State Management with Pinia
- Cài đặt pinia và cấu hình tại src/main.ts.
- Chuyển authStore và contentStore sang Pinia stores chuẩn.
- Xây dựng useWeighbridgeStore và useAllocatorStore.

### D-03: Service Layer Refactoring
- Tách ContentService.ts thành: UserService.ts, PermissionService.ts, ContentService.ts, mình và hòm thư liên hệ MessageService.ts.
- Di chuyển WeighbridgeService.ts và WeighbridgeOtherService.ts về src/services/weighbridge/.
- Di chuyển AuthService.ts về src/services/auth/.

### D-04: Mega-Component Decomposition
- Tách WeighbridgePrinter.vue thành các sub-components (preview, config, truck table, vessel sidebar).
- Tách CargoAllocator.vue logic thành useCargoAllocator.ts và các sub-components.
- Tách AdminView.vue thành các tab views riêng.

### D-05: Error Handling & UX Modals
- Thay thế window.alert/ confirm bằng BaseConfirmModal.vue và useToast.

### D-06: CI/CD & Build Quality
- Tạo .github/workflows/ci.yml chạy type-check và build vào master.
</decisions>
<canonical_refs>
- .planning/ROADMAP.md � Phase 10
- enterprise_audit_report.md
</canonical_refs>
