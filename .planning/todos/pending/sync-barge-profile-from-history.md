---
title: Tính năng truy xuất & đồng bộ hồ sơ sà lan cũ trong Quản lý hồ sơ phương tiện
date: 2026-09-24
priority: high
status: pending
---

# Tính năng truy xuất & đồng bộ hồ sơ sà lan cũ trong Quản lý hồ sơ phương tiện

## Bối cảnh
Khi nhập dữ liệu cho các sà lan mới (trong màn hình Quản lý hồ sơ phương tiện `BargeProfileManager.vue` hoặc khi tạo sà lan mới ở các chuyến tàu hàng), người dùng phải nhập lại thủ công rất nhiều thông tin kỹ thuật, giấy tờ đăng kiểm, bảo hiểm, thuyền viên và upload lại ảnh dù sà lan đó đã từng vào cảng trước đó.

## Yêu cầu triển khai chi tiết
1. **Giao diện người dùng (`BargeProfileManager.vue`):**
   - Trong form chỉnh sửa hồ sơ sà lan (`activeBargeId !== null`), bố trí một nút bấm **"Truy xuất hồ sơ cũ"** (hoặc icon `history` / `sync`) đặt ngay cạnh ô nhập **Tên sà lan**.
   - Style nút bấm đồng bộ theo design system của ứng dụng (nút nhỏ gọn, trực quan, có tooltip hướng dẫn).

2. **Cơ chế truy xuất & lọc dữ liệu:**
   - Lấy tên sà lan hiện tại đang nhập (`editBargeName`), loại bỏ khoảng trắng và chuyển chữ hoa để so khớp chính xác.
   - Tìm kiếm trong toàn bộ các sà lan đã lưu trong hệ thống (`vessels -> barges`), loại trừ bản ghi sà lan hiện tại đang mở (`item.barge.id !== activeBargeId.value`).
   - Lọc tất cả các bản ghi có tên trùng khớp:
     - **Nếu không tìm thấy bản ghi nào:** Báo Toast thông báo: *"Không tìm thấy dữ liệu cũ của sà lan [Tên sà lan]"*.
     - **Nếu tìm thấy:** Chọn bản ghi sà lan **mới nhất** (dựa vào `updatedAt`, `created_at`, hoặc chuyến tàu gần nhất).

3. **Xác nhận người dùng:**
   - Hiển thị hộp thoại xác nhận (modal confirm hoặc `window.confirm` / `BaseConfirmModal`):
     *"Tìm thấy hồ sơ sà lan [Tên sà lan] từ tàu [Tên tàu] (ngày ...). Bạn có muốn đồng bộ dữ liệu sang sà lan này không?"*

4. **Nạp dữ liệu vào form hiện tại:**
   - **Các trường được đồng bộ:**
     - Thông số kỹ thuật: `tonnage`, `hp`
     - Giấy chứng nhận (GCN): `gcnNo`, `gcnIssuedDate`, `gcnExpiryDate`, danh sách ảnh `gcnImages`
     - Đăng kiểm (ĐK): `dkNo`, `dkIssuedDate`, `dkExpiryDate`, danh sách ảnh `dkImages`
     - Bảo hiểm (BH): `bhNo`, `bhIssuedDate`, `bhExpiryDate`, danh sách ảnh `bhImages`
     - Thuyền viên: `captain`, `captainGrade`, `captainCccd`, `chiefEngineer`, `chiefEngineerGrade`, `chiefEngineerCccd`, `sailors`, `sailorsCccd`, `hasCrewBook`, danh sách ảnh `crewImages`
     - Thông tin mở rộng: `customMetas` (`customProfileInfo`)
   - **Các trường GIỮ NGUYÊN theo chuyến mới (không ghi đè):**
     - Số lệnh (`orderNo`)
     - Mặt hàng (`goods`, `goodsCode`)
     - Thời gian cập / rời cảng (`arrivalDate`, `arrivalTimeStr`, `departureDate`, `departureTimeStr`)
     - Cảng cuối (`lastPort`)
     - Khai hệ thống (`khaihethong`)
     - Tàu mẹ / khu vực gắn liền với sà lan hiện tại
   - Sau khi nạp, kích hoạt lại các computed check tính hợp lệ của hồ sơ (`isGcnCardValid`, `isDkCardValid`, `isBhCardValid`, `isCrewCardValid`, `editKetluan`).
   - Báo Toast thành công: *"Đã nạp dữ liệu hồ sơ cũ của sà lan [Tên sà lan] thành công!"*.
