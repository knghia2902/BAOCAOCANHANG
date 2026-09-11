# Phase 8: Phân loại tàu Đang làm hàng & Đã xong - Context

**Gathered:** 2026-09-11
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 8 bổ sung cơ chế phân loại trạng thái tàu ("Đang làm hàng" / "Đã xong") trong công cụ In phiếu cân (`WeighbridgePrinter.vue`), tách giao diện hiển thị thành 2 tab tại Báo cáo tổng quan và Sidebar, hỗ trợ chốt trạng thái Đã xong (khóa toàn bộ dữ liệu ở chế độ Chỉ xem - Read-only), và phân quyền chỉ cho phép Admin (`authStore.role === 'admin'`) mở lại tàu sang "Đang làm hàng".

</domain>

<decisions>
## Implementation Decisions

### Trạng thái Tàu & CSDL (Database & Model)
- **D-01:** Bổ sung trường `status: 'in_progress' | 'done'` vào đối tượng `Vessel` và bảng `weighbridge_vessels` trên Supabase (kèm IndexedDB local cache). Giá trị mặc định là `'in_progress'` (*Đang làm hàng*).
- **D-02:** Backward compatibility: Tất cả các tàu hiện có trong hệ thống nếu chưa có giá trị `status` sẽ được coi là `'in_progress'`.

### Thao tác Chốt & Phân quyền Mở lại (Locking & Permissions)
- **D-03:** Đặt nút **"Chốt số liệu: Đã xong"** trên thanh tiêu đề báo cáo tổng hợp tàu khi xem chi tiết tàu.
- **D-04:** Khi bấm chốt, hiển thị modal xác nhận cảnh báo: *"Bạn có chắc chắn muốn chốt số liệu tàu này? Sau khi chốt, tàu sẽ chuyển sang chế độ Chỉ xem và chỉ tài khoản Admin mới có quyền mở lại."*
- **D-05:** Khi tàu ở trạng thái **Đã xong (`done`)**, toàn bộ tàu, sà lan và phiếu cân thuộc tàu đó sẽ chuyển sang chế độ **Chỉ xem (Read-only)**:
  - Hiển thị banner trạng thái *"Tàu đã chốt số liệu — Chế độ chỉ xem"* kèm icon khóa `lock`.
  - Ẩn hoặc vô hiệu hóa các nút: Thêm sà lan mới, Đổi tên/Xóa sà lan, Thêm phiếu cân mới, Sửa/Xóa phiếu cân.
  - Vẫn cho phép: Xem chi tiết, In phiếu cân, Xuất báo cáo Excel.
- **D-06:** Nút **"Mở lại: Đang làm hàng"** **CHỈ HIỂN THỊ** khi người dùng có vai trò Admin (`authStore.role === 'admin'`). Khi Admin bấm, hiển thị modal xác nhận và cập nhật trạng thái về `'in_progress'`.

### Giao diện 2 Tab & Đồng bộ (UI Tabs & Sync)
- **D-07:** Giao diện Báo cáo tổng quan và thanh danh sách bên trái (Sidebar) phân tách thành **2 Tab**:
  - Tab 1: **"Đang làm hàng"** (mặc định)
  - Tab 2: **"Đã xong"**
- **D-08:** Hiển thị badge số lượng tàu trực quan trên mỗi tab: `Đang làm hàng (N)` | `Đã xong (M)`.
- **D-09:** Đồng bộ trạng thái tab giữa Sidebar và Báo cáo tổng quan: khi người dùng chuyển tab ở một nơi, giao diện sẽ phản ánh đồng nhất.

### the agent's Discretion
- Chi tiết styling màu sắc của badge trạng thái: Màu xanh lá / teal cho `Đang làm hàng`, màu xám chì / tím nhạt cho `Đã xong`.
- Cấu trúc modal xác nhận dùng chung phong cách Tailwind cute / soft-shadow của hệ thống.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project Requirements & Notes
- `.planning/REQUIREMENTS.md` — Yêu cầu `VESSEL-01` và `VESSEL-02`.
- `.planning/notes/vessel-status-classification.md` — Ghi nhận thảo luận ban đầu về phân loại tàu và phân quyền.
- `.planning/ROADMAP.md` — Mục tiêu và tiêu chí thành công của Phase 8.

### Existing Services & Components
- `src/services/excel/WeighbridgeService.ts` — Quản lý `interface Vessel`, truy vấn Supabase bảng `weighbridge_vessels`, lưu cache IndexedDB.
- `src/components/tools/WeighbridgePrinter.vue` — Component chính quản lý giao diện Sidebar, Báo cáo tổng quan hệ thống và Báo cáo chi tiết tàu.
- `src/stores/auth.ts` — Quản lý quyền hạn người dùng (`authStore.role === 'admin'`).

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `authStore.role === 'admin'`: Đã có sẵn trong `src/stores/auth.ts`, dùng trực tiếp để phân quyền nút "Mở lại: Đang làm hàng".
- `useToast`: Composable thông báo toast đã dùng xuyên suốt trong `WeighbridgePrinter.vue`.
- `WeighbridgeService.ts`: Đã có sẵn các phương thức `renameVessel`, `deleteVessel`, dễ dàng thêm phương thức `updateVesselStatus(vesselId: number, status: 'in_progress' | 'done')`.

### Established Patterns
- Reactive state trong Vue 3 Composition API `<script setup lang="ts">`.
- Đồng bộ đa nguồn (Supabase + IndexedDB local cache) khi online/offline.

### Integration Points
- `WeighbridgePrinter.vue`:
  - Sidebar left (lines 4030-4120): Thêm header tab chuyển đổi "Đang làm hàng" / "Đã xong".
  - Global Dashboard (lines 4140-4250): Bảng sà lan và thống kê tàu lọc theo tab đang chọn.
  - Vessel Summary Dashboard (lines 4310-4350): Tiêu đề tàu gắn nút "Chốt số liệu: Đã xong" / "Mở lại: Đang làm hàng" (Admin only).
  - Khóa quyền thao tác thêm/sửa/xóa khi `activeVessel?.status === 'done'`.

</code_context>

<specifics>
## Specific Ideas

- Người dùng mong muốn màn hình Tổng quan thật gọn gàng, không bị lẫn lộn giữa tàu đang làm và tàu đã xong.
- Tên gọi hiển thị chính xác là "Đang làm hàng" và "Đã xong".
- Phân quyền nghiêm ngặt: Nhân viên được chốt, nhưng chỉ Admin được mở lại.

</specifics>

<deferred>
## Deferred Ideas

- None — Cuộc thảo luận tập trung đúng phạm vi nghiệp vụ của Phase 8.

</deferred>

---

*Phase: 08-vessel-status-and-permissions*
*Context gathered: 2026-09-11*
