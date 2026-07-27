---
phase: 6
slug: ui-dashboard-sidebar-navigation
status: draft
nyquist_compliant: true
wave_0_complete: true
created: 2026-07-27
---

# Phase 6 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | manual |
| **Config file** | none |
| **Quick run command** | `npx vue-tsc --noEmit` |
| **Full suite command** | `npx vue-tsc --noEmit` |
| **Estimated runtime** | ~10 seconds |

---

## Sampling Rate

- **After every task commit:** Run typecheck `npx vue-tsc --noEmit`
- **After every plan wave:** Check browser for visual rendering and tabs transition
- **Before `/gsd-verify-work`:** npx vue-tsc --noEmit must be green

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 06-01-01 | 01 | 1 | UI-01 | — | N/A | unit | `npx vue-tsc --noEmit` | ✅ | ⬜ pending |
| 06-01-02 | 01 | 1 | UI-01 | — | N/A | unit | `npx vue-tsc --noEmit` | ✅ | ⬜ pending |
| 06-02-01 | 02 | 2 | UI-02 | — | N/A | unit | `npx vue-tsc --noEmit` | ❌ W0 | ⬜ pending |
| 06-02-02 | 02 | 2 | UI-02 | T-06-02-01 | Check file size limit in UI | unit | `npx vue-tsc --noEmit` | ❌ W0 | ⬜ pending |
| 06-02-03 | 02 | 2 | UI-02 | — | N/A | unit | `npx vue-tsc --noEmit` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Existing infrastructure covers all phase requirements.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Tab Switched Layout | UI-02 | Visual layout check | Click sub-tabs and observe table header changes. |
| Drag and Drop | UI-02 | File system interaction | Drag excel file into panel, see if preview loads. |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 10s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** pending 2026-07-27
