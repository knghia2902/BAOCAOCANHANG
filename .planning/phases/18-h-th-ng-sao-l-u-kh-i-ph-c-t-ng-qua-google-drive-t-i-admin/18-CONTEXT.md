# Phase 18 Context: Hệ thống Sao lưu & Khôi phục Tự động qua Google Drive tại `/admin`

**Defined:** 2026-10-21
**Source:** `/gsd-explore` session & `.planning/notes/admin-google-drive-backup.md`

## <domain>
Phân hệ **Sao lưu & Khôi phục (Backup & Restore)** tích hợp trực tiếp trong trang Quản trị `/admin` (`src/views/AdminView.vue`), đóng gói toàn bộ dữ liệu hệ thống (Database + Hình ảnh/Tài liệu đính kèm) thành file nén `.zip`, đẩy tự động lên **Google Drive** theo giờ được cài đặt và giới hạn số bản lưu tối đa (`maxBackups`), đồng thời hỗ trợ khôi phục (Restore) trực tiếp từ Google Drive hoặc từ file `.zip` import từ máy tính.
</domain>

## <decisions>
1. **Phạm vi sao lưu toàn diện (BACKUP-01):**
   - Toàn bộ các bảng dữ liệu trên Supabase: `content`, `projects`, `tools`, `messages`, `users`, `activity_logs`, `vehicle_profiles`, `weighbridge_vehicles`, `weighbridge_vessels`, `weighbridge_barges`, `weighbridge_trucks`, `weighbridge_tracking`, `weighbridge_allocation_tracking`, `allocator_history_trips`, `weighbridge_warehouse_tickets`, `weighbridge_container_tickets`.
   - Toàn bộ hình ảnh và tài liệu liên quan trên Supabase Storage (bucket `portfolio-assets`, quét đệ quy các thư mục `hero`, `projects`, `general`, `barges`, v.v.).
   - Đóng gói nén thành 1 file `.zip` duy nhất (`backup_YYYYMMDD_HHMMSS.zip`) dùng `jszip` gồm `manifest.json`, `database/*.json`, và `storage/*`.

2. **Kết nối Google Drive qua Google Apps Script Bridge (BACKUP-02):**
   - Sử dụng **Google Apps Script (GAS) Web App Bridge** làm cầu nối tới Google Drive của Admin (miễn phí 100%, không bị hết hạn OAuth token 1 giờ, hỗ trợ tự động chạy ngầm).
   - Cung cấp sẵn mã nguồn Google Apps Script mẫu ngay trên giao diện `/admin` (có nút Copy 1 chạm & hướng dẫn ngắn gọn) để Admin dán vào `script.google.com` và lấy `Webhook URL` + `Folder ID`.
   - Hỗ trợ cấu hình **Giờ tự động sao lưu hằng ngày** (`scheduleTime`, ví dụ `23:00`) và **Số bản sao lưu tối đa** (`maxBackups`, ví dụ `7` bản — tự động xóa bản cũ nhất trên Google Drive khi vượt quá).
   - Bộ lập lịch (Scheduler) hoạt động kép:
     - Phía trình duyệt (`BackupService.startAutoBackupScheduler()`): Tự động kiểm tra mỗi 60 giây và khi mở ứng dụng; nếu đã qua `scheduleTime` của ngày hôm nay mà chưa có bản backup trong ngày thì tự động nén `.zip` và đẩy lên Google Drive.
     - Phía Google Apps Script: Kèm hàm tự động kích hoạt theo giờ (Time-driven trigger) trên Google Cloud để đảm bảo sao lưu ngay cả khi không mở trình duyệt.

3. **Khôi phục dữ liệu từ Google Drive hoặc File Import (BACKUP-03):**
   - Hiển thị danh sách các bản backup hiện có trong thư mục Google Drive ngay tại `/admin` (Tên file, Thời gian tạo, Dung lượng, Nút Tải về, Nút **Restore / Khôi phục**, Nút Xóa).
   - Có nút **Import file Backup (`.zip`)** từ máy tính để khôi phục bất kỳ lúc nào.
   - Khi bấm Restore (từ Drive hoặc từ file Import), hiển thị hộp thoại xác nhận an toàn với thông tin chi tiết bản backup (`manifest.json`), sau đó khôi phục tuần tự các bảng Database (theo đúng thứ tự khóa ngoại) và upload phục hồi các file hình ảnh/tài liệu lên Supabase Storage.
</decisions>

## <canonical_refs>
- `.planning/notes/admin-google-drive-backup.md`
- `.planning/ROADMAP.md` (Phase 18)
- `.planning/REQUIREMENTS.md` (`BACKUP-01`, `BACKUP-02`, `BACKUP-03`)
- `src/views/AdminView.vue`
- `src/services/storage/StorageService.ts`
- `src/services/ContentService.ts`
</canonical_refs>
