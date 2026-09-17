# Phase 09: Allocator Database Migration & Data Recovery - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-09-17
**Phase:** 09-allocator-database-migration-and-recovery
**Areas discussed:** Data Loading Strategy, Recovery Verification & Execution, Save/Append Mechanism, Backup & Safe Cleanup

---

## 1. Chiến lược tải dữ liệu Tab 3 (Theo dõi)

| Option | Description | Selected |
|--------|-------------|----------|
| Mặc định tải 30 ngày gần nhất | Mặc định tải 30 ngày gần nhất (nhanh, mượt, <0.5s), có nút 'Tải toàn bộ lịch sử' khi cần tra cứu cũ | ✓ |
| Tải toàn bộ vào RAM Client | Tải toàn bộ 18,000 dòng vào bộ nhớ máy (RAM) khi mở Tab 3 để tìm kiếm & lọc ngày tức thì | |
| Server-side pagination hoàn toàn | Phân trang Server-side hoàn toàn (mỗi lần đổi trang hoặc lọc ngày sẽ gửi lệnh truy vấn lên Supabase) | |

**User's choice:** Mặc định tải 30 ngày gần nhất (nhanh, mượt), có nút 'Tải toàn bộ lịch sử' khi cần tra cứu cũ
**Notes:** Nếu người dùng lọc ngày nằm ngoài khoảng 30 ngày đã tải, client tự động truy vấn thêm ngày đó từ Supabase.

---

## 2. Quy trình khôi phục 1,657 chuyến xe (11/09 - 15/09)

| Option | Description | Selected |
|--------|-------------|----------|
| Script xuất báo cáo Preview trước | Chạy script xuất báo cáo Preview (tổng chuyến, tấn, ngày), sau khi xác nhận mới chèn vào DB và gắn cờ ghi chú | ✓ |
| Giao diện Web Preview | Tích hợp nút/banner 'Xem trước & Khôi phục 1,657 chuyến' trực tiếp trên giao diện web CargoAllocator | |
| Tự động insert trực tiếp | Tự động insert trực tiếp vào database luôn không cần xem trước | |

**User's choice:** Chạy script xuất báo cáo Preview (tổng chuyến, tấn, ngày), sau khi xác nhận mới chèn vào DB và gắn cờ ghi chú
**Notes:** Báo cáo preview phải phân tích rõ theo từng ngày, so khớp với phiếu cân và sà lan, và các chuyến thêm mới phải có `is_recovered: true`.

---

## 3. Cơ chế lưu chuyến xe mới từ Tab 2 sang Tab 3

| Option | Description | Selected |
|--------|-------------|----------|
| Bulk Insert có kiểm tra chống trùng | Bulk Insert chuyến mới kèm kiểm tra chống trùng (nhanh, nhẹ, không ảnh hưởng các ngày khác) | ✓ |
| Upsert theo ticketNo | Upsert (thêm mới hoặc cập nhật lại nếu trùng số phiếu ticketNo) | |
| Hộp thoại xác nhận ghi đè | Hộp thoại xác nhận: Cho phép người dùng chọn 'Chỉ thêm chuyến mới' hoặc 'Ghi đè ngày hiện tại' | |

**User's choice:** Bulk Insert chuyến mới kèm kiểm tra chống trùng (nhanh, nhẹ, không ảnh hưởng các ngày khác)
**Notes:** Tuyệt đối không serialize lại toàn bộ mảng lịch sử khi lưu từ Tab 2; lưu độc lập các chuyến mới sinh.

---

## 4. Kế hoạch sao lưu dự phòng và dọn dẹp content.settings

| Option | Description | Selected |
|--------|-------------|----------|
| Sao lưu file JSON tĩnh + kiểm tra 100% | Sao lưu ra file JSON tĩnh + kiểm tra bảng mới hoạt động chuẩn 100% rồi mới dọn sạch key trong content.settings | ✓ |
| Bảng backup riêng trên Supabase | Lưu blob cũ sang một bảng backup riêng trong Supabase (allocator_history_trips_backup) để có thể rollback tức thì | |
| Giữ song song 1-2 tuần | Giữ song song trong 1-2 tuần kiểm chứng rồi mới dọn dẹp | |

**User's choice:** Sao lưu ra file JSON tĩnh + kiểm tra bảng mới hoạt động chuẩn 100% rồi mới dọn sạch key trong content.settings
**Notes:** Xuất file tĩnh vào `.planning/backups/allocator_history_trips_backup_16303.json`. Xóa key cũ trong settings sau khi web chạy ổn định.

---

## the agent's Discretion

- Thiết kế chi tiết tên cột bảng PostgreSQL (`allocator_history_trips`).
- Cấu trúc kiến trúc `AllocatorService.ts` để bọc các thao tác gọi Supabase.

## Deferred Ideas

- Không có ý tưởng nào bị hoãn ngoài phạm vi.
