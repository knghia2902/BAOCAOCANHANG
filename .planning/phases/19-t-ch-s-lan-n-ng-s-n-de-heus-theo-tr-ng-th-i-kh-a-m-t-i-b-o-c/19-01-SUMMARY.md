# Phase 19-01 Summary: Tách sà lan Nông sản De Heus theo trạng thái Khóa/Mở tại Báo Cáo Tổng Quan

**Completed:** 2026-10-21
**Commit:** `913bfcd`

## Changes Implemented
- Added `isDeHeusVessel` helper in `src/components/tools/WeighbridgePrinter.vue` to identify the continuous vessel source "Nông sản De Heus".
- Updated `inProgressVessels` and `doneVessels` computed filters so "Nông sản De Heus" displays unlocked barges (`locked = false`) under **Đang làm** and locked barges (`locked = true`) under **Đã xong**.
- Updated `filteredVesselBarges` and `availableVesselMonths` so the central vessel summary report, statistics cards (total barges, truck trips, net weight), and Excel export reflect the active tab (**Đang làm** vs **Đã xong**) for De Heus.
- Hidden the vessel-level "Chốt số liệu" button for De Heus since it operates continuously.
- Synced `toggleBargeLock` and `allBarges` so locking/unlocking a De Heus barge immediately transitions it between **Đang làm** and **Đã xong**.
