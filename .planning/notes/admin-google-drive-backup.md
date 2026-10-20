---
title: "Admin Google Drive Auto-Backup & Restore Architecture"
date: "2026-10-20"
context: "Exploration session for full-system backup & restore inside /admin with Google Drive integration"
---

# Admin Google Drive Auto-Backup & Restore Architecture

## 1. Mục tiêu
Xây dựng phân hệ **Sao lưu & Khôi phục (Backup & Restore)** trực tiếp trong trang quản trị `/admin` (`AdminView.vue`), cho phép sao lưu toàn bộ cơ sở dữ liệu Supabase và toàn bộ hình ảnh/tài liệu trên Supabase Storage thành gói nén `.zip`, đẩy tự động lên **Google Drive** theo khung giờ cài đặt, tự động xóa bản cũ theo giới hạn số bản lưu (`maxBackups`), và hỗ trợ khôi phục (Restore) trực tiếp từ Google Drive hoặc từ file `.zip` tải lên.

## 2. Cấu trúc gói nén Backup (`.zip`)
Sử dụng thư viện `jszip` (client-side) hoặc đóng gói payload chuẩn:
- `manifest.json`: Chứa metadata của bản sao lưu (version, timestamp, createdBy, tableCounts, storageFileCount, totalSize).
- `database/`:
  - `content.json`
  - `users.json`
  - `activity_logs.json`
  - `vehicle_profiles.json`
  - `weighbridge_vessels.json`
  - `weighbridge_barges.json`
  - `weighbridge_trucks.json`
  - `weighbridge_vehicles.json`
  - `weighbridge_tracking.json`
  - `allocator_history_trips.json`
  - `weighbridge_other_tickets.json`
- `storage/`:
  - Toàn bộ file nhị phân (hình ảnh dự án, avatar, giấy tờ sà lan GCN/ĐK/BH, biên bản...) trong bucket `portfolio-assets` giữ nguyên đường dẫn tương đối (`hero/...`, `projects/...`, `barges/...`) kèm `storage_manifest.json` lưu content-type.

## 3. Cơ chế kết nối Google Drive qua Google Apps Script (GAS Bridge)
- **Tại sao chọn GAS Web App Bridge:**
  - Không cần cấu hình OAuth2 Client ID phức tạp trên Google Cloud Console.
  - Không bị hết hạn Access Token sau 1 giờ như OAuth2 phía trình duyệt.
  - Có thể sử dụng Time-driven Trigger của Google Apps Script hoặc bộ kiểm tra lịch trình tự động khi mở ứng dụng để thực thi sao lưu định kỳ đúng giờ cài đặt và xoay vòng (retention cleanup) trực tiếp trên Google Drive Folder.
- **Giao thức API (POST tới GAS Web App URL):**
  - `action: "upload"`: Nhận tên file `.zip`, base64 data, `folderId`, và `maxBackups`. Lưu file mới vào thư mục Google Drive và tự động xóa các file backup cũ nhất nếu tổng số file vượt quá `maxBackups`.
  - `action: "list"`: Trả về danh sách các bản backup hiện có trong `folderId` (id, name, createdTime, size, downloadUrl).
  - `action: "download"`: Trả về nội dung base64 của file `.zip` theo `fileId` để trình duyệt giải nén và Restore.
  - `action: "delete"`: Xóa một bản backup cụ thể trên Google Drive.
- **Trải nghiệm trong `/admin`:**
  - Có nút **"Xem mã Google Apps Script & Hướng dẫn"** ngay trong `/admin` để Admin chỉ cần copy-paste vào `script.google.com`, bấm Deploy và dán URL + Folder ID vào cài đặt.

## 4. Cơ chế Tự động sao lưu theo giờ & Giới hạn số bản
- Cấu hình lưu trong `content.settings.backupConfig`:
  - `enabled`: Bật/tắt tự động sao lưu.
  - `scheduleTime`: Giờ sao lưu hằng ngày (VD: `"23:00"`).
  - `maxBackups`: Số lượng bản sao lưu tối đa giữ lại (VD: `7`, `10`, `30`).
  - `gasWebhookUrl`: URL Web App của Google Apps Script.
  - `driveFolderId`: ID thư mục Google Drive đích.
  - `lastBackupAt`: Thời điểm sao lưu thành công gần nhất.
- **Kích hoạt tự động:**
  - Bộ lập lịch (Scheduler) chạy ngầm kiểm tra mỗi phút khi ứng dụng/admin đang mở (nếu đã tới `scheduleTime` trong ngày mà `lastBackupAt` chưa chạy trong ngày hôm đó thì tự động thực thi backup ngầm lên Google Drive).
  - Hỗ trợ thêm chế độ GAS Time-Driven Trigger đọc trực tiếp từ Supabase REST API để backup ngay cả khi không ai mở trình duyệt.

## 5. Cơ chế Khôi phục (Restore)
- **Nguồn khôi phục:**
  1. Chọn 1 bản backup từ danh sách lịch sử Google Drive ngay trong `/admin` và bấm **"Khôi phục"**.
  2. Hoặc bấm **"Import file (.zip)"** từ máy tính.
- **Quy trình khôi phục an toàn:**
  1. Hiển thị Modal xác nhận (`BaseConfirmModal`) cảnh báo rõ số lượng bản ghi và ảnh sẽ được khôi phục từ `manifest.json`.
  2. Upsert dữ liệu theo từng batch vào các bảng Supabase (đảm bảo thứ tự khóa ngoại: `weighbridge_vessels` -> `weighbridge_barges` -> `weighbridge_trucks` / `allocator_history_trips`...).
  3. Upload phục hồi các file hình ảnh/tài liệu thiếu lên bucket `portfolio-assets`.
  4. Ghi log vào `LogService` và làm mới toàn bộ Store.
