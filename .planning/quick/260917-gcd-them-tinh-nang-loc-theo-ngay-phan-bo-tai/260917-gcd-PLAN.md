# Quick Task 260917-gcd: Thêm tính năng lọc theo ngày vào Phân bổ tải trọng xếp hàng

**Status:** Complete (Verified with npm run build)

## Objective
Thêm bộ lọc theo ngày (Date Picker / Input date) vào công cụ **Phân bổ tải trọng xếp hàng** (CargoAllocator.vue) để người dùng có thể lọc danh sách phiếu cân (Tab 1), danh sách phân bổ (Tab 2) và sổ theo dõi (Tab 3) theo một ngày cụ thể hoặc xóa lọc để xem tất cả.

## Implementation Details
1. **State & Reactive Refs:**
   - sourceFilterDate: ref chuỗi ngày dạng YYYY-MM-DD cho Tab 1.
   - 	emplateFilterDate: ref chuỗi ngày dạng YYYY-MM-DD cho Tab 2.
   - historyFilterDate: ref chuỗi ngày dạng YYYY-MM-DD cho Tab 3.
2. **Computed Filtering:**
   - Cập nhật ilteredSourceTickets (Tab 1): lọc theo ngày vào/ra.
   - Cập nhật ilteredTrips (Tab 2): lọc theo ngày phân bổ.
   - Cập nhật ilteredHistoryTrips (Tab 3): lọc theo ngày chuyến xe.
   - Cập nhật khối lượng tổng (	otalCsvWeightTons, 	otalSplitWeightTons, historyTotalWeightTons) theo danh sách sau lọc.
   - Reset trang về 1 khi đổi ngày lọc.
3. **UI / Design System:**
   - Ô input date chuẩn h-7, border-gray-200, rounded-[8px], icon calendar_today và nút close xóa lọc.
