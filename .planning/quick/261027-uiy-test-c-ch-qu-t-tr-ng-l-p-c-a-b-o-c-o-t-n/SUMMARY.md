---
phase: quick
plan: 261027-uiy
status: complete
completed_at: 2026-10-27T22:06:00+07:00
files_modified:
  - src/types/excel.ts
  - src/services/excel/WarehouseInventoryService.ts
  - src/components/tools/WarehouseInventoryManager.vue
  - src/services/excel/__tests__/WarehouseInventoryService.spec.ts
---

# Quick Task 261027-uiy Summary: Test cơ chế quét trùng lặp của Báo cáo tồn kho

## Những gì đã thực hiện
1. **Kiểm tra dữ liệu thực tế trên Supabase (`warehouse_inventory_tickets`):**
   - Đã quét toàn bộ **15.224 phiếu cân** hiện có trên cơ sở dữ liệu: `0` nhóm phiếu bị trùng lặp.
2. **Nâng cấp cơ chế quét trùng lặp đa tầng (`findMatchingExistingTicket` & `saveTicketsBulkWithStats`) trong `WarehouseInventoryService.ts`:**
   - **Tầng 1 (Khớp chính xác theo ID):** Nhận diện ngay các phiếu có cùng `id`.
   - **Tầng 2 (Khớp theo `Số phiếu` + `Biển số xe` bất kể định dạng ID):** Tự động phát hiện trùng lặp khi:
     - Phiếu đã được hút từ file **Lịch Sử Excel** (ID có hậu tố số dòng `_rowNum`, ví dụ `_2191`) và sau đó được import lại từ file **CSV/Excel trạm cân hàng ngày** (ID có hậu tố giờ cân ra `_HH:mm:ss`, ví dụ `_09:28:28`).
     - Phiếu bị import lại sau khi sửa cột bị lệch (thay đổi luồng từ `DIRECT` sang `EXPORT KHO 4` hoặc ngược lại) -> tự động xóa ID cũ bị phân loại nhầm khỏi IndexedDB & Supabase và cập nhật sang ID mới.
     - Phiếu bị lặp 2 lần ngay trong cùng 1 file CSV/Excel đầu vào (chống lỗi `ON CONFLICT DO UPDATE` của PostgreSQL).
   - **Tầng 3 (Khớp dự phòng cho phiếu không có Số phiếu):** Nếu phiếu không có `soPhieu` (và không phải dòng điều chỉnh `XE_CLEAR` / `Clear chênh lệch`), hệ thống so khớp theo `flowType + warehouseId + reportDate + Biển số chuẩn hóa + Khối lượng hàng (netWeight) + Giờ cân ra`.
   - **Bảo toàn dữ liệu sửa tay (`preserveExistingFields`):** Khi gộp phiếu trùng lúc import file, hệ thống tự động giữ nguyên các trường người dùng đã nhập/chỉnh sửa trên web (`factoryWeight` - Cân nhà máy, `vesselName` - Tàu, `bargeInfo` - Sà lan, `rawNote` - Ghi chú, `originWarehouseName`, `originArea`) nếu dòng mới trong file import để trống.
3. **Hiển thị thống kê phiếu mới & phiếu trùng trên giao diện (`WarehouseInventoryManager.vue`):**
   - Thông báo Toast sau khi nạp file sẽ hiển thị rõ `[Mới: X, Trùng đã gộp: Y]` khi phát hiện có phiếu trùng trong file tải lên.
4. **Bộ Unit Test kiểm chứng (`WarehouseInventoryService.spec.ts`):**
   - Đã thêm 5 kịch bản unit test chuyên sâu cho cơ chế quét trùng lặp (tổng cộng 24/24 tests trong `WarehouseInventoryService.spec.ts` và 60/60 tests toàn dự án đều PASS).
