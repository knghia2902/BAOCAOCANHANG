# Phase 5: Supabase Schema & WeighbridgeOtherService - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-27
**Phase:** 5-Supabase Schema & WeighbridgeOtherService
**Areas discussed:** Database Table Design, Excel Field Mapping, Deduplication Strategy

---

## Database Table Design

| Option | Description | Selected |
|--------|-------------|----------|
| Gộp chung vào 1 bảng duy nhất | Dùng chung bảng `weighbridge_other_tickets` với cột `type` để phân loại | |
| Tách thành 2 bảng riêng biệt | Tạo 2 bảng độc lập `weighbridge_warehouse_tickets` và `weighbridge_container_tickets` | ✓ |

**User's choice:** Tách thành 2 bảng riêng biệt.
**Notes:** Người dùng nhận định rằng trong tương lai cấu trúc và số lượng trường thông tin cho Kho và Container sẽ mở rộng nhiều và khác biệt nhau.

---

## Excel Field Mapping

| Option | Description | Selected |
|--------|-------------|----------|
| Ánh xạ tự động và khớp cột cơ bản | Khớp các cột cơ bản (Số phiếu, Biển số xe, Khối lượng vào/ra, Ngày giờ vào/ra, Tài xế, Ghi chú) và tự nhận diện tiêu đề, thêm container_no và goods_name | ✓ |

**User's choice:** Ánh xạ tự động và khớp cột cơ bản.
**Notes:** Hệ thống sẽ tự khớp thông minh dựa trên tên tiêu đề cột có sẵn.

---

## Deduplication Strategy

| Option | Description | Selected |
|--------|-------------|----------|
| Overwrite (Ghi đè) | Ghi đè thông tin mới lên dữ liệu cũ dựa trên số phiếu cân (`ticket_no`) | ✓ |
| Skip (Bỏ qua) | Chỉ thêm phiếu mới, giữ nguyên phiếu cũ | |

**User's choice:** Ghi đè (Phương án A).
**Notes:** Đảm bảo đồng bộ hóa thông tin mới nhất từ tệp Excel lên Supabase tương tự sà lan.

---

## the agent's Discretion

None — all implementation rules and database schema directions were locked.

## Deferred Ideas

None.
