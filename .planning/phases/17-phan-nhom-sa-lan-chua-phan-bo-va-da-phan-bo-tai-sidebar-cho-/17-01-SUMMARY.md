# Plan Summary: 17-01 Phân nhóm Sà lan Chưa phân bổ và Đã phân bổ tại Sidebar cho Tàu Nông Sản De Heus

## Summary of Accomplishments

1. **State & Logic phân loại Sà lan:**
   - Thêm reactive state `selectedBargeStatusTab` (`pending` | `completed`).
   - Hàm `isBargeAllocated(barge)` kiểm tra sự tồn tại của các chuyến xe trong `existingTrips` (Sổ theo dõi / `weighbridge_allocation_tracking`) theo `bargeId`, `bargeName` hoặc `orderNo`.
   - Hàm `getBargeAllocatedSummary(barge)` tính tổng số chuyến và tổng số tấn hàng đã phân bổ của sà lan đó.
   - Thêm computed `allDeHeusBarges`, `unallocatedBarges` (Chưa phân bổ), và `allocatedBarges` (Đã phân bổ).

2. **Điều hướng thông minh khi chọn sà lan & Tự động đổi trạng thái:**
   - Hàm `selectBargeFromSidebar(barge, isAllocated)`:
     - Khi chọn sà lan trong **Đã phân bổ**: Tự động chuyển khung làm việc sang **Tab 3 ("Sổ theo dõi")** và kích hoạt bộ lọc `historyBargeFilter = 'current'` để người dùng xem ngay kết quả và xuất Excel.
     - Khi chọn sà lan trong **Chưa phân bổ**: Tự động mở Tab 1 / Tab 2 để sẵn sàng nạp phiếu và phân bổ.
   - Hàm `switchBargeStatusTab`: Khi chuyển đổi tab tại Sidebar, tự động chọn sà lan đầu tiên của tab đó nếu sà lan hiện tại không nằm trong danh sách.
   - Cập nhật `saveToHistory`: Ngay khi người dùng bấm "Lưu vào Sổ theo dõi", hệ thống tự động đổi `selectedBargeStatusTab = 'completed'` và `historyBargeFilter = 'current'` để sà lan lập tức chuyển sang tab "Đã phân bổ".

3. **Giao diện Sidebar trực quan:**
   - Thay thế dropdown đơn giản bằng cụm 2 tab dạng Segmented Pills:
     - `[⏳ Chưa phân bổ (X)]` (màu hổ phách)
     - `[✅ Đã phân bổ (Y)]` (màu ngọc lục bảo)
   - Danh sách thẻ sà lan nhỏ gọn với thanh cuộn custom-scrollbar:
     - Hiển thị tên sà lan, icon, badge mã lệnh, badge loại hàng.
     - Nếu đã phân bổ: Badge checkmark `Đã xong` kèm thông tin số chuyến và khối lượng tấn.
     - Nếu chưa phân bổ: Badge cam `Chờ phân bổ`.
     - Thẻ sà lan đang chọn được làm nổi bật với viền màu thương hiệu, nền sáng và ring highlight.
   - Trạng thái trống (Empty state) thân thiện khi tất cả sà lan đã hoàn thành hoặc chưa có sà lan nào được lưu.

## Verification
- Kiểm tra biên dịch dự án với `npm run build` (`vue-tsc -b && vite build`) hoàn tất trong 1m 7s với **0 lỗi**.
