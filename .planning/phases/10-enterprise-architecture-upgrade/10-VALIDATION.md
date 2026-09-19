---
phase: 10
slug: enterprise-architecture-upgrade
status: draft
nyquist_compliant: true
wave_0_complete: false
created: 2026-09-19
---

# Phase 10 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|---|---|
| **Framework** | Vitest 4.x & vue-tsc |
| **Config file** | vite.config.ts / tsconfig.app.json |
| **Quick run command** | npx vue-tsc -b --noEmit |
| **Full suite command** | npm run build |
| **Estimated runtime** | ~15-30 seconds |

---

## Sampling Rate

- **After every task commit:** Run npx vue-tsc -b --noEmit
- **After every plan wave:** Run npm run build
- **Before /gsd-verify-work:** Build passes with zero errors, manual chunks properly generated

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | Status |
|---|---|---|---|---|---|---|
| 10-01-01 | 01 | 1 | SEC-01 | schema/lint | node -c scripts/migrate_allocator_history.cjs | pending |
| 10-01-02 | 01 | 1 | SEC-02 | static | npx vue-tsc -b --noEmit | pending |
| 10-02-01 | 02 | 2 | STATE-01 | static | npx vue-tsc -b --noEmit | pending |
| 10-02-02 | 02 | 2 | STATE-02 | static | npm run build | pending |
| 10-03-01 | 03 | 3 | SVC-01 | static | npx vue-tsc -b --noEmit | pending |
| 10-03-02 | 03 | 3 | SVC-02 | build | npm run build | pending |
| 10-04-01 | 04 | 4 | COMP-01 | static | npx vue-tsc -b --noEmit | pending |
| 10-04-02 | 04 | 4 | COMP-02 | build | npm run build | pending |