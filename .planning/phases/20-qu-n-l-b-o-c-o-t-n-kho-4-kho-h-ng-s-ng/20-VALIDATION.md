---
phase: 20
slug: qu-n-l-b-o-c-o-t-n-kho-4-kho-h-ng-s-ng
status: draft
nyquist_compliant: true
wave_0_complete: true
created: 2026-10-21
---

# Phase 20 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest ^4.1.2 + `vue-tsc` ~3.1.4 |
| **Config file** | `vite.config.ts` / `package.json` (`npm test` -> `vitest run`) |
| **Quick run command** | `npx vitest run src/services/excel/__tests__/WarehouseInventoryService.spec.ts` |
| **Full suite command** | `npm test && npx vue-tsc --noEmit` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run src/services/excel/__tests__/WarehouseInventoryService.spec.ts` and `npx vue-tsc --noEmit`
- **After every plan wave:** Run `npm test && npx vue-tsc --noEmit`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 8 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 20-01-01 | 01 | 1 | INV-01, INV-02 | — | Schema & TypeScript types compile cleanly | typecheck | `npx vue-tsc --noEmit` | ✅ | ⬜ pending |
| 20-01-02 | 01 | 1 | INV-01, INV-02, INV-03 | — | 6 AM cutoff, 3-way CSV classification, Historical Excel bootstrap, and Dual-Sync to `allocator_tickets` | unit | `npx vitest run src/services/excel/__tests__/WarehouseInventoryService.spec.ts` | ❌ W0 (created in 20-01) | ⬜ pending |
| 20-01-03 | 01 | 1 | INV-01, INV-02, INV-03 | — | Unit tests verify 6 AM shift boundary, CSV import classification, and cumulative FINAL computation | unit | `npx vitest run src/services/excel/__tests__/WarehouseInventoryService.spec.ts` | ❌ W0 (created in 20-01) | ⬜ pending |
| 20-02-01 | 02 | 2 | INV-03, INV-04 | — | `WarehouseInventoryManager.vue` renders 4-warehouse tabs, Gộp Kho 1-2-3, CSV/Excel importers, and Zalo PNG capture | build/typecheck | `npx vue-tsc --noEmit` | ❌ W0 (created in 20-02) | ⬜ pending |
| 20-02-02 | 02 | 2 | INV-03, INV-04 | — | Sidebar integration in `CargoAllocator.vue` & backup table registration in `BackupService.ts` | build/typecheck | `npx vue-tsc --noEmit` | ✅ | ⬜ pending |
| 20-03-01 | 03 | 3 | INV-05 | — | Multi-sheet `.xlsx` export with live `SUMIFS`/`SUMIF` and cumulative stock formulas for Single-Warehouse & Multi-Warehouse (Kho 1-2-3) | unit + build | `npx vitest run src/services/excel/__tests__/WarehouseInventoryService.spec.ts && npx vue-tsc --noEmit` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [x] `src/services/excel/__tests__/WarehouseInventoryService.spec.ts` — created in Plan `20-01` Task `20-01-03` to cover `INV-01`, `INV-02`, `INV-03`, and extended in Plan `20-03` for `INV-05`.
- [x] Existing Vitest infrastructure (`npm test`) and `vue-tsc` are already installed and configured.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Copy/Download PNG Image of `FINAL` table for Zalo | INV-04 | Browser Canvas / Clipboard API (`navigator.clipboard.write` with `ClipboardItem`) requires a real browser DOM rendering context | Open Báo Cáo Tồn Kho tab, select `KHO 4` or `Gộp Kho 1-2-3`, click **"Chụp ảnh gửi Zalo (Copy PNG)"**, paste (`Ctrl+V`) into Zalo chat box and verify high-DPI crisp table layout. |
| Visual inspection of exported `.xlsx` formulas in Microsoft Excel | INV-05 | Verifying Excel auto-recalculates `SUMIFS`/`SUMIF` when opened in desktop Excel | Click **"Xuất Excel Báo Cáo Sáng"**, open the downloaded `.xlsx` file in Excel, check that `FINAL` cells contain live `=SUMIFS(...)` and cumulative `=F(r-1)+C(r)-D(r)` formulas. |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 10s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** ready
