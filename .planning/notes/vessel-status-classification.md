---
title: Phân loại tàu Đang làm hàng và Đã xong kèm phân quyền Admin
date: 2026-09-11
context: Thảo luận explore tính năng làm gọn Báo cáo tổng quan trong WeighbridgePrinter.vue
---

# Quyết định Thiết kế: Phân loại Tàu (Đang làm hàng / Đã xong)

## 1. Bối cảnh
Tại màn hình Báo cáo tổng quan của công cụ In phiếu cân (`WeighbridgePrinter.vue`), toàn bộ danh sách tàu và sà lan đang hiển thị chung, dẫn đến giao diện bị dài, lẫn lộn giữa các tàu đang tiếp tục cân hàng và các tàu đã kết thúc làm hàng.

## 2. Giải pháp thống nhất
- **Trạng thái tàu (`status`)**:
  - `Đang làm hàng` (giá trị nội bộ: `'in_progress'`, mặc định).
  - `Đã xong` (giá trị nội bộ: `'done'`).
- **Thao tác chốt & Quyền mở lại**:
  - Đặt nút **"Chốt số liệu (Đã xong)"** trên thanh tiêu đề báo cáo tổng hợp tàu.
  - Khi tàu đã chuyển sang trạng thái "Đã xong", toàn bộ tàu, sà lan và phiếu cân chuyển sang chế độ **Chỉ xem (Read-only)**: ngăn thêm mới, sửa, xóa phiếu cân hoặc sà lan.
  - Chỉ tài khoản có vai trò **Admin** (`authStore.role === 'admin'`) mới có quyền nhìn thấy và bấm nút **"Mở lại: Đang làm hàng"**.
- **Giao diện 2 Tab**:
  - Cả màn hình **Báo cáo tổng quan** và **Cây danh sách tàu ở Sidebar trái** được phân tách thành 2 tab:
    - Tab 1: **"Đang làm hàng"** (mặc định) — giao diện gọn gàng, chỉ tập trung vào các tàu đang cập nhật số liệu.
    - Tab 2: **"Đã xong"** — xem lại lịch sử các chuyến tàu đã hoàn tất để đối chiếu và xuất file báo cáo.
