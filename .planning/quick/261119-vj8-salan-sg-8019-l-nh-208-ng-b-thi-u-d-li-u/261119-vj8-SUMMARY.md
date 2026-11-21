---
phase: quick-261119-vj8
plan: "01"
subsystem: weighbridge-sync
tags: [weighbridge, sync, order-no, fallback, history-sync, deduplication]
status: complete
completed_date: "2026-11-20"
key_files:
  created:
    - src/services/excel/__tests__/WeighbridgeSyncOrderFallback.spec.ts
  modified:
    - src/services/excel/AllocatorService.ts
    - src/components/workspace/WeighbridgeDataImporter.vue
    - src/components/tools/WeighbridgePrinter.vue
---

# Quick Task 261119-vj8: Khắc phục lỗi sà lan SG 8019 lệnh 208 đồng bộ thiếu dữ liệu cân ngày 17/11/2026

## Nguyên nhân gốc rễ

1. **Dữ liệu thực tế trên Supabase:**
   - Sà lan **SG 8019** (`id = 1794635922007`, tàu `NÔNG SẢN_DE HEUS`, Mã lệnh `208`) bị thiếu **4 chuyến cân ca đêm ngày 17/11/2026** (`018743/26B`, `018744/26B`, `018745/26B`, `018746/26B`, tổng `187,410 kg`, giờ cân vào `01:17–02:15` rạng sáng `18/11/2026`).
   - Khi import File 2 ngày 18/11/2026, cột **Mã lệnh** bị bỏ trống (`order_no = ""`) dù cột **Sà lan** vẫn có `SG 8019`. Sau khi lưu sang Sổ Theo Dõi (`weighbridge_tracking`), 4 phiếu này không được đồng bộ vào `weighbridge_trucks` (và bị lưu trùng 2 lần trong `weighbridge_tracking`).
2. **3 lỗ hổng hệ thống trong mã nguồn:**
   - `WeighbridgeDataImporter.vue` & `WeighbridgePrinter.vue`: Không tự suy luận `orderNo` khi cột Mã lệnh bị trống dù tên sà lan khớp duy nhất với 1 sà lan đang mở khóa (`!locked`) thuộc tàu đang làm hàng (`in_progress`).
   - `WeighbridgePrinter.vue` (`syncFromAllocatorActiveBarge`): Chỉ đọc `allocator_tickets` (Tab 1) mà không đối chiếu thêm `weighbridge_tracking` (Sổ Theo Dõi - Tab 2), nên sau khi người dùng bấm "Lưu vào Sổ Theo Dõi" thì không thể đồng bộ bù các phiếu đã lưu hoặc vừa sửa Mã lệnh.
   - `WeighbridgeDataImporter.vue` (`saveSourceTicketsToHistory`): Không lọc bỏ các phiếu đã tồn tại trong `existingTrips` trước khi `insertTrips`, gây lưu trùng bản ghi vào `weighbridge_tracking`.

## Kết quả đã thực hiện

- **Khôi phục dữ liệu Supabase cho sà lan SG 8019 lệnh 208:**
  - Cập nhật `order_no = '208'` cho 4 phiếu `018743/26B`, `018744/26B`, `018745/26B`, `018746/26B` trong `weighbridge_tracking` và xóa 4 bản ghi trùng (`6045–6048`).
  - Bổ sung đủ 4 chuyến cân thiếu vào `weighbridge_trucks` (`barge_id = 1794635922007`), nâng tổng sà lan SG 8019 lệnh 208 từ **31 → 35 chuyến** (**1,565,350 kg**).
- **Sửa mã nguồn ngăn tái diễn:**
  - `AllocatorService.ts`: Thêm `resolveOrderNoFromActiveBarges()` và `getTripsByOrderNo(orderNo)`.
  - `WeighbridgeDataImporter.vue`: Tự điền `orderNo` lúc import nếu khớp duy nhất 1 sà lan đang mở khóa; lọc trùng `isSameScaleTicket` trước khi lưu Sổ Theo Dõi.
  - `WeighbridgePrinter.vue`: Hỗ trợ fallback khớp tên sà lan đang mở trong `isBargeMatch()` và đồng bộ kết hợp cả Tab 1 (`allocator_tickets`) lẫn Tab 2 (`weighbridge_tracking`) trong `syncFromAllocatorActiveBarge()`.
- **Kiểm chứng:**
  - Thêm 6 unit tests trong `WeighbridgeSyncOrderFallback.spec.ts`.
  - Toàn bộ 23 file test (134 tests) PASS và `npm run build` PASS (exit code 0).
