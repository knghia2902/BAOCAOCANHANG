---
phase: 10-enterprise-architecture-upgrade
plan: 01
subsystem: auth
tags: [supabase-auth, rls, security, jwt, session]

requires:
  - phase: 09-allocator-database-migration-and-recovery
    provides: relational table allocator_history_trips
provides:
  - database/migrations/20260919_security_rls_hardening.sql revoking open anon access and securing RLS
  - AuthService.ts updated to support Supabase Auth with fallback and safe hashing
  - src/stores/auth.ts with safe JSON parsing and cross-tab session synchronization
affects: [auth, security, router, app]

tech-stack:
  added: []
  patterns: [supabase-auth-session, rls-hardening, safe-storage-parse]

key-files:
  created:
    - database/migrations/20260919_security_rls_hardening.sql
  modified:
    - src/services/storage/AuthService.ts
    - src/stores/auth.ts
    - src/App.vue

key-decisions:
  - "Lock down public anon access on PostgreSQL users, allocator_history_trips, content, and vehicle_profiles"
  - "Support Supabase Auth signInWithPassword and fallback user authentication"
  - "Add safe JSON.parse for localStorage to prevent corruption crashes"
  - "Add cross-tab session logout propagation"

requirements-completed:
  - SEC-01
  - SEC-02
---

# Plan 10-01 Summary: Security Hardening & Supabase Auth Transition

## Accomplishments
1. **SQL RLS Hardening Migration**: Created `database/migrations/20260919_security_rls_hardening.sql` to revoke all dangerous `Allow anon ...` policies with `USING (true)` across all core operational tables.
2. **AuthService Integration**: Integrated official Supabase Auth (`supabase.auth.signInWithPassword`, `supabase.auth.signOut`, `supabase.auth.updateUser`) into `AuthService.ts`, while keeping safe salt validation for legacy accounts.
3. **Session Resilience**: Wrapped `localStorage` parsing in try-catch in `src/stores/auth.ts` and implemented cross-tab storage listener to propagate logout events immediately across all tabs.
4. **App.vue Logout**: Made `handleHeaderLogout()` asynchronous to properly await Supabase Auth sign-out.

## Verification
- `npx vue-tsc -b --noEmit` passed with 0 errors.
- `npm run build` passed cleanly in 16.20s.
