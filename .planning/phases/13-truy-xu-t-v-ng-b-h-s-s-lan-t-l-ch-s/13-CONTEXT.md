# Phase 13: Truy xuất và đồng bộ hồ sơ sà lan từ lịch sử — Context

## 1. Mục tiêu & Bối cảnh
- **Bối cảnh:** Trong hoạt động quản lý phương tiện thủy nội địa tại cảng (`BargeProfileManager.vue`), mỗi sà lan gắn liền với một tàu vận tải (`Vessel`) hoặc khu vực (Phú Mỹ). Nhiều sà lan quen thường xuyên quay lại cảng trong các chuyến mới.
- **Vấn đề:** Hiện tại khi một sà lan quen quay lại cảng, người dùng phải nhập lại thủ công từ đầu: Trọng tải, công suất máy, số hiệu và hạn của 3 loại giấy tờ (GCN, Đăng kiểm, Bảo hiểm), danh sách thuyền bộ và phải tìm/tải lại từng ảnh đính kèm.
- **Giải pháp:** Bổ sung tính năng "Truy xuất hồ sơ cũ" ngay trong form sà lan, cho phép tự động quét lịch sử các chuyến trước để tìm bản ghi sà lan gần nhất cùng tên và đồng bộ toàn bộ dữ liệu chỉ với 1 cú click sau khi xác nhận.

## 2. Các quyết định thiết kế đã chốt (Decisions Locked)
- **Điểm kích hoạt (Trigger):**
  - Đặt một nút bấm **"Truy xuất hồ sơ cũ"** (kèm icon `history` / `sync`) ngay cạnh ô nhập **Tên sà lan** (`editBargeName`) trong form hồ sơ sà lan (`BargeProfileManager.vue`).
  - Kiểm tra điều kiện tiên quyết: Nếu ô tên sà lan đang trống, báo Toast nhắc nhở: *"Vui lòng nhập tên sà lan trước khi truy xuất!"*.
- **Chiến lược tìm kiếm (Search & Matching):**
  - Chuẩn hóa tên sà lan (cắt khoảng trắng thừa, chuyển chữ in hoa).
  - Tìm kiếm trong toàn bộ các sà lan đã lưu thuộc tất cả các tàu (`vessels`), loại trừ sà lan hiện tại đang mở (`b.id !== activeBargeId`).
  - **Nếu không tìm thấy:** Báo Toast *"Không tìm thấy dữ liệu cũ của sà lan [Tên sà lan]"*.
  - **Nếu tìm thấy:** Luôn ưu tiên chọn **bản ghi mới nhất** (theo `updatedAt`, `created_at`, hoặc chuyến tàu gần nhất).
- **Hộp thoại xác nhận:**
  - Hiển thị hộp thoại xác nhận rõ ràng: *"Tìm thấy hồ sơ sà lan [Tên sà lan] từ tàu [Tên tàu cũ] (ngày ...). Bạn có muốn đồng bộ dữ liệu sang sà lan này không?"*.
- **Phạm vi dữ liệu được đồng bộ (Field Mapping Matrix):**
  - **Được sao chép từ bản ghi cũ:**
    - Thông số kỹ thuật: `tonnage` (Trọng tải), `hp` (Công suất máy).
    - Giấy chứng nhận (GCN): `gcnNo`, `gcnIssuedDate`, `gcnExpiryDate`, danh sách ảnh `gcnImages`.
    - Đăng kiểm (ĐK): `dkNo`, `dkIssuedDate`, `dkExpiryDate`, danh sách ảnh `dkImages`.
    - Bảo hiểm (BH): `bhNo`, `bhIssuedDate`, `bhExpiryDate`, danh sách ảnh `bhImages`.
    - Thuyền bộ: `captain`, `captainGrade`, `captainCccd`, `chiefEngineer`, `chiefEngineerGrade`, `chiefEngineerCccd`, `sailors`, `sailorsCccd`, `hasCrewBook`, danh sách ảnh `crewImages`.
    - Thông tin mở rộng: `customProfileInfo` (`customMetas`).
  - **Giữ nguyên theo chuyến hiện tại (KHÔNG ghi đè):**
    - Số lệnh (`orderNo`).
    - Mặt hàng (`goods`, `goodsCode`).
    - Phân loại xuất nhập (`xn`).
    - Thời gian hành trình (`arrivalDate`, `arrivalTimeStr`, `departureDate`, `departureTimeStr`).
    - Cảng cuối (`lastPort`), Khai hệ thống (`khaihethong`).
    - Khóa sà lan (`locked`).
- **Phản hồi UI & Tính toán hợp lệ:**
  - Sau khi nạp dữ liệu, tự động kích hoạt tính toán lại trạng thái định mức thuyền viên (`getCrewStatus`, `isEditCrewFit`), trạng thái giấy tờ (`isEditDocComplete`), và cập nhật kết luận (`editKetluan`).
  - Hiển thị Toast thông báo thành công: *"Đã đồng bộ dữ liệu hồ sơ cũ thành công!"*.

## 3. Kế hoạch triển khai (Plan Outline)
- **Plan 13-01:** Triển khai nút "Truy xuất hồ sơ cũ" trong `BargeProfileManager.vue`, viết hàm helper tìm kiếm bản ghi sà lan mới nhất theo tên, tích hợp hộp thoại xác nhận và thực hiện nạp dữ liệu vào form cùng kiểm tra hợp lệ tự động.
