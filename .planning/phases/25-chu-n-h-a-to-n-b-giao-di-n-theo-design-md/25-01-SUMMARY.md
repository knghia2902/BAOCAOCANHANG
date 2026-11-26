---
phase: 25-chu-n-h-a-to-n-b-giao-di-n-theo-design-md
plan: 01
subsystem: ui
tags: [design-system, tailwind, vue, typography, colors, modals, tables]
requires: []
provides:
  - Chuẩn hóa hệ thống Design Tokens toàn cục (`tailwind.config.js`, `src/style.css`, `index.html`) theo `DESIGN.md`
  - Chuẩn hóa Shell (`App.vue`, `UnifiedWorkspaceView.vue`, `WorkspaceTreeSidebar.vue`)
  - Chuẩn hóa các trang Views chính (`HomeView`, `LoginView`, `ChangePasswordView`, `AboutView`, `DocumentsView`, `AdminView`)
affects:
  - 25-02
  - 25-03
  - 25-04
tech-stack:
  added: []
  patterns:
    - "2-font typography system: Space Grotesk (display) + Quicksand (body)"
    - "Minimum UI font size >= 12px (text-xs)"
    - "Primary Puffy CTA buttons with #6495ed 4px bottom shadow"
    - "Standardized modals (rounded-[2rem], text-xl font-display font-black, size-10 close button)"
    - "Standardized data tables (rounded-[24px], sticky top-0 z-10 bg-gray-50 thead)"
key-files:
  created: []
  modified:
    - tailwind.config.js
    - src/style.css
    - index.html
    - src/App.vue
    - src/views/workspace/UnifiedWorkspaceView.vue
    - src/components/workspace/WorkspaceTreeSidebar.vue
    - src/views/HomeView.vue
    - src/views/LoginView.vue
    - src/views/ChangePasswordView.vue
    - src/views/AboutView.vue
    - src/views/DocumentsView.vue
    - src/views/AdminView.vue
key-decisions:
  - "Khôi phục borderRadius.lg (8px) và borderRadius.xl (12px) về mặc định Tailwind bằng cách gỡ ghi đè 2.5rem/4rem khỏi tailwind.config.js, giúp Tab Switcher và Action buttons đồng bộ chuẩn DESIGN.md."
  - "Bổ sung boxShadow.soft vào tailwind.config.js và chuyển body mặc định sang font-body (Quicksand) thay vì ép font-display."
patterns-established:
  - "Mọi nút Primary CTA chính dùng Puffy style (bg-primary rounded-full shadow-[0_4px_0_0_#6495ed] hover:translate-y-[2px] active:translate-y-[4px])."
  - "Toàn bộ màu hồng/nâu cũ (#ff85a2, #1b0d11) và class lỗi (border-gray-150) được loại bỏ khỏi Shell và Views chính."
requirements-completed:
  - DESIGN-01
duration: 6m
completed: 2026-11-26
---

# Phase 25 Plan 01: Chuẩn hóa Design System gốc, Shell và các Views chính — Summary

**Hoàn tất Wave 1 (Plan 25-01): Chuẩn hóa cấu hình Tailwind/CSS/HTML gốc, Shell điều hướng và 6 trang Views chính theo đầy đủ 6 mục của `DESIGN.md`.**

## Accomplishments

- **Task 25-01-01 (`tailwind.config.js`, `src/style.css`, `index.html`):**
  - Rút gọn Google Fonts và `fontFamily` còn đúng 2 phông chữ `Space Grotesk` (`display`) và `Quicksand` (`body`).
  - Gỡ ghi đè `borderRadius.lg` (`2.5rem`) và `borderRadius.xl` (`4rem`) khỏi `tailwind.config.js`; bổ sung `boxShadow.soft`.
  - Chuyển `body` sang `font-body bg-background-light text-[#1e293b]` và chuẩn hóa `.glass-nav` sang `backdrop-blur bg-white/80 border-soft-pink`.
- **Task 25-01-02 (`App.vue`, `UnifiedWorkspaceView.vue`, `WorkspaceTreeSidebar.vue`):**
  - Bỏ ép `font-display` ở root wrapper để nội dung/bảng kế thừa `Quicksand`.
  - Chuẩn hóa Floating Header (`backdrop-blur bg-white/80 border-soft-pink`), thương hiệu dùng `primary` (`#4a78c2`), modal hồ sơ `rounded-[2rem]` + nút CTA Puffy.
  - Chuẩn hóa `WorkspaceTreeSidebar.vue` (`rounded-[14px]` → `rounded-2xl`, hiệu ứng nút icon header).
- **Task 25-01-03 (`HomeView`, `LoginView`, `ChangePasswordView`, `AboutView`, `DocumentsView`):**
  - Nâng toàn bộ 19 vị trí chữ `< 12px` lên `text-xs`, thay toàn bộ `#1b0d11` sang `#1e293b` / `slate-500` / `slate-600`, thay `border-gray-150` sang `border-slate-200`.
  - Chuẩn hóa input (`bg-[#f1f5f9] text-[#1e293b]`), nút CTA Puffy, nút Secondary Outline, màu trạng thái (`teal-600` / `rose-600`), và banner `DocumentsView` (`rounded-[2.5rem]`, `bg-background-light`, `font-body`).
- **Task 25-01-04 (`AdminView.vue`):**
  - Dọn sạch toàn bộ 5× `rgba(255, 133, 162, ...)` sang tông `rgba(74, 120, 194, ...)`, đổi Toast `#1b0d11` → `#1e293b`, đổi `border-gray-150` → `border-slate-200`.
  - Chuyển `getActionColor` sang hệ màu chuẩn (`teal`, `primary`, `slate`, `amber`, `rose`).
  - Chuẩn hóa toàn bộ bảng dữ liệu (`rounded-[24px]`, `sticky top-0 z-10 bg-gray-50`) và các modal cũ (`rounded-[2rem]`, tiêu đề `text-xl font-display font-black`, nút đóng `size-10`, nút CTA Puffy).

## Verification

- **Grep check:** 0 kết quả `#ff85a2`, `255, 133, 162`, `#1b0d11`, `border-gray-150`, `text-[(9|10|11)px]` trên cả 12 tệp thuộc Plan 25-01.
- **Unit tests:** `npm test` PASS 100%.
- **Production build:** `npm run build` (`vue-tsc -b && vite build`) PASS 0 errors.

## Deviations from Plan

None — plan executed cleanly as written.

## Next Phase Readiness

Wave 1 (`25-01`) đã hoàn tất và sẵn sàng cho Wave 2 (`25-02`, `25-03`, `25-04`).
