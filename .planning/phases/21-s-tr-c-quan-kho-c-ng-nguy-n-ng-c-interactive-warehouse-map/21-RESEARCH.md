# Phase 21: Sơ đồ trực quan Kho cảng Nguyên Ngọc — Technical Research

**Date:** 2026-10-26
**Phase:** 21

## 1. Visual Anatomy of Reference Diagram (`TVPL - Sơ đồ kho cảng Nguyên Ngọc`)

Based on direct inspection of the user's reference image:
1. **Header Area:**
   - Center title: `TVPL - Sơ đồ kho cảng Nguyên Ngọc` (Bold serif/Cambria style, steel-blue `#4F71BE`, ~24–28px).
   - Top-left subtitle: `Cập nhật số liệu đến 06h00, 26/10/2026` (Regular serif, dark text, ~15px).
2. **Five Equal-Height Vertical Columns + Bottom Footer Labels:**
   - All 5 columns share the same top Y and bottom Y, with a light blue-gray footer banner (`#D9E1F2` with dark border) below each column:
     - Col 1 (`BÃI CONT`): No thick outer black wall on the body, soft peach fill (`#FADBD8`), top white summary box (`Cont có hàng: 0`, `Cont rỗng: 784`, `Total: 784` with thin maroon border `#943634`). Footer: `BÃI CONT`.
     - Col 2 (`KHO 1 (1,080 m²)`): Thick black warehouse wall (`stroke-width: 2.5`), **6 equal horizontal bays** numbered `1` to `6` from bottom to top on the left outside edge, separated by horizontal dashed lines (`stroke-dasharray="3,2"`). Bottom center door rectangle. Cargo color: `#F9E09B` (warm light yellow).
     - Col 3 (`KHO 2 (1,980 m²)`): Thick black warehouse wall, **11 equal horizontal bays**, bottom center door rectangle + left-wall side door spanning bay ~8.2 to ~9.3. Cargo color: `#00ADEF` (vivid cyan/blue).
     - Col 4 (`KHO 3 (1,980 m²)`): Thick black warehouse wall, **11 equal horizontal bays** (numbers `1` to `11` displayed in the gap between Kho 2 and Kho 3), bottom right-of-center door rectangle + right-wall upper door spanning bay ~10.2 to ~11. Cargo color: `#00B050` (vivid green).
     - Col 5 (`KHO 4 (5,000 m²)`): Thick black warehouse wall, **12 equal horizontal bays** (numbers `1` to `12` displayed on the right outside edge), bottom center door rectangle + left-wall side door spanning bay ~6.3 to ~7.5. Includes a blue dashed-border right-pointing block arrow + white label box `Băng tải` at bay ~5.3–6.0. Cargo color: `#FFFF00` (bright yellow).
3. **Floating Customer/Stock Info Card per Warehouse:**
   - Positioned near the top center of each warehouse (around top 5%–22% of warehouse height), white background with thin dark-red/maroon border (`#943634`), 3 centered bold lines:
     - Line 1 (Red `#E31B23`): Customer Name (e.g., `GỖ BÌNH ĐỊNH`, `EASTWOOD`)
     - Line 2 (Black `#000000`): Cargo Name (e.g., `VIÊN NÉN GỖ`)
     - Line 3 (Black `#000000`): Formatted Tonnage (e.g., `1,919.40 T`)

## 2. Normalized Coordinate System & Snapping Math

To make polygon vertices independent of screen pixel resolution and directly tied to warehouse bays:
- Each warehouse `whId` (`KHO 1..4`) has `totalBays` (`6`, `11`, `11`, `12`).
- We represent each polygon vertex as normalized warehouse coordinates `(xRatio, bayY)`:
  - `xRatio`: `0` (left inner wall) to `1` (right inner wall), clamped to `[0, 1]`.
  - `bayY`: `0` (bottom floor of bay 1) to `totalBays` (top ceiling of highest bay), clamped to `[0, totalBays]`.
    - For example, in `KHO 3` (`totalBays = 11`), `bayY = 0` is the bottom wall, `bayY = 4` is the dashed line between bay 4 and bay 5, and `bayY = 11` is the top wall.
