# Testing Patterns

**Analysis Date:** 2026-05-29

## Test Framework

**Runner:**
- **None:** There is no automated test framework (e.g. Vitest, Jest, Playwright) configured in this repository.

**Assertion Library:**
- **None.**

**Run Commands:**
- No test scripts are defined in `package.json`. Testing is executed via build type checking and manual browser QA.
- Build Validation Command:
  ```bash
  npm run build
  ```
  *(Runs `vue-tsc -b` to verify TypeScript types, followed by `vite build` to check bundle assembly).*

## Test File Organization

- No test files exist in the codebase (`tests/` directory and collocated `*.test.ts` or `*.spec.ts` files are absent).

## Manual Verification Plan

To verify feature correctness, developer validation must be performed manually in the browser:

### 1. Portfolio Flow
- Run `npm run dev` and navigate to the application.
- Verify page elements (Hero title, avatar image, toolkit badges, projects list) fetch and load correctly from Supabase.
- Submit a message on the Contact page; verify the form resets and triggers the database write.

### 2. Administrative Controls
- Navigate to `/admin`. Ensure the router guard redirects to `/login` when unauthenticated.
- Log in using credentials stored in the Supabase `content` table.
- Verify redirection to `/change-password` on first-time login flag detection.
- Access the Admin panel:
  - Test modifying hero and about sections.
  - Test adding, editing, and deleting projects.
  - Test viewing received messages, marking them as read, and deleting them.

### 3. Spreadsheet Tools
- **Format Converter:**
  - Upload an Excel (`.xlsx`) sheet. Convert to CSV / JSON and verify downloaded format files.
  - Upload a CSV file. Convert to Excel and check cell alignment and columns structure.
- **Excel Merger:**
  - Upload a primary master spreadsheet and secondary sheets.
  - Extract columns and map the primary key.
  - Trigger merge and verify that combined rows and custom styling are retained in the downloaded master sheet.

---

*Testing analysis: 2026-05-29*
*Update when automated test suites are added*
