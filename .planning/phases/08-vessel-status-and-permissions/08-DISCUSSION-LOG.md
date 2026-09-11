# Phase 8: Phân loại tàu Đang làm hàng & Đã xong - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-09-11
**Phase:** 08-vessel-status-and-permissions
**Areas discussed:** Trạng thái tàu & quyền hạn, Giao diện 2 Tab, Chế độ Chỉ xem, Xác nhận chốt tàu

---

## Trạng thái tàu & Thao tác chốt
- **Tên hiển thị:** "Đang làm hàng" và "Đã xong".
- **Vị trí nút bấm:** Trên thanh tiêu đề khi bấm vào xem chi tiết tàu.
- **Quyền hạn mở lại:** Chỉ Admin (`authStore.role === 'admin'`) mới có quyền bấm mở lại tàu về "Đang làm hàng".

## Chế độ Chỉ xem (Read-only)
- Khi tàu đã chuyển sang "Đã xong", toàn bộ tàu, sà lan và phiếu cân thuộc tàu đó khóa ở chế độ Chỉ xem.
- Ngăn chặn thêm mới, chỉnh sửa, xóa phiếu cân hoặc sà lan.

## Giao diện 2 Tab
- Lựa chọn phương án 2 Tab chuyển đổi ở cả Sidebar và Trang tổng quan.
- Tab 1: "Đang làm hàng" (mặc định)
- Tab 2: "Đã xong"

---

## the agent's Discretion
- Cơ chế đồng bộ tab giữa Sidebar và Dashboard.
- Modal popup cảnh báo xác nhận khi chốt tàu.
- Badge đếm số lượng tàu trên mỗi tab.

## Deferred Ideas
- None.
