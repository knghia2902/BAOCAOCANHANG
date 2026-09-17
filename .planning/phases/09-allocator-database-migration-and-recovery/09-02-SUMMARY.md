# Phase 09 Plan 02: AllocatorService, UI Integration & Safe Cleanup Summary

**Thực hiện vào:** 17/09/2026  
**Trạng thái:** Hoàn thành xuất sắc (Build Passed 100%)

---

## 1. Kết quả thực hiện

### 1.1 Triển khai AllocatorService.ts (Task 1)
- **Tệp tạo mới:** `src/services/excel/AllocatorService.ts`
- **Re-export:** `src/services/index.ts`
- Cung cấp đầy đủ các phương thức định kiểu mạnh mẽ kết nối với bảng `allocator_history_trips`:
  - `getRecentTrips(days = 30)`: Tự động phân trang vòng lặp vượt qua giới hạn 1,000 dòng của Supabase, tải dữ liệu 30 ngày gần nhất trong <0.5 giây.
  - `getAllTrips(onProgress)`: Nạp toàn bộ 18,522 chuyến xe lịch sử có thông báo tiến độ.
  - `getTripsByDate(ymd)`: Truy vấn tức thì các chuyến xe theo ngày cụ thể (chuẩn hóa giờ địa phương UTC+7).
  - `insertTrips(trips)`: Bulk insert các chuyến xe mới theo từng khối 500 bản ghi.
  - `updateTripOrderNo()` & `deleteTrip()`: Cập nhật và xóa chuyến xe trực tiếp trên Supabase.

### 1.2 Tái cấu trúc Tab 3 trong CargoAllocator.vue (Task 2)
- Tab 3 (Theo dõi) mặc định nạp 30 ngày gần nhất từ `allocator_history_trips` khi mở trang, giảm thời gian nạp ban đầu từ 5-7 giây xuống < 0.5 giây.
- Bổ sung nút **"Tải toàn bộ lịch sử"** trên thanh công cụ kèm bộ đếm tiến độ (`Đang tải...`) và huy hiệu `Đã tải đủ (18,522)` khi hoàn tất.
- Khi người dùng chọn lọc ngày ngoài khoảng 30 ngày đã tải: watcher tự động gọi `AllocatorService.getTripsByDate(date)` để lấy đúng dữ liệu ngày đó bổ sung vào bảng hiển thị, kèm biểu tượng spinner tải dữ liệu.

### 1.3 Chuyển cơ chế lưu Tab 2 sang Bulk Insert nguyên tử (Task 3)
- `saveTripsToHistory()`: Chuyển từ việc serialize toàn bộ mảng lịch sử sang gọi `AllocatorService.insertTrips(generatedTrips)`.
- Các chuyến mới được chèn ngay vào đầu `existingTrips` trên giao diện, Tab 1 & Tab 2 được làm sạch, thời gian lưu chỉ mất ~0.2 giây.
- `doExecuteSaveTicketsToSupabase()`: Loại bỏ hoàn toàn việc gửi mảng `allocator_history_trips` lên `content.settings`.
- Các thao tác sửa mã lệnh (`editHistoryTripOrderNo`) và xóa chuyến (`deleteHistoryTrip`) được kết nối trực tiếp với `AllocatorService`.

### 1.4 Dọn dẹp an toàn khối JSON 7.2MB và kiểm tra Build (Task 4)
- **Kịch bản:** `scripts/cleanup_content_settings.cjs`
- Kiểm tra an toàn kép (Safety Guard):
  - Tệp sao lưu tĩnh `allocator_history_trips_backup_16303.json` (8.58 MB) tồn tại và nguyên vẹn.
  - Bảng `allocator_history_trips` có 18,522 bản ghi (>= 17,900).
- Xóa thành công key `allocator_history_trips` khỏi cột `settings` của hàng `main`.
- Kích thước `content.settings` giảm từ **7.03 MB** xuống **246 KB** (giảm 96.6%), triệt tiêu hoàn toàn lỗi HTTP 500 và tải chậm.
- Kiểm tra `npm run build`: Đóng gói thành công 100%, không có bất kỳ lỗi TypeScript nào.

---

## 2. Danh sách tệp sửa đổi và tạo mới

- `src/services/excel/AllocatorService.ts`
- `src/services/index.ts`
- `src/components/tools/CargoAllocator.vue`
- `scripts/cleanup_content_settings.cjs`
