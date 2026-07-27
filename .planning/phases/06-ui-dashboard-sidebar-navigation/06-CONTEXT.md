# Phase 6: UI Dashboard & Sidebar Navigation - Context

**Gathered:** 2026-07-27
**Status:** Ready for planning

<domain>
## Phase Boundary

This phase delivers the user interface integration for the Warehouse & Container weighing logs. It adds a navigation item "Lịch sử cân Kho & Container" to the left sidebar of CargoAllocator.vue, routes to a new view component `WeighbridgeOtherManager.vue`, and implements the layouts for file uploading and paginated tables.

</domain>

<decisions>
## Implementation Decisions

### View Layout & Navigation
- **D-01:** Combine both Warehouse and Container weighbridge records into a single Vue component `WeighbridgeOtherManager.vue` with a top sub-tab switcher ("Cân Kho" vs "Cân Container").
  — **Reversibility:** reversible — Changing sub-views to separate sidebar menu items would only involve minor edits in `CargoAllocator.vue`'s sidebar list and importing two components instead of one.

### Upload mechanism
- **D-02:** Build a drag-and-drop Excel upload panel at the top of the dashboard page with click-to-select support, showing upload status and files loaded.
  — **Reversibility:** reversible — UI design changes are localized within `WeighbridgeOtherManager.vue`.

### Table Pagination
- **D-03:** Enforce table pagination defaulting to 20 rows per page, with a size selector (10, 20, 50, 100) and page navigation buttons at the bottom right.
  — **Reversibility:** reversible — Pagination parameters are fully controlled via reactive Vue variables.

### the agent's Discretion
- Styling specifics: Design cards, buttons, table alignments, and colors using existing Tailwind design tokens to keep consistency with the CargoAllocator design language.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Navigation & Sidebar Architecture
- `src/components/tools/CargoAllocator.vue` — Contains the left sidebar container and conditional rendering block for active sub-views.
- `src/components/tools/VehicleManager.vue` — Example of a sub-view component loaded in the sidebar.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- Tailwind CSS utilities and custom portfolio classes (e.g. `soft-shadow`, `bg-primary`, `rounded-[24px]`).
- Material Symbols Outlined font classes for icons (e.g., `history`, `balance`).

### Established Patterns
- Conditionally render sub-views under the `<main>` tag using `v-if="activeSubViewMode === 'other_tickets'"`.
- Storing `itemsPerPage` inside a reactive reference `const itemsPerPage = ref(20)`.

### Integration Points
- Sidebar nav item added in `CargoAllocator.vue`'s desktop sidebar section (approx line 3320).
- New Vue component `src/components/tools/WeighbridgeOtherManager.vue` to be created.

</code_context>

<specifics>
## Specific Ideas

- The user wants the layout to feel exactly like the current barge weighlist table in terms of pagination behavior and design style.

</specifics>

<deferred>
## Deferred Ideas

- Advanced search filters and Excel export capability are deferred to Phase 7.

</deferred>

---

*Phase: 6-UI Dashboard & Sidebar Navigation*
*Context gathered: 2026-07-27*
