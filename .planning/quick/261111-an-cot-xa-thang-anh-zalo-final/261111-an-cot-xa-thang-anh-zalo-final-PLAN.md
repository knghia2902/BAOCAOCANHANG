---
phase: quick
plan: 261111-an-cot-xa-thang-anh-zalo-final
type: execute
wave: 1
depends_on: []
files_modified:
  - src/components/tools/WarehouseInventoryManager.vue
autonomous: true
must_haves:
  truths:
    - "Ảnh chụp nhanh Final gửi Zalo (canvas render) không hiển thị cột Xá thẳng cho bất kỳ kho nào."
    - "Bảng Final gồm đúng 5 cột chuẩn: Ngày, Nhập, Xuất, Tồn cuối, Ghi chú."
---

<objective>
Trong Báo Cáo Tồn Kho (`WarehouseInventoryManager.vue`), điều chỉnh hàm tạo ảnh chụp nhanh bảng FINAL gửi Zalo (`renderFinalTableToPngBlob`) để không hiển thị cột "Xá thẳng" (Direct).
</objective>

<tasks>
<task type="auto">
  <name>Task 1: Loại bỏ cột Xá thẳng trong hàm renderFinalTableToPngBlob</name>
  <files>src/components/tools/WarehouseInventoryManager.vue</files>
  <action>
    - Trong hàm `renderFinalTableToPngBlob`:
      - Chuẩn hóa `getBlockColWidths` luôn trả về 5 cột: `[135, 130, 130, 135, 125]`
      - Loại bỏ cờ `hasDirect`
      - Đặt `headers` thành 5 cột chuẩn: `[['Ngày', 'Date'], [\`NHẬP \${whId}\`], [\`XUẤT \${whId}\`], ['Tồn cuối', 'Stock'], ['Ghi chú', 'Remarks']]`
      - Đặt `aligns` thành `['center', 'right', 'right', 'center', 'left']`
      - Định dạng `cells` và `totalCells` 5 cột tương ứng (không chèn cột Xá thẳng)
  </action>
  <verify>Chạy `npm test` và `npm run build` đều pass.</verify>
  <done>Ảnh chụp bảng Final gửi Zalo hiển thị chuẩn 5 cột, không có cột Xá thẳng.</done>
</task>
</tasks>
