# Phase 6: UI Dashboard & Sidebar Navigation - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-27
**Phase:** 6-UI Dashboard & Sidebar Navigation
**Areas discussed:** View Layout & Navigation, Upload mechanism, Table Pagination

---

## View Layout & Navigation

| Option | Description | Selected |
|--------|-------------|----------|
| Combined tab view | Bảng cân kho và container tích hợp chung 1 component có Tab switcher | ✓ |
| Separate sidebar items | Tách thành 2 item định tuyến riêng biệt trên sidebar bên trái | |

**User's choice:** Combined tab view.
**Notes:** Dễ quản lý và gom cụm nghiệp vụ báo cáo cân hàng ngoài sà lan.

---

## Upload mechanism

| Option | Description | Selected |
|--------|-------------|----------|
| Drag-and-drop panel | Vùng kéo thả tệp nổi bật ở đầu trang | ✓ |
| Mini button | Nút bấm nhỏ gọn trên toolbar | |

**User's choice:** Drag-and-drop panel.
**Notes:** Đảm bảo trải nghiệm trực quan đồng bộ với các công cụ tiện ích.

---

## Table Pagination

| Option | Description | Selected |
|--------|-------------|----------|
| Barge style | Phân trang mặc định 20 dòng, có dropdown chọn kích thước (10, 20, 50, 100) | ✓ |
| Custom style | Phân trang 15 dòng hoặc cuộn trang vô hạn | |

**User's choice:** Barge style.
**Notes:** Giúp người dùng thao tác quen thuộc giống như trang sà lan.

---

## the agent's Discretion

Styling and typography (Segoe UI, Tailwind grid layout) matching CargoAllocator design.

## Deferred Ideas

Advanced search filters and Excel export are deferred to Phase 7.
