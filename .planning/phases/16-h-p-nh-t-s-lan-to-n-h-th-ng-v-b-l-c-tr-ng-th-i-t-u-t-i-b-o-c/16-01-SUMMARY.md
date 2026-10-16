# GSD Phase 16 Summary: Hợp nhất danh sách sà lan toàn hệ thống và bổ sung bộ lọc trạng thái tàu tại Báo cáo tổng quan

## 1. Overview & Objective
Giải quyết triệt để tình trạng sà lan bị phân mảnh giữa 2 tab sidebar (Tàu đang làm hàng và Tàu đã xong) khi người dùng truy cập Báo cáo tổng quan hệ thống. Giúp người dùng có thể lọc toàn bộ sà lan đã chốt số liệu trên toàn hệ thống trong bất kỳ kỳ tính phí nào để phục vụ việc tính phí cầu bến, hoặc lọc độc lập theo trạng thái tàu mẹ mà không làm thay đổi các bảng biểu và xuất Excel hiện có.

## 2. Changes Implemented
- **Hợp nhất `allBarges` (`src/components/tools/WeighbridgePrinter.vue`):**
  - Đổi nguồn lấy sà lan từ `targetVessels = selectedVesselStatusTab.value === 'done' ? doneVessels.value : inProgressVessels.value;` thành duyệt qua toàn bộ `vessels.value`.
  - Bổ sung thuộc tính `vesselStatus: (v.status || 'in_progress') as 'in_progress' | 'done'` vào mỗi bản ghi sà lan.
- **Thêm bộ lọc Trạng thái tàu độc lập (`globalFilterVesselStatus`):**
  - Khai báo reactive ref `const globalFilterVesselStatus = ref<string>('');`.
  - Cập nhật computed `filteredAllBarges` áp dụng bộ lọc `vesselStatus` khi người dùng chọn lọc trạng thái tàu mẹ, vận hành song song và độc lập hoàn toàn với bộ lọc Kỳ tính phí cầu bến (`globalFilterType`) và ô tìm kiếm (`globalBargeSearchQuery`).
- **Cập nhật giao diện & KPI Cards:**
  - Bổ sung dropdown Trạng thái tàu `[ Tất cả trạng thái tàu | 🚢 Đang làm hàng (n) | ✅ Đã xong (n) ]` trên thanh công cụ lọc của bảng Báo cáo tổng quan.
  - Cập nhật thẻ KPI số lượng tàu: hiển thị Tổng số tàu hoặc số lượng tàu theo trạng thái được chọn (`globalFilterVesselStatus`).
  - Thẻ KPI Tổng số sà lan: phản ánh số lượng sà lan hợp nhất trên toàn hệ thống.
  - Tích hợp nhãn trạng thái tàu vào dòng phụ đề tiêu đề trong file Excel xuất ra (`exportAllBargesToExcel`).
  - Giữ nguyên toàn bộ cột hiển thị của bảng và form xuất file Excel theo đúng Phương án 2 người dùng đã chọn.

## 3. Verification & Checks
- **Impact Analysis (GitNexus):** Phân tích blast radius cho `allBarges` cho kết quả Low risk / 0 caller ngoài phạm vi component.
- **TypeScript & Build:** Chạy lệnh `npm run build` (`vue-tsc -b && vite build`) hoàn tất thành công 100% với mã thoát `0`.
- **Detect Changes (GitNexus):** Kiểm tra `detect-changes` xác nhận chỉ ảnh hưởng đúng 1 file mã nguồn chính `src/components/tools/WeighbridgePrinter.vue` với mức rủi ro Thấp (Low risk), không tác động tiêu cực đến bất kỳ luồng thực thi nào khác.

## 4. Requirements Satisfied
- [x] `UNIFY-BARGES-01`: Hợp nhất toàn bộ sà lan thuộc tất cả các tàu (đang làm & đã xong) trong Báo cáo tổng quan.
- [x] `VESSEL-FILTER-01`: Bộ lọc trạng thái tàu độc lập, hỗ trợ lọc riêng lẻ hoặc kết hợp linh hoạt với kỳ tính phí cầu bến.
