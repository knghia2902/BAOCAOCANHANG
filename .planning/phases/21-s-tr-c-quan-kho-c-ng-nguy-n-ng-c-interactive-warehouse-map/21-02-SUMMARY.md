---
phase: 21-s-tr-c-quan-kho-c-ng-nguy-n-ng-c-interactive-warehouse-map
plan: 02
subsystem: warehouse-inventory
tags: [vue, svg, warehouse-map, permissions, canvas-export]
requires:
  - 21-01
provides:
  - WarehouseVisualMap.vue interactive SVG polygon component
  - Visual Warehouse Map mode in WarehouseInventoryManager.vue
affects:
  - src/components/tools/WarehouseVisualMap.vue
  - src/components/tools/WarehouseInventoryManager.vue
tech-stack:
  added: []
  patterns: [svg-polygon-editor, role-gated-editing, canvas-png-export]
key-files:
  created:
    - src/components/tools/WarehouseVisualMap.vue
  modified:
    - src/components/tools/WarehouseInventoryManager.vue
decisions:
  - Embedded interactive SVG handles with `data-edit-only="true"` so cloning the SVG for high-DPI PNG / Zalo clipboard copy automatically strips handles without re-rendering.
  - Gated Edit Mode behind `authStore.role === 'admin' || canUpdate()` while keeping View Mode and PNG copy/download accessible to all authenticated users.
metrics:
  duration: ~8m
  completed: 2026-10-26
---

# Phase 21 Plan 02: Giao diện Sơ đồ kho trực quan & Tích hợp Tồn Kho 4 Kho Summary

## Thực hiện
- Xây dựng `src/components/tools/WarehouseVisualMap.vue`:
  - Tái hiện chính xác sơ đồ 5 cột **"TVPL - Sơ đồ kho cảng Nguyên Ngọc"** (`BÃI CONT`, `KHO 1 - 6 ô`, `KHO 2 - 11 ô`, `KHO 3 - 11 ô`, `KHO 4 - 12 ô`, cửa kho, vạch chia ô nét đứt và mũi tên "Băng tải").
  - Tự động đồng bộ tên Khách hàng và Số tấn tồn cuối từ dữ liệu 4 Kho (`closingStocks`), đồng thời cho phép ghi đè thủ công nếu cần.
  - Hỗ trợ chế độ **Chỉnh sửa sơ đồ** (chỉ hiển thị cho tài khoản có quyền cập nhật theo phân quyền `authStore`): kéo thả các đỉnh đa giác có bắt dính (Snap) vào vạch ô/tường kho, thêm đỉnh mới ở giữa cạnh, nhấp đúp xóa đỉnh, thêm/xóa cụm hàng lẻ, chọn mẫu nhanh và lưu lên Supabase.
  - Hỗ trợ **Copy ảnh Zalo** và **Tải ảnh PNG** độ phân giải cao (`2640x1360`).
- Tích hợp nút **"SƠ ĐỒ KHO CẢNG"** vào Sidebar trái và thanh công cụ của `WarehouseInventoryManager.vue`.
