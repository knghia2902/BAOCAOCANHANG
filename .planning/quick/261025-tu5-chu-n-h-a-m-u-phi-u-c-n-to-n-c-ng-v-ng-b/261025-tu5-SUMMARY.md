---
quick_id: 261025-tu5
title: Chuẩn hóa mẫu phiếu cân toàn cảng và đồng bộ thông tin Nguồn tàu
date: 2026-10-25
status: complete
requirements:
  - WBTPL-01
  - WBTPL-02
  - WBTPL-03
---

# Quick Task Summary: Chuẩn hóa mẫu phiếu cân toàn cảng và đồng bộ thông tin Nguồn tàu

## 1. Kết quả thực hiện
Đã hoàn thành toàn bộ yêu cầu chuẩn hóa mẫu in phiếu cân cho Cảng Nguyên Ngọc và cơ chế kế thừa 100% từ Nguồn tàu:

1. **Database Migration (`database/migrations/20261025_add_vessel_master_data_fields.sql`):**
   - Bổ sung 3 cột `customer`, `cargo_type`, `cargo_code` vào bảng `public.weighbridge_vessels`.

2. **Service Layer (`src/services/weighbridge/WeighbridgeService.ts` & `src/services/excel/WeighbridgeService.ts`):**
   - Bổ sung `customer`, `cargo_type`, `cargo_code` vào interface `Vessel`.
   - Cung cấp `WeighbridgeMasterData` và `DEFAULT_MASTER_DATA` ban đầu (Khách hàng & Hàng hóa chuẩn).
   - Thêm các hàm `getMasterData()`, `saveMasterData(data)` lưu trên Supabase `content.settings.weighbridge_master_data` (hỗ trợ offline IndexedDB).
   - Cung cấp `WeighbridgeStandardTemplate` cùng các hàm `getGlobalTicketTemplate()`, `saveGlobalTicketTemplate(template)`.
   - Hàm `getVessels()` và nạp sà lan đảm bảo ép kế thừa 100% `owner`, `goods`, `goodsCode` từ tàu mẹ xuống toàn bộ sà lan con.
   - Bổ sung unit tests T6-T9 trong `tests/WeighbridgeService.spec.ts`. Toàn bộ 48 tests PASS.

3. **Giao diện Người dùng (`src/components/tools/WeighbridgePrinter.vue`):**
   - **Báo cáo tổng quan:** Bổ sung 3 nút tiện ích: "Mẫu phiếu cân toàn cảng", "Danh mục chuẩn", "Thêm tàu mới".
   - **Modal Thiết kế Mẫu phiếu chuẩn toàn cảng (`showGlobalTemplateModal`):** Cho phép chỉnh sửa thông tin đơn vị, tiêu đề phiếu, 5 chữ ký, thêm/sửa/xóa trường dữ liệu, kẻ ngang/dọc, khung viền, chỉnh tọa độ mm khổ A5 và lưu áp dụng 100% cho mọi sà lan.
   - **Modal Quản lý Danh mục chuẩn (`showMasterDataModal`):** Quản lý danh sách Khách hàng và Hàng hóa (Tên hàng & Mã hàng) kèm thao tác thêm/xóa.
   - **Modal Nguồn tàu (`showVesselModal`):** Cho phép tạo/sửa Tàu kèm chọn nhanh Khách hàng, Loại hàng, Mã hàng từ danh mục chuẩn (hoặc nhập mới tự động lưu vào Master Data).
   - **Kế thừa bắt buộc ở cấp Sà lan:** Tại tab Cấu hình của sà lan, các trường Khách hàng, Loại hàng, Mã hàng được khóa cứng với badge "Nguồn tàu" kèm ghi chú kế thừa từ tàu mẹ. Phần thiết kế layout cục bộ được thay thế bằng thông báo chuẩn hóa và nút dẫn tới bộ thiết kế toàn cảng.
   - **Print Engine:** Đảm bảo in phiếu luôn đồng bộ với `globalTemplate` và thông tin kế thừa từ tàu mẹ.

## 2. Kiểm tra & Thẩm định
- `npm test`: 48/48 tests PASS.
- `npm run build`: `vue-tsc -b && vite build` biên dịch thành công 0 lỗi.
