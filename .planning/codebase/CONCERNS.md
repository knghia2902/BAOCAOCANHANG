# Codebase Concerns

**Analysis Date:** 2026-05-29

## Tech Debt

**Conflicting Class Names:**
- Issue: Two files define classes named `ExcelService` with different APIs:
  - `src/services/ExcelService.ts` (Base import/export utility).
  - `src/services/excel/ExcelService.ts` (Underlying ExcelJS workbook loader/downloader).
- Impact: Code reviews and imports are confusing, leading to accidental mix-ups.
- Fix approach: Rename one of the services (e.g., rename the lower-level helper to `ExcelFileIO`).

**Credentials Handled in Client-Side DB Queries:**
- Issue: `AuthService.ts` queries the public `content` table's `settings` column to read and match the username and password in plaintext.
- Why: Rapid proof-of-concept setup for administration credentials.
- Impact: Security vulnerability. Plaintext passwords are exposed in the database, and database select operations are called directly on the client.
- Fix approach: Migrate to Supabase Auth API (`supabase.auth.signInWithPassword()`) and use Supabase users instead of manual database credentials checks.

**Unused IndexedDB Context:**
- Issue: `src/services/storage/DBContext.ts` is fully implemented to open and query IndexedDB, but is never imported or used elsewhere in the source tree.
- Impact: Redundant code footprint. App depends strictly on live internet network requests to Supabase with no offline caching.
- Fix approach: Integrate `DBContext` to cache portfolio content locally, or delete the file if local storage is sufficient.

## Known Bugs

**Fuzzy/Typo Key Matches Ignored in Excel Merger:**
- Symptoms: Rows are silently skipped during merge if key values have case or spacing differences.
- Trigger: Merge files where matching columns have string mismatches (e.g. "Item-01 " vs "Item-01" or "Apple" vs "apple").
- File: `src/services/excel/MergerService.ts` (line 90) uses a strict equality check.
- Workaround: Clean values in Excel prior to uploading.
- Fix approach: Implement case-insensitive matching with trimmed strings, or offer a fuzzy threshold choice.

## Security Considerations

**Client-Side Administration Guards:**
- Risk: Route guards in `src/router.ts` check the local `authStore` to lock the `/admin` view. Anyone can override this reactive state using browser developer tools.
- Current mitigation: Relies on Supabase RLS (Row-Level Security) to block unauthorized table updates.
- Recommendations: Ensure strict RLS policies are enabled on tables (`content`, `projects`, `tools`, `messages`) to prevent writing without a valid session.

## Performance Bottlenecks

**Sequential Supabase Fetching Waterfall:**
- Problem: The website waits for content loading on boot, causing visible delay.
- Measurement: 4 sequential awaits in `ContentService.loadAll()`.
- Cause: Queries for `content`, `projects`, `tools`, and `messages` are resolved serially rather than concurrently.
- Improvement path: Wrap queries in `Promise.all` inside `ContentService.loadAll()` to request all datasets in parallel.

## Fragile Areas

**ExcelJS Shallow Style Copying:**
- File: `src/services/excel/MergerService.ts` (lines 144-146)
- Why fragile: Cell styles in ExcelJS are deeply nested objects. `tCell.style = { ...sCell.style }` performs a shallow copy, which may drop nested properties (e.g., specific borders or fonts) or cause mutations across cells.
- Safe modification: Implement deep clone functions for style copying.

## Scaling Limits

**Browser Memory Limits with ExcelJS:**
- Limit: Large files (>10MB-50MB or >100,000 rows) can crash browser tabs or freeze UI.
- Symptoms: Page freezes, unresponsive scripts warnings.
- Scaling path: Show file warnings on large uploads, or offload processing to serverless background functions.

## Test Coverage Gaps

**Zero Test Coverage:**
- What's not tested: Entire code tree has no tests. Especially critical for complex logic in `MergerService` and `ConverterService`.
- Risk: Changes to Excel libraries or refactoring can introduce silent regressions in parsing logic.
- Priority: High.

---

*Concerns audit: 2026-05-29*
*Update as issues are fixed or new ones discovered*
