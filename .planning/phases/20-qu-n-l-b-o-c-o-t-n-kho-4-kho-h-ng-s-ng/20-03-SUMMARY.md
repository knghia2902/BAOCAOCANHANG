# Plan 20-03 Summary: Xuất Báo Cáo Excel Đa Sheet Giữ Nguyên Công Thức Động & Chụp Ảnh Bảng Tổng Hợp Gửi Zalo

**Status:** Completed  
**Phase:** 20 — Quản lý & Báo cáo Tồn Kho 4 Kho Hàng Sáng  
**Date:** 2026-10-21

## Accomplishments
- **Trình xuất Excel Đa Sheet giữ nguyên công thức sống trong [`WarehouseInventoryService.ts`](file:///c:/Users/TVPL-NgocAnh/Desktop/Tools/BAOCAOCANHANG/src/services/excel/WarehouseInventoryService.ts)**:
  - **`exportSingleWarehouseWorkbook(warehouseId)`**: Tạo file `.xlsx` 5 sheet (`IMPORT X`, `EXPORT X`, `FINAL X`, `ĐI THẲNG`, `Data`) chuẩn mẫu Eastwood (`WL GỖ NÉN_KHO 4 NGUYÊN NGỌC_DDMMYYYY_EW.xlsx`) với công thức sống:
    - Dòng tổng `SUBTOTAL(9, ...)` trên các sheet `IMPORT`, `EXPORT`, `ĐI THẲNG`, và `FINAL`.
    - Công thức `SUMIF` tự động cộng tổng khối lượng nhập/xuất theo từng ngày trên bảng `FINAL`.
    - Công thức tồn kho lũy kế liên tục `=F{r-1}+C{r}-D{r}` và số chuyến `COUNTIF`.
    - Công thức tra cứu nhà máy `=IFERROR(VLOOKUP(B{r},Data!$B$3:$C$500,2,0),"")` và độ lệch khối lượng trên sheet `IMPORT`.
  - **`exportMultiWarehouseWorkbook(['KHO 1', 'KHO 2', 'KHO 3'])`**: Tạo file `.xlsx` 9 sheet (`FINAL`, `IMPORT 1`, `EXPORT 1`, `IMPORT 2`, `EXPORT 2`, `IMPORT 3`, `EXPORT 3`, `XÁ THẲNG`, `Data`) chuẩn mẫu Gỗ Bình Định với 3 bảng `KHO 1`, `KHO 2`, `KHO 3` đặt ngang nhau trên cùng sheet `FINAL` (cột `A:G`, `I:O`, `Q:W`) kèm công thức sống.
- **Trình kết xuất Ảnh PNG Độ Phân Giải Cao (`2x Retina Canvas`) cho Zalo trong [`WarehouseInventoryManager.vue`](file:///c:/Users/TVPL-NgocAnh/Desktop/Tools/BAOCAOCANHANG/src/components/tools/WarehouseInventoryManager.vue)**:
  - Nút **`Copy Ảnh Bảng FINAL (Dán Zalo)`**: Vẽ trực tiếp bảng `FINAL` (1 Kho hoặc 3 Kho ngang `KHO 1-2-3`) lên HTML5 Canvas độ phân giải 2x và ghi vào Clipboard qua `navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })])` để dán thẳng (`Ctrl+V`) vào Zalo.
  - Nút **`Tải Ảnh PNG`**: Tải trực tiếp file ảnh `.png` về máy khi trình duyệt không cấp quyền Clipboard.

## Verification
- Kiểm thử tự động trong [`WarehouseInventoryService.spec.ts`](file:///c:/Users/TVPL-NgocAnh/Desktop/Tools/BAOCAOCANHANG/src/services/excel/__tests__/WarehouseInventoryService.spec.ts) xác nhận cấu trúc sheet, công thức `SUMIF`, `SUBTOTAL`, `=F8+C9-D9`, và bố cục 3 bảng ngang trên sheet `FINAL`.
