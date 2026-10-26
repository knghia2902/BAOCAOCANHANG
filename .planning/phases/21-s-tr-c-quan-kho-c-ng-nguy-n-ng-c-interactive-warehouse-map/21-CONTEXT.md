# Phase 21: Sơ đồ trực quan Kho cảng Nguyên Ngọc (Interactive Warehouse Map) — Context

**Defined:** 2026-10-26
**Source:** `/gsd-explore` session & `.planning/notes/warehouse-visual-map.md`

<domain>
Xây dựng bảng theo dõi & chỉnh sửa trực quan **"TVPL - Sơ đồ kho cảng Nguyên Ngọc"** tích hợp trực tiếp trong màn hình Báo Cáo Tồn Kho 4 Kho (`/tools/warehouse`), tự động liên kết số liệu tồn cuối kỳ của 4 kho và cung cấp trình kéo thả đa giác (Interactive SVG Polygon Editor) để biểu diễn chính xác hình dáng vùng hàng hóa theo từng ô kho.
</domain>

<decisions>
- **D-01 (Tích hợp trực tiếp tại Báo Cáo Tồn Kho 4 Kho):**
  - Đặt thành một chế độ xem / tab chính (**"Sơ đồ kho cảng"**) ngay trong `WarehouseInventoryManager.vue` (`/tools/warehouse`), có thể mở nhanh từ thanh danh mục bên trái (Sidebar) hoặc thanh tab trên cùng.
- **D-02 (Bố cục 5 phân khu chuẩn mẫu TVPL):**
  - Tiêu đề trung tâm: `TVPL - Sơ đồ kho cảng Nguyên Ngọc` kèm dòng thời gian góc trái `Cập nhật số liệu đến 06h00, DD/MM/YYYY`.
  - **Cột 1 — `BÃI CONT`:** Nền cam hồng nhạt (`#FADBD8`), hộp thông tin viền nâu đỏ ở phía trên hiển thị `Cont có hàng`, `Cont rỗng`, và `Total` (tự động tính tổng hoặc nhập tay).
  - **Cột 2 — `KHO 1 (1,080 m²)`:** Chia làm **6 ô ngang** (đánh số `1`..`6` từ dưới lên trên bên cạnh trái, vạch kẻ nét đứt ngang), cửa chính ở cạnh đáy, màu vùng hàng mặc định vàng kem (`#F9E090`).
  - **Cột 3 — `KHO 2 (1,980 m²)`:** Chia làm **11 ô ngang** (đánh số `1`..`11` ở khoảng giữa Kho 2 và Kho 3), cửa chính ở đáy + cửa phụ bên hông trái (ô 8–9), màu vùng hàng mặc định xanh dương (`#00ADEF`).
  - **Cột 4 — `KHO 3 (1,980 m²)`:** Chia làm **11 ô ngang** (đánh số `1`..`11`), cửa chính ở đáy + cửa phụ bên hông phải (ô 10–11), màu vùng hàng mặc định xanh lá (`#00B050`).
  - **Cột 5 — `KHO 4 (5,000 m²)`:** Chia làm **12 ô ngang** (đánh số `1`..`12` bên cạnh phải), cửa chính ở đáy + cửa phụ bên hông trái (ô 6–8), có mũi tên xanh + nhãn **"Băng tải"** ở khu vực ô 5–6 (có thể bật/tắt hoặc kéo chỉnh vị trí), màu vùng hàng mặc định vàng tươi (`#FFFF00`).
- **D-03 (Liên kết tự động số liệu Tồn kho 4 Kho & Cho phép ghi đè):**
  - Mặc định hộp thông tin của mỗi kho hiển thị:
    - Dòng 1 (chữ đỏ in đậm): Tên khách hàng lấy từ `configs[whId].currentCustomer` (VD: `GỖ BÌNH ĐỊNH`, `EASTWOOD`).
    - Dòng 2 (chữ đen in đậm): Tên mặt hàng (mặc định `VIÊN NÉN GỖ`, cho phép sửa).
    - Dòng 3 (chữ đen in đậm): Khối lượng tồn kho định dạng `#,##0.00 T` tự động lấy từ `finalTablesByWarehouse[whId].closingStockTons` (có tùy chọn nhập số ghi đè thủ công nếu muốn hiển thị số khác).
- **D-04 (Trình kéo thả đỉnh đa giác - Interactive SVG Polygon Editor):**
  - Mỗi kho hỗ trợ **1 hoặc nhiều khối đa giác (polygons)** để vừa vẽ được mảng hàng chính có lối xe xúc đi vào (vát chéo như Kho 1, Kho 3 hoặc bậc thang vuông góc như Kho 2), vừa vẽ được các cụm hàng lẻ tách rời ở góc (như Kho 4 ở ô 1–2 và 3–4).
  - Trong chế độ Chỉnh sửa:
    - Kéo thả các đỉnh (vertex handles) trực tiếp trên sơ đồ.
    - Tự động bắt dính (**Snap-to-grid / Snap-to-wall**) vào mép tường trái/phải/trên/dưới (`x = 0`, `x = 1`, `y = 0`, `y = totalBays`), vạch phân chia ô nguyên hoặc nửa ô (`0.25` / `0.5` ô), giúp cạnh đa giác luôn thẳng và vuông vức.
    - Hỗ trợ thêm đỉnh mới (click vào điểm giữa cạnh), xóa đỉnh (khi đa giác có > 3 đỉnh), thêm cụm hàng mới (đa giác phụ), xóa cụm hàng, hoặc chọn mẫu nhanh (Đầy kho, Lối đi vát chéo, Lối đi bậc thang).
- **D-05 (Lưu trữ đám mây Supabase & Phân quyền Xem / Sửa):**
  - Lưu trữ cấu hình sơ đồ (`WarehouseVisualMapState`) lên Supabase (trong `warehouse_configs` / `content.settings.warehouse_visual_map`) kèm bộ nhớ đệm IndexedDB (`dbContext`) để mọi người truy cập đều thấy sơ đồ mới nhất.
  - **Phân quyền:**
    - Ai cũng xem được sơ đồ ở chế độ **Xem (View-only)** sạch đẹp (ẩn các nút điểm neo) và sử dụng nút **Copy ảnh / Tải ảnh PNG** nét cao.
    - Chỉ người dùng có quyền chỉnh sửa theo phân quyền (`canUpdate()` / `authStore.role === 'admin'` trong `src/stores/auth.ts`) mới thấy nút **"Chỉnh sửa sơ đồ"** để kéo đỉnh đa giác, cập nhật số Cont và bấm **"Lưu sơ đồ"**.
</decisions>

<canonical_refs>
- `.planning/notes/warehouse-visual-map.md`
- `.planning/REQUIREMENTS.md` (`WMAP-01`, `WMAP-02`, `WMAP-03`)
- `.planning/ROADMAP.md` (Phase 21)
- `src/components/tools/WarehouseInventoryManager.vue`
- `src/services/excel/WarehouseInventoryService.ts`
- `src/stores/auth.ts`
</canonical_refs>
