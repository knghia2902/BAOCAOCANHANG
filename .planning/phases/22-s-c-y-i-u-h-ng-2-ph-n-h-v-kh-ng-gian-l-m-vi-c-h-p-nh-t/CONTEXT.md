# Phase 22 Context: Sơ đồ cây điều hướng 2 phân hệ và Không gian làm việc hợp nhất

## Bối cảnh & Yêu cầu từ Người dùng

Người dùng phản ánh các công cụ trên web hiện tại đang được sắp xếp không logic theo thứ tự thực hiện khi import dữ liệu lên phần mềm, và việc phải chuyển trang/đóng mở công cụ nhiều lần gây mất thời gian, gián đoạn mạch làm việc.

Đã thống nhất thiết kế không gian làm việc hợp nhất với Sơ đồ cây bên trái (Collapsible Tree Sidebar) được chia làm 2 nhánh rõ ràng:

### 1. PHÂN HỆ (Nghiệp vụ vận hành theo luồng)
1. **Tạo nguồn tàu (không chứa dữ liệu cân)**:
   - Chỉ dùng để khai báo tàu mẹ cập cảng, các hầm hàng, dự kiến chia cho những sà lan tiếp nhận nào.
   - Giao diện siêu gọn, không chứa dữ liệu cân xe để tránh gây chậm và rối mắt.
2. **Dữ liệu cân (Nơi tiếp nhận 2 file cân nguồn)**:
   - File 1: Cân xe chở xá thẳng xuống sà lan (Direct to Barge).
   - File 2: Cân xe nhập kho (Warehouse receipt / Direct to Warehouse).
   - Hệ thống tiếp nhận, phân loại và sẵn sàng liên thông sang các phân hệ Báo cáo và Biên bản.
3. **Báo cáo**:
   - *Báo cáo tồn kho*: Tồn kho 4 kho, hàng sáng, xuất ảnh Zalo (lấy từ dữ liệu cân nhập kho).
   - *Báo cáo lô hàng*: Báo cáo tổng quan tiến độ làm hàng tàu mẹ & sà lan, bảng kê (lấy từ dữ liệu xá thẳng).
   - *Báo cáo Phân bổ De Heus*: Quản lý định mức xe, tự động tách chuyến vượt tải, điều tiết thời gian ra/vào.
4. **Quản lý hồ sơ phương tiện**:
   - Hồ sơ sà lan, đăng kiểm, bảo hiểm, thuyền trưởng/thuyền viên.
5. **Biên bản**:
   - Bộ 4 biên bản làm hàng sà lan (tự động lấy số liệu sà lan đã hoàn tất để kết xuất).

### 2. DANH MỤC (Dữ liệu nền tảng dùng chung - Master Data)
- **Danh sách xe**: Biển số xe, tải trọng bản thân, tải cho phép, tài xế.
- **Danh sách khách hàng**: Chủ hàng (Eastwood, GBD, De Heus, v.v.).
- **Danh sách kho hàng**: Cấu hình các kho (Kho 1, Kho 2, Kho 3, Kho 4, định mức & sơ đồ).
- **Danh mục hàng hóa**: Quy chuẩn mã hàng, tên hàng.

### 3. Yêu cầu Trải nghiệm (UX/UI)
- **Sidebar có nút thu gọn (Collapsible)**: Thu gọn thành icon bar hoặc trượt ẩn để dành 100% không gian hiển thị cho các bảng dữ liệu nhiều cột.
- **Bảo toàn trạng thái làm việc (`KeepAlive`)**: Khi người dùng chuyển đổi qua lại giữa các phân hệ và danh mục trên cây, màn hình làm việc được bảo toàn tuyệt đối, không load lại hay mất dữ liệu đang làm dở.
- **Phạm vi triển khai**: Thực hiện trực tiếp trên web local, **tuyệt đối không chạy git push lên GitHub**.
