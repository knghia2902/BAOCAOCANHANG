# Phase 15 Plan 01: Summary

**Executed:** 2026-10-15  
**Status:** Completed & Verified  

---

## 1. Kết quả thực hiện

- **Service Layer (`WeighbridgeService.ts`):**
  - Thêm phương thức `moveBarge(bargeId: number, targetVesselId: number): Promise<boolean>`.
  - Cập nhật an toàn cả bộ nhớ đệm cục bộ IndexedDB (`wb_vessels`) và cơ sở dữ liệu Supabase (`weighbridge_barges.vessel_id`).
  - Toàn bộ dữ liệu số chuyến xe, phiếu cân (`weighbridge_trucks`), khối lượng Net, cấu hình biên bản và hồ sơ kỹ thuật của sà lan được **bảo lưu nguyên vẹn 100%**.

- **HTML5 Drag & Drop trên Sidebar (`WeighbridgePrinter.vue`):**
  - Kích hoạt thuộc tính `draggable` cho các sà lan (chặn khi sà lan đang khóa hoặc thuộc tàu đã xong).
  - Tích hợp sự kiện `@dragstart`, `@dragend` cho sà lan, và `@dragover`, `@dragleave`, `@drop` cho các thẻ Tàu mẹ.
  - Hiệu ứng visual cues: Highlight viền xanh ngọc (`border-2 border-teal-500 bg-teal-50/80 shadow-md ring-2 ring-teal-400/30`) khi rê sà lan qua tàu đích hợp lệ; tự động chặn khi rê qua tàu hiện tại hoặc tàu đã chốt số liệu.

- **Hộp thoại xác nhận an toàn 3 lớp (Confirm Dialog chống thả nhầm):**
  - Khi buông chuột thả sà lan (hoặc bấm nút chuyển tàu), hệ thống mở modal xác nhận trực quan:
    - Hiển thị tên sà lan, Tàu hiện tại ➔ Tàu đích đến.
    - Cung cấp dropdown chọn tàu đích nếu cần đổi sang tàu khác.
    - Hiển thị cảnh báo rõ ràng về việc bảo lưu 100% dữ liệu phiếu cân.
    - Nút `Hủy bỏ` (hoàn tác không làm thay đổi dữ liệu) và nút `Xác nhận chuyển`.

- **Nút chuyển tàu dự phòng cho thiết bị di động:**
  - Bổ sung nút icon `swap_horiz` trên từng dòng sà lan ở thanh Sidebar bên trái.
  - Bổ sung nút `Chuyển tàu` cạnh nút khóa sà lan trên thanh tiêu đề chi tiết khi đang mở sà lan.

---

## 2. File thay đổi

- `src/services/weighbridge/WeighbridgeService.ts`
- `src/components/tools/WeighbridgePrinter.vue`

---

## 3. Kiểm thử & Đóng gói

- `npm run build`: `vue-tsc -b && vite build` hoàn thành thành công không có lỗi (exit code 0).
- Hệ thống log hành động qua `LogService` khi chuyển sà lan.
