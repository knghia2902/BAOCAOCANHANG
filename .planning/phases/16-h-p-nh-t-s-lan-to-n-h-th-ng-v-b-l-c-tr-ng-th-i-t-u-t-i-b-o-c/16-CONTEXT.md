# Phase 16: Hợp nhất sà lan toàn hệ thống và bộ lọc trạng thái tàu tại Báo cáo tổng quan - Context

**Gathered:** 2026-10-16  
**Status:** Planned

---

## 1. Bối cảnh & Vấn đề

- **Vấn đề thực tế:** 
  - Tại thanh Sidebar bên trái, các tàu được phân làm 2 Tab: `Đang làm` (tàu đang làm hàng) và `Đã xong` (tàu đã chốt hoàn thành).
  - Bảng **"Danh sách quản lý tất cả sà lan"** ở trang Báo cáo tổng quan trước đây lại bị ràng buộc trực tiếp theo Tab của Sidebar (`selectedVesselStatusTab`).
  - Khi cần tính phí cầu bến theo kỳ (chu kỳ 26 tháng trước - 25 tháng này), những sà lan đã hoàn thành nhưng thuộc tàu mẹ chưa xong (vẫn ở tab "Đang làm") bị tách biệt với các sà lan của tàu đã chốt ("Đã xong"). Người dùng không thể lọc hoặc xuất Excel trọn vẹn số liệu tính phí trong một file duy nhất mà phải chuyển qua lại giữa 2 tab.

---

## 2. Giải pháp đã thống nhất

1. **Hợp nhất sà lan toàn hệ thống tại Báo cáo tổng quan:**
   - `allBarges` gom **100% sà lan của toàn bộ các tàu** (cả tàu đang làm hàng và tàu đã xong), hoàn toàn không bị chia cắt theo tab của Sidebar.
   - Thẻ thống kê KPI `Tổng số sà lan` hiển thị toàn bộ sà lan thực tế của hệ thống.

2. **Bổ sung bộ lọc Trạng thái tàu độc lập:**
   - Trên thanh công cụ lọc của bảng, bổ sung dropdown:
     `Trạng thái tàu: [ Tất cả tàu (mặc định) | Tàu đang làm hàng | Tàu đã xong ]`.
   - Bộ lọc này hoạt động hoàn toàn độc lập với bộ lọc Kỳ tính phí và ô Tìm kiếm. Người dùng có thể:
     - Chỉ lọc Trạng thái tàu (mà không cần chọn kỳ tính phí).
     - Chỉ lọc Kỳ tính phí (mà không cần chọn trạng thái tàu - gom đủ 100% sà lan hoàn thành trong kỳ).
     - Kết hợp cả hai khi cần phân tích chuyên sâu.

3. **Giao diện bảng & File Excel:**
   - Giữ nguyên cấu trúc các cột hiển thị trên bảng và file Excel (theo Phương án 2 người dùng đã chọn), không thêm badge hay cột trạng thái tàu rườm rà.

4. **Sidebar:**
   - Giữ nguyên 2 tab "Đang làm" và "Đã xong" để phục vụ điều độ quản lý danh sách tàu gọn gàng.
