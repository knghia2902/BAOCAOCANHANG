---
phase: 1
slug: dependency-setup-worker-infrastructure
status: draft
nyquist_compliant: true
wave_0_complete: false
created: 2026-05-29
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.1.7 |
| **Config file** | none — Wave 0 installs |
| **Quick run command** | `npx vitest run src/services/infrastructure/__tests__/diagnostic.spec.ts` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run src/services/infrastructure/__tests__/diagnostic.spec.ts`
- **After every plan wave:** Run `npx vitest run` and `npm run build` to verify clean compilation.
- **Before `/gsd-verify-work`:** Full suite must be green.
- **Max feedback latency:** 10 seconds.

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 01-01 | 01-01 | 0 | Foundational setup | — | N/A | integration | `npm list pdfjs-dist tesseract.js docx docx-preview html2pdf.js vitest && npm run build` | ✅ Wave 0 | ⬜ pending |
| 01-02 | 01-02 | 1 | Foundational setup | — | N/A | unit | `npx vitest run src/services/infrastructure/__tests__/diagnostic.spec.ts` | ❌ Wave 0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] Install `vitest` as devDependency and core libraries as dependencies.
- [ ] Add `"test": "vitest run"` script to `package.json`.
- [ ] Configure build target in `vite.config.ts` to support modern JavaScript (`es2022`).
- [ ] Create `src/types/docx-preview.d.ts` declaration file.
- [ ] Create `src/services/infrastructure/DiagnosticService.ts` code and `src/services/infrastructure/__tests__/diagnostic.spec.ts` test stub.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Load PDF.js worker CDN in browser | Foundational setup | Browser network verification | Chạy môi trường dev (`npm run dev`), mở trang và kiểm tra network tab xem worker `.mjs` được tải từ cdnjs.cloudflare.com thành công không. |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 10s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
