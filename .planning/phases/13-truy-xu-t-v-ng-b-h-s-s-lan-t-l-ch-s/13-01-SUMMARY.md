# Plan Summary: 13-01 Truy xuất và đồng bộ hồ sơ sà lan từ lịch sử

## Kết quả đạt được (Accomplishments)
1. **Thuật toán tìm kiếm hồ sơ sà lan lịch sử mới nhất (`findLatestHistoricalBarge`):**
   - Chuẩn hóa tên sà lan sang in hoa và loại bỏ khoảng trắng thừa.
   - Quét tìm trong toàn bộ danh sách sà lan của tất cả các tàu vận tải (`vessels`) và khu vực Phú Mỹ.
   - Loại trừ sà lan hiện tại đang mở chỉnh sửa (`b.id !== activeBargeId`).
   - Lọc các sà lan có dữ liệu hồ sơ thực tế (thông số kỹ thuật, GCN, Đăng kiểm, Bảo hiểm, Thuyền viên, hình ảnh).
   - Tự động sắp xếp theo thời gian mới nhất (ưu tiên `updatedAt`, `created_at`, hoặc timestamp) để chọn ra bản ghi gần đây nhất.

2. **Giao diện & Nút bấm "Truy xuất hồ sơ cũ":**
   - Đặt nút bấm nổi bật, tinh tế kèm icon `history` ngay cạnh tiêu đề "Tên sà lan" trong form chỉnh sửa hồ sơ.
   - Bắt sự kiện người dùng: nếu để trống tên sà lan sẽ nhắc nhở nhập tên; nếu không tìm thấy sẽ hiển thị thông báo thân thiện.

3. **Hộp thoại xác nhận đồng bộ (`showSyncConfirmModal`):**
   - Thiết kế modal bo góc mềm mại, hiển thị rõ tên sà lan tìm thấy, tên tàu mẹ cũ và ngày cập nhật.
   - Tóm tắt trực quan 6 nhóm dữ liệu sẽ được sao chép (Trọng tải & Công suất, GCN, Đăng kiểm, Bảo hiểm, Thuyền bộ, Hình ảnh đính kèm).
   - Thông báo rõ ràng các thông tin chuyến mới (Số lệnh, Hàng hóa, Giờ cập/rời) sẽ được giữ nguyên vẹn.

4. **Nạp dữ liệu tự động & Cập nhật tính hợp lệ:**
   - Nạp trọn vẹn thông số kỹ thuật (`tonnage`, `hp`).
   - Nạp trọn vẹn số hiệu, ngày cấp, ngày hết hạn và mảng link hình ảnh của 3 loại giấy tờ (GCN, Đăng kiểm, Bảo hiểm).
   - Nạp trọn vẹn họ tên, hạng bằng, CCCD của Thuyền trưởng, Máy trưởng, Thủy thủ, tình trạng Sổ danh bạ và toàn bộ ảnh hồ sơ thuyền viên.
   - Tự động kích hoạt lại reactive validation của Vue để cập nhật trạng thái hồ sơ (ĐỦ/THIẾU), trạng thái thuyền viên (PHÙ HỢP/KHÔNG PHÙ HỢP) và kết luận ("Cho phép"/"Không cho phép") ngay lập tức.

## Kiểm thử & Xác thực (Verification)
- Chạy `npm run build` (`vue-tsc -b && vite build`) hoàn tất với 0 lỗi cú pháp TypeScript hay Vue template.
- Asset `VehiclesView-CXYoWWL6.js` đóng gói thành công.
