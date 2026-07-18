# Tiện ích Thước Đo Thiết Kế (Layout Ruler Extension)

Tiện ích mở rộng Google Chrome (Chrome Extension) giúp lập trình viên và người dùng soi thông tin kích thước, margin, padding, bật khung viền và hiển thị lưới 12 cột cho bất kỳ trang web nào.

## Hướng dẫn cài đặt vào Google Chrome

1. Mở trình duyệt Google Chrome (hoặc bất kỳ trình duyệt Chromium nào như Brave, Microsoft Edge, Cốc Cốc).
2. Truy cập vào trang quản lý Tiện ích mở rộng bằng cách gõ địa chỉ: `chrome://extensions/`
3. Bật **Chế độ dành cho nhà phát triển** (Developer mode) ở góc trên cùng bên phải.
4. Nhấn nút **Tải tiện ích đã giải nén** (Load unpacked) ở góc trên cùng bên trái.
5. Chọn thư mục `layout-ruler-extension` nằm trong thư mục dự án của bạn (`d:\Tools\TVPL\BAOCAOCANHANG\layout-ruler-extension`).
6. Tiện ích sẽ xuất hiện trên thanh công cụ của trình duyệt. Bạn có thể ghim (pin) nó để sử dụng nhanh.

## Hướng dẫn sử dụng

- Nhấp chuột trực tiếp vào biểu tượng Tiện ích mở rộng trên thanh công cụ trình duyệt để **Bật/Tắt** bảng điều khiển thước đo.
- **Soi chi tiết (Hover)**: Di chuột vào bất kỳ phần tử nào trên trang web để xem thẻ HTML, các class Tailwind/CSS, kích thước px, padding, margin và font-size. Nhấn phím `ESC` để dừng soi.
- **Hiện khung viền**: Làm nổi bật tất cả các phần tử trên trang bằng đường viền đứt nét để dễ căn chỉnh.
- **Hiện lưới 12 cột**: Hiển thị lưới grid 12 cột chuẩn thiết kế (max-width 1200px) đè lên giao diện để đối chiếu tỷ lệ.
