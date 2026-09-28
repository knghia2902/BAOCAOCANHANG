# Phase 14: Lọc sà lan theo kỳ tính phí cầu bến & Xuất Excel - Context

**Gathered:** 2026-09-28  
**Status:** Executed & Verified

---

## 1. Bối cảnh & Mục tiêu

- **Mục tiêu:** Phục vụ công tác chốt kỳ kế toán và tính phí cầu bến cảng cho các sà lan làm hàng, đồng thời xuất file báo cáo Excel chứa đầy đủ thông tin kỹ thuật (đặc biệt là Trọng tải sà lan).
- **Vấn đề trước đây:** Bộ lọc thời gian chỉ cho phép lọc theo từng tháng riêng lẻ (`availableGlobalMonths`), không đáp ứng được chu kỳ kế toán cảng (chu kỳ chốt từ 26 tháng trước đến 25 tháng này). Đồng thời file Excel xuất ra còn thiếu cột Trọng tải sà lan để tính phí theo tải trọng.
- **Giải pháp:**
  - Nâng cấp bộ lọc thời gian thành bộ chọn linh hoạt: tự động nhận diện các kỳ tính phí chuẩn (26 - 25) và hỗ trợ chế độ tùy chọn khoảng ngày tự do (`custom`).
  - Tiêu chuẩn tính sà lan thuộc kỳ: Dựa trên **Thời gian kết thúc làm hàng (`dateEnd`)** của sà lan. Sà lan chưa kết thúc (đang làm dở) hoặc kết thúc ngoài kỳ sẽ loại khỏi kỳ này và tự động dồn sang kỳ sau khi hoàn thành.
  - Bổ sung cột "Trọng tải (tấn)" vào file Excel xuất ra.
  - Giữ nguyên cấu trúc các cột trên giao diện bảng danh sách sà lan tổng quan (không làm chật bảng).

---

## 2. Các quyết định kỹ thuật đã thống nhất

1. **Chu kỳ chốt phí:** Từ `26/(M-1)` đến `25/M` (ví dụ: `Kỳ 07/2026 (26/06 - 25/07)`).
2. **Quy tắc sà lan vắt kỳ:** Cứ sà lan nào có `dateEnd` hoàn thành rơi vào kỳ nào thì được chốt tính phí trọn gói ở kỳ đó.
3. **Bộ chọn giao diện:** Dropdown chọn nhanh theo kỳ + 2 ô input Date (`Từ ngày` - `Đến ngày`) trượt ra mượt mà khi chọn "Tùy chọn khoảng ngày...".
4. **Cột Trọng tải:** Lấy từ `b.tonnage ?? b.config?.tonnage ?? null`, thêm vào vị trí cột thứ 5 trong file Excel (`exportAllBargesToExcel`), format `#,##0`.
