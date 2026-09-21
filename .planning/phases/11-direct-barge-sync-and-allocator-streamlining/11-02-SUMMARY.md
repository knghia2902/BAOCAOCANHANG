# Phase 11: Plan 02 - Allocator Streamlining & Standardized History Tracking Summary

**Execution Date:** 2026-09-21  
**Status:** Completed  
**Requirements Addressed:** SYNC-DIRECT-01, SYNC-DIRECT-02, SYNC-DIRECT-04, SYNC-DIRECT-05

---

## 1. Overview & Accomplishments

Trong kế hoạch này, màn hình **Dữ liệu cân hàng** (`src/components/tools/CargoAllocator.vue`) đã được tái cấu trúc toàn diện theo đúng các yêu cầu nghiệp vụ mới:

1. **Loại bỏ Tab Phân bổ**:
   - Giao diện từ 3 tab được rút gọn còn 2 tab chính:
     - **Tab 1: 1. Phiếu cân (`activeDataTab = 'source'`)**
     - **Tab 2: 2. Theo dõi (`activeDataTab = 'generated'`)**
   - Loại bỏ hoàn toàn khối bảng hiển thị phân bổ xe cũ (`activeDataTab === 'template'`), pagination và các nút thao tác phân bổ synthetic trips.
   - Dọn dẹp triệt để các biến/hàm không còn sử dụng (`formatExcelTime`, `templateSortKey`, `toggleTemplateSort`, `filteredTrips`, `totalSplitWeightTons`, `isAlreadySaved`, `pagedTrips`, `totalPages`, `getTripsWithoutMooc`, `saveToHistory`, `deleteGeneratedTrip`, `editGeneratedTripOrderNo`, `clearAllGeneratedTrips`, `selectedCustomer`, `uniqueCustomers`).

2. **Loại bỏ thẻ Quy tắc phân bổ & Cấu hình tải trọng xe**:
   - Loại bỏ hoàn toàn 2 card thừa ở đầu màn hình (Quy tắc phân bổ: chiến lược chia, định thời gian; Cấu hình tải trọng: TTTP, xác xe, hạn mức hàng).
   - Tinh gọn card cấu hình Số phiếu tự động và cập nhật tiêu đề banner: *"Dữ liệu cân hàng & Sổ theo dõi phương tiện"*.

3. **Bổ sung tính năng "Lưu vào Sổ Theo Dõi" tại Tab 1**:
   - Thêm nút bấm nổi bật **"Lưu vào Sổ Theo Dõi"** tại toolbar của Tab 1.
   - Viết hàm `saveSourceTicketsToHistory`:
     - Kiểm tra dữ liệu phiếu cân.
     - Hiển thị hộp thoại xác nhận lưu.
     - Map chuẩn xác dữ liệu phiếu cân sang cấu trúc `SplitTrip` và lưu vào PostgreSQL (`weighbridge_tracking` qua `AllocatorService.insertTrips`) cùng IndexedDB (`allocator_history_trips`).
     - **Tự động làm sạch toàn bộ dữ liệu ở Tab 1** sau khi lưu (`csvRecords = []`, `csvFile = null`, đồng bộ state rỗng lên Supabase `allocator_tickets`).
     - Tự động chuyển người dùng sang Tab 2 (Theo dõi) để theo dõi và đối chiếu.

4. **Chuẩn hóa form hiển thị và xuất Excel của Tab 2 (Theo dõi)**:
   - Cập nhật bảng Tab 2 với 14 cột tiêu chuẩn khớp hoàn toàn cấu trúc phiếu cân gốc:
     *STT, Số phiếu, Mã lệnh, Số xe, Khách hàng, Loại hàng, TL1 (kg), TL2 (kg), KL hàng (kg), Thời gian vào, Thời gian ra, Tên sà lan, Ghi chú, Thao tác*.
   - Viết lại hàm `compileAndDownload`: Xuất file Excel chuẩn 15 cột với định dạng chuyên nghiệp, căn lề và độ rộng tự động.

---

## 2. Verification Results

- Đã chạy `npm run build`:
  - `vue-tsc -b` kiểm tra types không còn lỗi nào.
  - Vite build thành công bundle production mà không có lỗi (0 errors).
- Đảm bảo tính độc lập tuyệt đối giữa tính năng "Đồng bộ sà lan" tại *Báo cáo tổng quan* và "Lưu vào Sổ Theo Dõi" tại *Dữ liệu cân hàng*.

---

## 3. Files Modified

- `src/components/tools/CargoAllocator.vue`
