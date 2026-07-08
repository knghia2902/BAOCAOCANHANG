---
phase: 01-dependency-setup-worker-infrastructure
plan: 01
subsystem: infra
tags: [vite, typescript, npm, vitest]
requires: []
provides:
  - installed dependency packages (pdfjs-dist, tesseract.js, docx, docx-preview, html2pdf.js, vitest)
  - es2022 build target configuration in vite.config.ts
affects: [dependency-setup-worker-infrastructure]

tech-stack:
  added: [pdfjs-dist, tesseract.js, docx, docx-preview, html2pdf.js, vitest]
  patterns: [es2022 compilation targets in bundler]

key-files:
  created: []
  modified: [package.json, package-lock.json, vite.config.ts]

key-decisions:
  - "Configured esbuild and build targets to es2022 to support top-level await and private class fields."

patterns-established:
  - "Configuring es2022 targets for modern ES-based packages."

requirements-completed:
  - Foundational setup

duration: 10min
completed: 2026-05-29
---

# Phase 1 Plan 1: Dependency Setup Summary

**Cài đặt thành công các thư viện xử lý tài liệu client-side (pdfjs-dist, tesseract.js, docx, docx-preview, html2pdf.js), vitest và cấu hình build target ES2022 trong vite.config.ts.**

## Performance

- **Duration:** 10 min
- **Started:** 2026-05-29T15:15:00Z
- **Completed:** 2026-05-29T15:25:00Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- Cài đặt đầy đủ các gói thư viện core nhị phân client-side và Vitest làm framework kiểm thử.
- Thêm kịch bản test `"test": "vitest run"` vào package.json.
- Cấu hình esbuild và build target lên `es2022` trong vite.config.ts giúp giải quyết triệt để lỗi biên dịch liên quan đến Top-Level Await của pdfjs-dist.
- Dự án Vue 3 / Vite 7 được biên dịch build thành công không lỗi (build pass).

## Task Commits

Each task was committed atomically:

1. **Task 1: Install core npm packages and testing framework** - `6b5c5ac` (feat)
2. **Task 2: Configure Vite build target and TS types** - `4f7caad` (feat)

## Files Created/Modified
- `package.json` - Thêm các thư viện phụ thuộc và script test.
- `package-lock.json` - Lock phiên bản các dependency.
- `vite.config.ts` - Thiết lập build.target và optimizeDeps sang `es2022`.

## Decisions Made
- Sử dụng Vitest v4.1.7 vì nó tích hợp hoàn hảo với các dự án sử dụng cấu hình Vite 7.
- Thiết lập target biên dịch sang `es2022` thay vì hạ cấp thư viện pdfjs-dist để đảm bảo được cập nhật các bản vá bảo mật và tính năng PDF parser mới nhất.

## Deviations from Plan
None - plan executed exactly as written.

## Issues Encountered
None.

## Next Phase Readiness
- Toàn bộ thư viện đã được nạp và build sạch sẽ.
- Sẵn sàng chuyển sang Plan 2 để thiết lập declaration type cho docx-preview và DiagnosticService kèm theo unit test để kiểm tra CDN worker hoạt động thực tế.

---
*Phase: 01-dependency-setup-worker-infrastructure*
*Completed: 2026-05-29*
