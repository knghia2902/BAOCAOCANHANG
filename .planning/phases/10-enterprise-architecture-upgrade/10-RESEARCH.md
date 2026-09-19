# Phase 10: Enterprise Architecture Upgrade - Research Document

**Date:** 2026-09-19
**Status:** Complete & Ready for Planning
**Scope:** Security, State Management, Service Layer, Component Decomposition, CI/CD

---

## 1. Executive Summary & Enterprise Blueprint

Following the multi-agent audit on BAOCAOCANHANG, this phase upgrades the application architecture from a prototype monolith into a production-grade enterprise client application.

### Key Dimensions of Upgrade:
1. **Security & Supabase Auth**: Complete migration from un-salted custom password hashing and unprotected anon RLS policies to official Supabase Auth (JWT, secure sessions) and strict PostgreSQL RLS policies.
2. **Centralized Reactive State (Pinia)**: Elimination of isolated component refs and multiple untyped BroadcastChannel instances by implementing Pinia domain stores (useAuthStore, useWeighbridgeStore, useAllocatorStore, useContentStore).
3. **Service Layer Separation**: Deconstructing ContentService.ts into specialized single-responsibility services (UserService, PermissionService, ContentService, MessageService) and relocating domain services into domain folders (src/services/weighbridge/, src/services/allocator/, src/services/auth/).
4. **Decomposition of God-Components**: Splitting WeighbridgePrinter.vue (6,195 lines), CargoAllocator.vue (4,909 lines), and AdminView.vue (1,900 lines) into focused sub-components (<500 lines) and reusable composables.
5. **Quality & CI/CD Pipeline**: Implementing GitHub Actions workflow (.github/workflows/ci.yml), universal modal dialogs (BaseConfirmModal.vue), and eliminating alert() / confirm() anti-patterns.

---

## 2. State Management Architecture (Pinia)

### 2.1 Package & Configuration
- Package: pinia (compatible with Vue 3.5).
- Root registration in src/main.ts.

### 2.2 Domain Store Specifications
1. **src/stores/auth.ts (useAuthStore)**: Manages authenticated user, role, and dynamic permissions table. Replaces manual localStorage session with Supabase session synchronization.
2. **src/stores/weighbridge.ts (useWeighbridgeStore)**: Manages active vessel, barge list, and active tickets. Centralizes weighbridge-status events.
3. **src/stores/allocator.ts (useAllocatorStore)**: Manages trips, capacity configurations, and active split calculations.

---

## 3. Security & Authentication Architecture

### 3.1 Supabase Auth Transition
- Replace custom login() in AuthService.ts with supabase.auth.signInWithPassword({ email, password }).
- Role-based metadata stored in auth.users or synchronized with a protected public profile table profiles via PostgreSQL trigger.
- Password updates handled by supabase.auth.updateUser({ password }).

### 3.2 Row Level Security (RLS) Hardening
- Revoke all CREATE POLICY ... FOR ... TO anon USING (true).
- Require TO authenticated for operational tables.
- Eliminate credentials and user password hashes stored inside content.settings.

---

## 4. Service Layer Refactoring & Boundaries

### 4.1 Deconstruction of ContentService
- src/services/auth/UserService.ts: User account CRUD, password resets, active status toggling.
- src/services/auth/PermissionService.ts: Loading and persisting role-based permissions matrix.
- src/services/cms/ContentService.ts: Portfolio CMS (hero, stats, visibility, projects).
- src/services/cms/MessageService.ts: Visitor messages and contact inquiries.

### 4.2 Relocation of Domain Services
- Move src/services/excel/WeighbridgeService.ts -> src/services/weighbridge/WeighbridgeService.ts.
- Move src/services/excel/WeighbridgeOtherService.ts -> src/services/weighbridge/WeighbridgeOtherService.ts.
- Move src/services/storage/AuthService.ts -> src/services/auth/AuthService.ts.
- Move src/services/storage/LogService.ts -> src/services/auth/LogService.ts.

### 4.3 Component Boundary Rule
- All database interactions must use service methods. No direct supabase.from() calls allowed inside .vue files.

---

## 5. Mega-Component Decomposition Strategy

### 5.1 WeighbridgePrinter.vue (6,195 lines)
1. WbPrintPreviewCanvas.vue: Visual ticket canvas, drag-and-drop coordinates, print layout.
2. WbPrintConfigForm.vue: Settings for ticket fields, paper size, margins, printer options.
3. WbTruckListTable.vue: Paginated list of weighing tickets with filter and edit triggers.
4. WbVesselSidebar.vue: Vessel/barge selection and status tabs.

### 5.2 CargoAllocator.vue (4,909 lines)
1. useCargoAllocator.ts: Composable encapsulating truck weight balancing algorithms and distribution math.
2. AllocatorConfigModal.vue: Capacity and tolerance adjustment dialog.
3. AllocatorHistoryTable.vue: 30-day window table view of allocated trips.

### 5.3 AdminView.vue (1,900 lines)
1. AdminDashboard.vue: Overview and visitor metrics.
2. AdminUsers.vue: User management and role permission matrix.
3. AdminCms.vue: Portfolio content, projects, and showcase tools.
4. AdminMessages.vue: Contact form submissions and inquiries.

---

## 6. Error UX & Shared Modals
- src/components/ui/BaseConfirmModal.vue: Clean dialog with title, message, cancel/confirm buttons, Escape key listener, and focus trap.
- Deprecate window.alert() and window.confirm() across all tools.

---

## 7. CI/CD & Build Pipeline
- GitHub Actions workflow .github/workflows/ci.yml: Node 20, npm ci, vue-tsc -b, vite build.

---

## 8. Validation Architecture
- Dimension 1 (Type Verification): vue-tsc -b must pass with 0 errors.
- Dimension 2 (Bundle & Chunking): npm run build passes with isolated chunks.
- Dimension 3 (Runtime Parity): All 5 tools render accurately and maintain identical business functionality.