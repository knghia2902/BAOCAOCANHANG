---
phase: 8
slug: vessel-status-and-permissions
status: draft
nyquist_compliant: true
wave_0_complete: false
created: 2026-09-11
---

# Phase 8 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.x |
| **Config file** | vite.config.ts |
| **Quick run command** | `npm test -- tests/WeighbridgeService.spec.ts` |
| **Full suite command** | `npm test` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm test -- tests/WeighbridgeService.spec.ts`
- **After every plan wave:** Run `npm test`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 10 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 08-01-01 | 01 | 1 | VESSEL-01 | — | Vessel status defaults to in_progress | unit | `npm test -- tests/WeighbridgeService.spec.ts` | ❌ W0 | ⬜ pending |
| 08-01-02 | 01 | 1 | VESSEL-01 | — | updateVesselStatus syncs to Supabase & IndexedDB | unit | `npm test -- tests/WeighbridgeService.spec.ts` | ❌ W0 | ⬜ pending |
| 08-02-01 | 02 | 2 | VESSEL-02 | — | 2-Tab filtering in Sidebar and Global Dashboard | component | `npm run build` | ✅ | ⬜ pending |
| 08-02-02 | 02 | 2 | VESSEL-01 | — | Close vessel confirmation & read-only lock | component | `npm run build` | ✅ | ⬜ pending |
| 08-02-03 | 02 | 2 | VESSEL-01 | — | Admin-only reopen button visibility & action | component | `npm run build` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/WeighbridgeService.spec.ts` — unit test suite for vessel status lifecycle, default values, and IndexedDB/Supabase update.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Tab switching and badge counts | VESSEL-02 | Visual tab state & badge sync across Sidebar and Global Dashboard | Click "Đang làm hàng" and "Đã xong" tabs in Sidebar and verify table updates and badges display correct count |
| Close vessel confirmation dialog | VESSEL-01 | Modal confirmation UX | Click "Chốt số liệu: Đã xong" on vessel header, verify warning modal pops up and clicking confirm locks the vessel |
| Read-only enforcement | VESSEL-01 | Interactive form & button gating | Check that in "Đã xong" vessel, add/edit/delete buttons are disabled/hidden, while Print and Export Excel work |
| Admin-only reopen permission | VESSEL-01 | Auth role gating | Non-admin sees no reopen button; Admin sees "Mở lại: Đang làm hàng" button and can reopen |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 10s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** verified 2026-09-11
