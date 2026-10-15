# Phase 15: Chuyển sà lan giữa các tàu bằng kéo thả an toàn trong Báo Cáo Tổng Quan - Context

**Gathered:** 2026-10-15  
**Status:** Planned  

---

## 1. Bối cảnh & Nghiệp vụ thực tế tại cảng

- **Thực tế khai thác cảng:** Các sà lan ban đầu được lên kế hoạch làm hàng cho Tàu mẹ A. Tuy nhiên trong quá trình đang xuất hàng cho sà lan hoặc sau khi điều độ, kế hoạch khai thác của cảng thay đổi: sà lan đó được điều động chuyển sang cấp hàng/nhận hàng cho Tàu mẹ B.
- **Yêu cầu cốt lõi:**
  - Chuyển trọn gói sà lan từ Tàu A sang Tàu B trong Báo Cáo Tổng Quan.
  - Toàn bộ dữ liệu bên trong sà lan (danh sách xe, phiếu cân `weighbridge_trucks`, số lượng chuyến, khối lượng Net, cấu hình hàng hóa, biên bản và thông số kỹ thuật) được **bảo lưu nguyên vẹn 100%**.
  - Các chỉ số tổng hợp (tổng khối lượng, tổng lượt xe) của Tàu A tự động trừ đi số hàng của sà lan chuyển đi, và Tàu B tự động cộng dồn số hàng này.
- **Yêu cầu về trải nghiệm người dùng (UX) và an toàn (Safety):**
  - Người dùng muốn thao tác kéo - thả (Drag & Drop) trực quan giữa các tàu trên cây danh mục (Sidebar).
  - **Cơ chế chống trượt tay / thả nhầm:** Kéo-thả bắt buộc phải đi kèm Hộp thoại xác nhận (Confirm Dialog). Khi buông chuột vào tàu đích, hệ thống chưa chuyển ngay mà hiển thị modal chi tiết (Tên sà lan, Tàu nguồn, Tàu đích, Tổng sản lượng) để người dùng bấm "Xác nhận chuyển" hoặc "Hủy bỏ".
  - **Khóa an toàn:** Tuyệt đối không cho phép chuyển sà lan vào hoặc ra khỏi Tàu mẹ đã ở trạng thái "Chốt số liệu" (`status: 'done'`).
  - **Dự phòng thiết bị di động:** Song song với kéo-thả, cung cấp nút bấm "Chuyển tàu mẹ" trong menu sà lan để nhân viên dễ dàng thao tác bằng ngón tay trên điện thoại / tablet ngoài cầu cảng.

---

## 2. Các quyết định kỹ thuật đã thống nhất

1. **Service Layer (`WeighbridgeService.ts`):**
   - Viết hàm `moveBarge(bargeId: number, targetVesselId: number): Promise<boolean>`.
   - Cập nhật bộ nhớ cục bộ `wb_vessels` trong IndexedDB (di chuyển đối tượng sà lan từ `sourceVessel.barges` sang `targetVessel.barges`, cập nhật `vessel_id`).
   - Cập nhật Supabase bảng `weighbridge_barges` với `{ vessel_id: targetVesselId }`.
   - Giữ nguyên toàn bộ bảng `weighbridge_trucks` (do liên kết theo `barge_id`).
2. **Kéo - thả HTML5 trong Sidebar (`WeighbridgePrinter.vue`):**
   - Item sà lan được gắn thuộc tính `draggable`. Bắt sự kiện `dragstart` lưu sà lan nguồn và tàu nguồn.
   - Item Tàu mẹ được gắn sự kiện `dragover`, `dragleave`, `drop`.
   - Hiệu ứng visual highlight viền xanh/nền nổi bật khi sà lan đang được kéo rê qua một tàu hợp lệ; hiển thị cấm nếu tàu đích là chính nó hoặc tàu đã chốt số liệu.
3. **Modal xác nhận an toàn (`BaseConfirmModal` / Custom Modal):**
   - Hiển thị đầy đủ thông tin: Sà lan, Tàu hiện tại ➔ Tàu đích, Cảnh báo số liệu.
   - Nút "Hủy bỏ" (giữ nguyên không đổi) và nút "Xác nhận chuyển".
4. **Nút thao tác thủ công (Fallback):**
   - Nút icon `swap_horiz` (Chuyển tàu) cạnh nút sửa/xóa tên sà lan trên Sidebar.
   - Bấm vào mở modal kèm dropdown danh sách các tàu đang làm hàng để chọn tàu đích.
