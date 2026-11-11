---
title: Quy trình chuẩn nhập và kiểm tra số liệu dành cho nhân viên
date: 2026-11-11
context: Chuẩn hóa quy trình vận hành từ lúc tiếp nhận lệnh làm hàng, nạp dữ liệu cân, kiểm tra đối soát đến xuất báo cáo và gửi Zalo.
---

# Quy trình chuẩn: Nhập và kiểm tra số liệu tại Cảng

Quy trình áp dụng cho nhân viên điều hành, nhân viên trạm cân và nhân viên theo dõi số liệu tại hệ thống Quản lý Báo cáo Cân hàng.

---

## 1. Giai đoạn 1: Khởi tạo Lệnh (Tạo Nguồn Tàu - Vessel Source)
- **Vị trí thao tác:** Không gian làm việc hợp nhất (*Workspace*) > Phân hệ **Tạo Nguồn Tàu 🚢** (`vessel-source`).
- **Mục tiêu:** Khai báo đầy đủ pháp nhân và kế hoạch nhận hàng trước khi các lượt xe cân bắt đầu chạy.
- **Các bước thực hiện:**
  1. Nhấn nút **"+ Thêm nguồn tàu mới"**.
  2. Khai báo thông tin Tàu mẹ:
     - Tên tàu mẹ (ví dụ: MV GLORY, TÀU ĐÔNG PHÚ,...).
     - Khách hàng / Chủ hàng (chọn từ danh mục hoặc nhập mới, ví dụ: De Heus, CJ, Japfa,...).
     - Loại hàng hóa (chọn từ danh mục, ví dụ: Ngô hạt, Bã nành, Lúa mì,...).
     - Mã loại hàng (nếu có).
  3. Khai báo danh sách Sà lan tiếp nhận theo tàu:
     - Nhập tên từng Sà lan (ví dụ: SG-8899, VL-1234,...).
     - Nhập **Mã lệnh / Mã Order** tương ứng cho từng sà lan.
  4. Bấm **Lưu nguồn tàu** để hệ thống đồng bộ lên đám mây.

---

## 2. Giai đoạn 2: Nạp dữ liệu cân xe (Dữ liệu cân - Weighbridge Data)
- **Vị trí thao tác:** Không gian làm việc hợp nhất (*Workspace*) > Phân hệ **Dữ liệu cân ⚖️** (`scale-data`).
- **Mục tiêu:** Nạp toàn bộ dữ liệu xe cân theo ca làm việc từ phần mềm đầu cân vào hệ thống.
- **Các bước thực hiện:**
  1. Chọn đúng nguồn tàu đang làm hàng đã khai báo ở Bước 1.
  2. Nạp dữ liệu qua tính năng Import file Excel:
     - **File 1:** Dành cho xe Nhập kho & Nhập thẳng.
     - **File 2:** Dành cho xe Xuất kho & Xuất thẳng xuống sà lan.
  3. Kiểm tra thông báo kết quả nạp của hệ thống (số lượng dòng nạp thành công, các dòng được nhận diện tự động theo mẫu biểu).

---

## 3. Giai đoạn 3: Kiểm tra & Đối soát số liệu
- **Vị trí thao tác:** 
  - Phân hệ **Báo cáo tồn kho 🏭** (`report-inventory`).
  - Phân hệ **Báo cáo lô hàng / Báo cáo cân 🚢** (`report-shipment`).
- **Mục tiêu:** Đảm bảo 100% dữ liệu chính xác tuyệt đối, không có sai lệch khối lượng hay thất thoát.
- **Tiêu chí kiểm tra bắt buộc:**
  1. **Kiểm tra độ lệch khối lượng (Net / Tổng):**
     - Công thức chuẩn: $\text{KL Tịnh (Net)} = \text{KL Tổng (Gross)} - \text{KL Bì (Tare)}$.
     - Soát xét từng xe xem có trường hợp xe thiếu lần cân (chưa cân bì hoặc chưa cân tổng), dẫn đến khối lượng net bất thường (bằng 0 hoặc âm).
  2. **Kiểm tra phân luồng & kho tiếp nhận:**
     - So khớp xe nhập kho có đúng Kho 1, Kho 2, Kho 3, Kho 4 hay không.
     - Đối chiếu tồn đầu kỳ + nhập trong ca - xuất trong ca = tồn cuối kỳ.
  3. **Kiểm tra sà lan tiếp nhận:**
     - Xe xuất thẳng sà lan phải gắn đúng tên sà lan và mã lệnh đã tạo ở Bước 1.
- **Quy tắc an toàn & Xử lý sai sót:**
  - **NGHIÊM CẤM:** Nhân viên không tự ý sửa đổi tùy tiện làm lệch dữ liệu gốc.
  - **BẮT BUỘC:** Khi phát hiện sai lệch khối lượng, thiếu chuyến hoặc nhầm lẫn thông tin, nhân viên phải **báo cáo ngay cho Quản trị viên (Admin)** để Admin kiểm tra và thực hiện điều chỉnh chuẩn xác trên hệ thống.

---

## 4. Giai đoạn 4: Kết thúc quy trình & Báo cáo
- **Vị trí thao tác:** Phân hệ **Báo cáo tồn kho** và **Báo cáo lô hàng**.
- **Mục tiêu:** Xuất bản và truyền thông dữ liệu đã được đối soát 100% chuẩn xác.
- **Các bước thực hiện:**
  1. **Xuất file Excel báo cáo:**
     - Nhấn nút **Xuất Excel** tại Báo cáo tồn kho / Báo cáo lô hàng để lưu trữ tệp số liệu chính thức phục vụ đối soát và thanh quyết toán.
  2. **Gửi báo cáo hình ảnh Zalo:**
     - Sử dụng tính năng tạo / chụp ảnh báo cáo tồn kho tự động trên giao diện web.
     - Tải ảnh về hoặc sao chép và gửi trực tiếp lên nhóm Zalo điều hành của Cảng theo quy định của từng ca.
