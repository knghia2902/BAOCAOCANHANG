# Phase 5: Supabase Schema & WeighbridgeOtherService - Context

**Gathered:** 2026-07-27
**Status:** Ready for planning

<domain>
## Phase Boundary

This phase delivers the database schemas (Supabase tables) and service layer methods for warehouse weighing imports (factory to warehouse) and container weighing imports/exports. It establishes the TypeScript data types, creates two distinct tables on Supabase, and implements import parsing and bulk-upload API integration.

</domain>

<decisions>
## Implementation Decisions

### Database Table Design
- **D-01:** Create two separate database tables on Supabase: `weighbridge_warehouse_tickets` and `weighbridge_container_tickets`.
  — **Reversibility:** costly — Undoing this to combine tables later would require merging database records, changing database schemas, and refactoring multiple API query call sites across the client codebase.
  — **Rationale:** The user expects future requirements and fields to expand significantly and diverge between warehouse operations and container operations.

### Excel Field Mapping
- **D-02:** Use flexible mapping for standard columns from the Excel file (ticket number, plate number, driver, weight_1, weight_2, weight_net, date_in, date_out, note) using keyword matching, plus:
  - For Container: extract optional `container_no` if present.
  - For Warehouse: extract optional `goods_name` if present.
  — **Reversibility:** reversible — Column mappings are handled entirely within the client-side javascript service layer.

### Deduplication Strategy
- **D-03:** Auto-detect and overwrite existing records during import based on a unique constraint on `ticket_no`.
  — **Reversibility:** reversible — Can be modified to skip or warning-prompt without database changes.

### the agent's Discretion
- None — all key decisions on database splitting, columns, and merge strategy were determined and locked.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Existing Weighbridge Architecture
- `src/services/excel/WeighbridgeService.ts` — Contains the reference implementation for parsing Excel files and sync/dedup logic with Supabase.
- `src/components/tools/BargeProfileManager.vue` — Reference for styling and state variables.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `exceljs` — Already installed and configured. Used for parsing spreadsheet rows and sheet cells.
- `@supabase/supabase-js` client — Already initialized in `src/supabase.ts` for database operations.

### Established Patterns
- Chunked uploading: Uploading records in chunks of 100 to avoid Supabase API timeout issues (implemented in `WeighbridgeService.ts:saveTrucks`).
- Case-insensitive field detection: Matching column headers dynamically using lowercase/trimmed keywords.

### Integration Points
- New tables `weighbridge_warehouse_tickets` and `weighbridge_container_tickets` to be added in Supabase.
- Creation of `WeighbridgeOtherService.ts` under `src/services/excel/`.

</code_context>

<specifics>
## Specific Ideas

- The user wants the layout to be extremely easy to select month and year, which we'll address in UI phases, but we must make sure database fields for date_in and date_out are robustly typed as timestamptz.

</specifics>

<deferred>
## Deferred Ideas

- None — discussion stayed within phase scope.

</deferred>

---

*Phase: 5-Supabase Schema & WeighbridgeOtherService*
*Context gathered: 2026-07-27*
