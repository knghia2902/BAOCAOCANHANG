# Kết quả tích hợp hồ sơ phương tiện & nhập Excel

Đã tích hợp thành công cấu trúc hồ sơ phương tiện chi tiết từ file Excel quản lý sà lan của cảng và bổ sung tính năng nạp dữ liệu hàng loạt từ file Excel.

## Các nội dung đã hoàn thành

### 1. Thay đổi cấu trúc dữ liệu (`BargeConfig`)
* Thêm các trường dữ liệu kỹ thuật và thời hạn pháp lý:
  - `tonnage` (Trọng tải)
  - `hp` (Công suất)
  - `gcnNo`, `gcnIssuedDate`, `gcnExpiryDate` (Đăng ký)
  - `dkNo`, `dkIssuedDate`, `dkExpiryDate` (Đăng kiểm)
  - `bhNo`, `bhIssuedDate`, `bhExpiryDate` (Bảo hiểm)
* Thêm các trường quản lý thuyền viên và hành trình di chuyển:
  - `captain` (Thuyền trưởng)
  - `captainGrade` (Hạng thuyền trưởng)
  - `chiefEngineer` (Máy trưởng)
  - `chiefEngineerGrade` (Hạng máy trưởng)
  - `sailors` (Thủy thủ - Văn bản nhiều dòng)
  - `hasCrewBook` (Có sổ danh bạ thuyền viên - Checkbox)
  - `arrivalTime` (Thời gian cập bến)
  - `departureTime` (Thời gian rời bến)

### 2. Các chỉ số tự động tính toán
* **Đủ hồ sơ**: Tự động chuyển trạng thái thành **ĐỦ** (xanh) nếu sà lan có đủ mã số GCN đăng ký, Đăng kiểm, Bảo hiểm; ngược lại hiện **THIẾU** (đỏ).
* **Trạng thái GCN**: Tự động so sánh hạn GCN đăng ký với ngày hiện tại để báo **CÒN HẠN** hoặc **HẾT HẠN**.

### 3. Tính năng Nhập từ Excel
* Thêm nút **"Nhập từ Excel"** cho phép chọn tệp Excel.
* Tự động lọc tìm tên sà lan khớp trong danh sách sà lan hiện có trên hệ thống để gộp/cập nhật thông tin hàng loạt (Trọng tải, Công suất, số hiệu, ngày cấp/hết hạn).
* Hỗ trợ tự động chuyển đổi định dạng ngày của Excel sang chuỗi ngày chuẩn tương thích HTML5 date picker.

### 4. Nâng cấp giao diện người dùng
* **Bảng danh sách**: Hiển thị trực quan Trọng tải, Công suất, huy hiệu xanh/đỏ Đủ hồ sơ & Trạng thái GCN.
* **Modal Chỉnh sửa**:
  - Cột bên trái: Rút gọn tối đa (chỉ giữ lại Tên sà lan, Mã lệnh, Tên hàng hóa), đồng thời bổ sung toàn bộ trường nhập liệu về **Thành viên đoàn** (Thuyền trưởng/Máy trưởng & Hạng tương ứng, danh sách Thủy thủ, checkbox Danh bạ thuyền viên) và các trường chọn **Thời gian cập bến & Rời bến** trực quan.
  - Cột bên phải: Form chi tiết về Trọng tải, Công suất và 3 nhóm giấy tờ Đăng ký, Đăng kiểm, Bảo hiểm với date-pickers đầy đủ.
  - Vẫn giữ nguyên phần **Thông số phụ khác** ở dưới cùng để người dùng tự nhập thêm bất kỳ thông số nào khác ngoài file Excel.

## Xác minh thực tế
* Dự án biên dịch thành công (`npm run build`).
* Đã commit và đẩy các thay đổi lên GitHub nhánh `master` tại commit `8ae8e7f`.
