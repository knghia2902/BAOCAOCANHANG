---
title: Đặc tả cơ chế truy xuất & đồng bộ hồ sơ sà lan từ lịch sử
date: 2026-09-24
context: Quyết định thiết kế theo quy trình gsd-explore cho tính năng nhập hồ sơ sà lan mới
---

# Đặc tả cơ chế truy xuất & đồng bộ hồ sơ sà lan từ lịch sử

## 1. Mục tiêu & Ý nghĩa nghiệp vụ
Trong hoạt động quản lý phương tiện thủy nội địa tại cảng, nhiều sà lan thường xuyên ra vào cảng qua nhiều chuyến tàu khác nhau. 
Mỗi chuyến tàu hiện tại được quản lý như một thực thể riêng biệt (`Vessel` chứa danh sách `Barge`).
Do đó, khi một sà lan quen quay lại trong chuyến mới, việc nhập lại toàn bộ thông tin đăng kiểm, bảo hiểm, công suất, trọng tải và thuyền viên gây tốn thời gian và dễ sai sót.

Tính năng **"Truy xuất hồ sơ cũ"** giải quyết vấn đề này bằng cách cho phép sà lan mới kế thừa toàn bộ hồ sơ kỹ thuật, pháp lý và thuyền bộ gần nhất của chính nó chỉ với 1 cú click.

---

## 2. Quy tắc nghiệp vụ (Business Rules)

### 2.1. Điểm kích hoạt (Trigger Point)
- Nằm trong form chỉnh sửa hồ sơ sà lan (`BargeProfileManager.vue`).
- Đặt cạnh trường Tên sà lan (`editBargeName`).
- Chỉ kích hoạt khi tên sà lan không để trống. Nếu để trống, hiển thị cảnh báo: *"Vui lòng nhập tên sà lan trước khi truy xuất!"*.

### 2.2. Thuật toán tìm kiếm & Chọn bản ghi
1. Chuẩn hóa tên sà lan: `targetName = editBargeName.trim().toUpperCase()`.
2. Duyệt qua tất cả các sà lan trong toàn bộ danh sách `vessels` (cả Cảng Nguyên Ngọc và Phú Mỹ).
3. Lọc các sà lan thỏa mãn:
   - `b.name.trim().toUpperCase() === targetName`
   - `b.id !== activeBargeId` (không so sánh với chính sà lan hiện tại đang mở).
4. Phân loại kết quả:
   - **Trường hợp 0 bản ghi:** Báo lỗi Toast *"Không tìm thấy dữ liệu cũ của sà lan [Tên sà lan]"*.
   - **Trường hợp >= 1 bản ghi:** Sắp xếp theo thứ tự thời gian giảm dần (ưu tiên `updatedAt`, sau đó `created_at`, hoặc `id`) để chọn ra **bản ghi mới nhất**.
5. Mở hộp thoại xác nhận với người dùng, hiển thị rõ sà lan được tìm thấy từ tàu nào và thời gian nào.

---

## 3. Ma trận trường dữ liệu (Field Mapping Matrix)

| Nhóm thông tin | Trường cụ thể | Trạng thái đồng bộ | Ghi chú |
|---|---|:---:|---|
| **Thông số kỹ thuật** | `tonnage` (Trọng tải), `hp` (Công suất) | **Sao chép** | Tự động tính toán định biên thuyền viên tương ứng |
| **Giấy chứng nhận (GCN)** | `gcnNo`, `gcnIssuedDate`, `gcnExpiryDate`, `gcnImages` | **Sao chép** | Sao chép cả link ảnh đính kèm |
| **Đăng kiểm (ĐK)** | `dkNo`, `dkIssuedDate`, `dkExpiryDate`, `dkImages` | **Sao chép** | Sao chép cả link ảnh đính kèm |
| **Bảo hiểm (BH)** | `bhNo`, `bhIssuedDate`, `bhExpiryDate`, `bhImages` | **Sao chép** | Sao chép cả link ảnh đính kèm |
| **Thuyền viên** | `captain`, `captainGrade`, `captainCccd`, `chiefEngineer`, `chiefEngineerGrade`, `chiefEngineerCccd`, `sailors`, `sailorsCccd`, `hasCrewBook`, `crewImages` | **Sao chép** | Kế thừa thuyền bộ và ảnh bằng lái/sổ danh bạ |
| **Metadata mở rộng** | `customProfileInfo` (`customMetas`) | **Sao chép** | Các trường tùy chỉnh nếu có |
| **Thông tin chuyến hàng** | `orderNo` (Số lệnh), `goods` (Hàng hóa), `goodsCode`, `xn` (Xuất/nhập), `locked` | **GIỮ NGUYÊN** | Không bị ghi đè |
| **Thời gian & Hành trình** | `arrivalDate`, `arrivalTimeStr`, `departureDate`, `departureTimeStr`, `lastPort`, `khaihethong` | **GIỮ NGUYÊN** | Thông tin đặc thù theo chuyến hiện tại |

---

## 4. Trạng thái phản hồi & Tương tác UI
- Sau khi đồng bộ, hệ thống tự động chạy lại các logic tính toán điều kiện:
  - `isEditDocComplete`: Kiểm tra đủ số hiệu GCN, ĐK, BH.
  - `isEditCrewFit`: Kiểm tra bằng cấp thuyền trưởng, máy trưởng, thủy thủ theo trọng tải và công suất mới nạp.
  - `editKetluan`: Tự động cập nhật thành "Cho phép" hoặc "Không cho phép".
  - Hiển thị Toast thông báo thành công màu xanh lá.
