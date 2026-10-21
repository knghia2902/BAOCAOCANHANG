---
phase: quick
plan: 261021-imy
type: execute
wave: 1
depends_on: []
files_modified:
  - src/components/tools/WeighbridgePrinter.vue
  - src/components/tools/BargeProfileManager.vue
autonomous: true
must_haves:
  truths:
    - "In Báo Cáo Tổng Quan (WeighbridgePrinter.vue), vessels in the left sidebar are collapsed by default on load (expandedVesselIds[v.id] = false)."
    - "Clicking a vessel in the left sidebar toggles its barge list open/closed."
---

<objective>
Set all vessels in the left sidebar of **BÁO CÁO TỔNG QUAN** (`WeighbridgePrinter.vue` and `BargeProfileManager.vue`) to be collapsed by default (`expandedVesselIds[v.id] = false`) instead of expanded.
</objective>

<tasks>
<task type="auto">
  <name>Task 1: Set expandedVesselIds default to false in WeighbridgePrinter.vue and BargeProfileManager.vue</name>
  <files>src/components/tools/WeighbridgePrinter.vue, src/components/tools/BargeProfileManager.vue</files>
  <action>
    - In `src/components/tools/WeighbridgePrinter.vue` (`loadVessels`), change `expandedVesselIds.value[v.id] = true` to `false`.
    - In `selectBarge`, set `expandedVesselIds.value[vesselId] = true` so if a user selects a barge from the right-side summary table, its parent vessel expands to highlight it.
    - In `src/components/tools/BargeProfileManager.vue` (`loadData`), change `expandedVesselIds.value[v.id] = true` to `false`.
  </action>
  <verify>Run `npm run build` (`vue-tsc -b && vite build`) with 0 errors.</verify>
  <done>All vessels in the left sidebar of Báo Cáo Tổng Quan are collapsed by default.</done>
</task>
</tasks>