- **Snapping Rules (`snapVertex`):**
  - Wall snap threshold: if `xRatio < 0.03` → `0`; if `xRatio > 0.97` → `1`.
  - Horizontal grid snap: `xRatio` snaps to increments of `0.05` (or `0.025` for fine positioning).
  - Bay line snap: if `Math.abs(bayY - Math.round(bayY)) < 0.12` → `Math.round(bayY)` (snaps cleanly to bay dashed lines and top/bottom walls); otherwise snaps to `0.1` bay increments.
- **Default Initial Polygons (Matching the Reference Image 100%):**
  - **`KHO 1` (6 bays):** Single polygon covering the top and left/right walls with an angled white excavation cutout from the bottom door up to bay `2.5`:
    - `(0, 0) -> (0, 6) -> (1, 6) -> (1, 0) -> (0.68, 0) -> (0.82, 2.5) -> (0.14, 2.5) -> (0.14, 0.25) -> (0.35, 0.25) -> (0.35, 0)`
  - **`KHO 2` (11 bays):** Stepped perimeter polygon with upper cargo (bays 8–11) and thin side strips along left/right walls down to bay 1:
    - `(0, 0) -> (0, 11) -> (1, 11) -> (1, 0) -> (0.72, 0) -> (0.72, 0.65) -> (0.95, 0.65) -> (0.95, 8.3) -> (0.42, 8.8) -> (0.42, 8.0) -> (0.13, 8.0) -> (0.13, 9.1) -> (0.04, 9.1) -> (0.04, 0.7) -> (0.15, 0.7) -> (0.15, 0)`
  - **`KHO 3` (11 bays):** Polygon filled from top (bay 11) down to a pitched-roof cutout between bays 3.5 and 6.2, plus thin side walls down to bottom:
    - `(0, 0) -> (0, 11) -> (1, 11) -> (1, 0) -> (0.85, 0) -> (0.85, 0.2) -> (0.96, 0.2) -> (0.96, 3.5) -> (0.69, 6.2) -> (0.55, 6.2) -> (0.04, 4.7) -> (0.04, 0.25) -> (0.38, 0.25) -> (0.38, 0)`
  - **`KHO 4` (12 bays):** Multiple polygons:
    - Polygon 1 (Upper main stock + side strips): `(0, 6.1) -> (0, 12) -> (1, 12) -> (1, 6.1) -> (0.95, 6.1) -> (0.92, 8.3) -> (0.06, 8.3) -> (0.06, 6.1)`
    - Polygon 2 (Right middle pile at bay 3–4.3): `(0.83, 3.0) -> (1, 3.0) -> (1, 4.3) -> (0.83, 4.3)`
    - Polygon 3 (Bottom-left pile at bay 0–1.2): `(0, 0) -> (0, 1.2) -> (0.28, 1.2) -> (0.28, 0)`
    - Polygon 4 (Bottom-right pile at bay 0–1.8): `(0.80, 0) -> (0.80, 1.8) -> (1, 1.8) -> (1, 0)`

## 3. Cloud Persistence & Role-Based Permissions

- **Supabase + Local Cache (`WarehouseInventoryService`):**
  - Store `WarehouseVisualMapState` in `dbContext` under key `'warehouse_visual_map'` AND sync to Supabase via `content.settings.warehouse_visual_map` (and `warehouse_configs` fallback), ensuring zero-migration immediate cloud persistence across all browsers/devices.
- **Role-Based Access Control (`src/stores/auth.ts`):**
  - Import `authStore`, `canUpdate` from `@/stores/auth`.
  - Computed `canEditMap = computed(() => authStore.role === 'admin' || canUpdate())`.
  - Users without edit permission see the clean View Mode (and can still click **Copy ảnh Zalo** / **Tải ảnh PNG**). Users with edit permission can toggle **Chế độ Chỉnh sửa**, drag vertices, add/remove polygons or vertices, edit container counts / timestamps, and click **Lưu sơ đồ**.

## 4. High-DPI Image Export / Clipboard Copy

- Render the diagram directly from the clean SVG (with edit handles hidden) onto an offscreen HTML5 `<canvas>` at `2x` scale (`width = 2400, height = 1260`), then convert to PNG `Blob` for `navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })])` and direct `.png` download. Because SVG serializes cleanly via `XMLSerializer` into an `Image` data URL with zero external font/CORS tainting, export is instantaneous (<100ms) and razor-sharp.
