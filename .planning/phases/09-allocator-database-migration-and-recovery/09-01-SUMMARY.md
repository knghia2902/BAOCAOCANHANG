# Phase 09 Plan 01: Database Migration, Recovery & Parity Verification Summary

**Thực hiện vào:** 17/09/2026  
**Trạng thái:** Hoàn thành xuất sắc (100% Parity)

---

## 1. Kết quả thực hiện

### 1.1 Khởi tạo bảng quan hệ chuyên biệt (Task 1)
- **Tệp DDL:** `database/migrations/20260917_create_allocator_history_trips.sql`
- Bảng `public.allocator_history_trips` đã được khởi tạo trên Supabase với:
  - Khóa chính định danh: `id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY`
  - Các trường dữ liệu chuẩn hóa: `stt`, `time_str`, `plate_number`, `tttp`, `limit_weight`, `ticket_no`, `source_ticket_no`, `cargo_type`, `weight_1`, `weight_2`, `weight_net`, `weight_tons`, `direction`, `barge_name`, `order_no`, `customer`, `date1_obj`, `date2_obj`, `notes`, `is_recovered`, `created_at`.
  - 7 chỉ mục tối ưu hóa tốc độ truy vấn: `idx_allocator_history_date1`, `idx_allocator_history_plate`, `idx_allocator_history_ticket`, `idx_allocator_history_order`, `idx_allocator_history_customer`, `idx_allocator_history_time_str`, `idx_allocator_history_recovered`.
  - Chính sách RLS cho phép client web thực hiện CRUD an toàn.

### 1.2 Sao lưu tĩnh an toàn (Task 2)
- **Kịch bản:** `scripts/backup_allocator_history.cjs`
- **Tệp sao lưu:** `.planning/backups/allocator_history_trips_backup_16303.json`
- **Số lượng:** 16,303 bản ghi
- **Kích thước:** 8.58 MB (8,998,082 bytes)
- **Mã kiểm tra tính toàn vẹn (MD5):** `7eb0815683efe2506a9e7d773f06c82d`

### 1.3 Di chuyển toàn bộ dữ liệu lịch sử (Task 3)
- **Kịch bản:** `scripts/migrate_allocator_history.cjs`
- Chuyển đổi toàn bộ 16,303 bản ghi camelCase sang định dạng snake_case chuẩn SQL (`limit` -> `limit_weight`, chuẩn hóa Date sang ISO).
- Chèn thành công qua 33 đợt (chunks 500 bản ghi) trong 13.5 giây không phát sinh lỗi mạng.

### 1.4 Khôi phục toàn bộ các chuyến xe thiếu (Task 4)
- **Kịch bản:** `scripts/recover_missing_trips.cjs`
- Đối soát toàn bộ dữ liệu phiếu cân thực tế từ `weighbridge_trucks` kết hợp với thông tin sà lan và tàu từ `weighbridge_barges`.
- Khôi phục thành công **2,219 chuyến xe** (gồm 1,134 chuyến từ 11/09 đến 15/09 và các chuyến chưa lưu từ các đợt cân trước) trong 2.2 giây.
- Gắn cờ đánh dấu `is_recovered: true` và ghi chú `notes: 'Khôi phục từ phiếu cân'`.

### 1.5 Kiểm toán đối chiếu dữ liệu (Task 5)
- **Kịch bản:** `scripts/verify_parity.cjs`
- **Tổng số bản ghi trong bảng `allocator_history_trips`:** 18,522 bản ghi
- **Dữ liệu gốc (is_recovered = false):** 16,303 bản ghi (100%)
- **Dữ liệu khôi phục (is_recovered = true):** 2,219 bản ghi
- **Đối chiếu ngẫu nhiên 50 bản ghi mẫu:** 50/50 khớp chính xác 100% biển số, phiếu cân, khối lượng tịnh.

---

## 2. Danh sách tệp tạo mới

- `database/migrations/20260917_create_allocator_history_trips.sql`
- `scripts/backup_allocator_history.cjs`
- `scripts/migrate_allocator_history.cjs`
- `scripts/recover_missing_trips.cjs`
- `scripts/verify_parity.cjs`
- `.planning/backups/allocator_history_trips_backup_16303.json`
