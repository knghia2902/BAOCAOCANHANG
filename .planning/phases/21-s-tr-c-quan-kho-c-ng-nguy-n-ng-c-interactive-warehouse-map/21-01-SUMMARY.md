---
phase: 21-s-tr-c-quan-kho-c-ng-nguy-n-ng-c-interactive-warehouse-map
plan: 01
subsystem: warehouse-inventory
tags: [warehouse, svg-map, polygon, supabase]
requires: []
provides:
  - WarehouseVisualMapState, WarehouseZoneMapConfig, WarehouseMapPolygon, WarehouseMapVertex interfaces
  - snapMapVertex, createWarehousePresetPolygons, getDefaultVisualMapState, getVisualMapState, saveVisualMapState
affects:
  - src/types/excel.ts
  - src/services/excel/WarehouseInventoryService.ts
  - src/services/excel/__tests__/WarehouseVisualMap.spec.ts
tech-stack:
  added: []
  patterns: [normalized-bay-coordinates, dual-persistence-supabase-idb]
key-files:
  created:
    - src/services/excel/__tests__/WarehouseVisualMap.spec.ts
  modified:
    - src/types/excel.ts
    - src/services/excel/WarehouseInventoryService.ts
decisions:
  - Normalized warehouse coordinates `(xRatio: 0..1, bayY: 0..totalBays)` so polygons scale cleanly across screen sizes and snap directly to bay dividers.
  - Stored `WarehouseVisualMapState` in `content.settings.warehouse_visual_map` on Supabase + `dbContext` local cache for zero-migration cloud sync.
metrics:
  duration: ~5m
  completed: 2026-10-26
---

# Phase 21 Plan 01: Мо hình dữ liệu Sơ đồ kho, toán học bắt dính đa giác & Lưu trữ Supabase Summary

## Thực hiện
- Khai báo đầy đủ các kiểu dữ liệu `WarehouseMapVertex`, `WarehouseMapPolygon`, `WarehouseZoneMapConfig`, `ContainerYardMapConfig`, `WarehouseVisualMapState` trong `src/types/excel.ts`.
- Triển khai `snapMapVertex()` hỗ trợ bắt dính đỉnh đa giác vào mép tường trái/phải, đáy/đỉnh kho, vạch chia ô nguyên và nửa ô.
- Triển khai `getDefaultVisualMapState()` và `createWarehousePresetPolygons()` khớp 100% với hình mẫu "TVPL - Sơ đồ kho cảng Nguyên Ngọc".
- Triển khai `getVisualMapState()` và `saveVisualMapState()` đồng bộ đám mây qua Supabase và IndexedDB.
- Viết bộ unit test `WarehouseVisualMap.spec.ts` kiểm thử toàn diện.
