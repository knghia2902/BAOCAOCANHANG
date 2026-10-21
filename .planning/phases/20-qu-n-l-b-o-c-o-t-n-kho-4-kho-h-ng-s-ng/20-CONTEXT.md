# Phase 20: Quản lý & Báo cáo Tồn Kho 4 Kho Hàng Sáng — Context

**Defined:** 2026-10-21
**Source:** `/gsd-explore` session & `.planning/notes/warehouse-inventory-report.md`

<domain>
Xây dựng hệ thống Quản lý & Báo cáo Tồn Kho 4 Kho (`KHO 1`, `KHO 2`, `KHO 3`, `KHO 4`) tại Cảng Nguyên Ngọc phục vụ gửi báo cáo hàng sáng cho 3 khách hàng (Eastwood Energy, Gỗ Bình Định, Nhiệt Xanh / Bách Khoa...).
</domain>

<decisions>
- **D-01 (Cấu trúc 4 Kho & Khách hàng):** Cảng có 4 kho (`KHO 1`, `KHO 2`, `KHO 3`, `KHO 4`). Khách hàng tương ứng được xác định từ cột `Khach hang` trên phiếu cân. Tên khách hàng có thể thay đổi qua lại trong Kho 1, 2, 3.
- **D-02 (Cộng dồn lịch sử xuyên suốt):** Lịch sử tồn kho của mỗi kho được cộng dồn liên tục theo thời gian, **không chuyển/cắt lô khi chuyển khách hàng**.
- **D-03 (Quy tắc phân loại từ Weight List CSV/Excel):**
  - **Nhập kho (`IMPORT`):** `Xuat/Nhap = Nhap` VÀ `Loai Salan` thuộc `KHO 1..4` (`Tai Xe` là Nhà máy SX -> ghi vào Ghi chú; `Ghi Chu` là Cân Nhà Máy -> tính Chênh lệch; tra cứu Nhà xe từ danh mục `Data`). Các dòng `Nhap` mà `Loai Salan` không phải `KHO 1..4` (ví dụ: Bắp De Heus) thì bỏ qua.
  - **Xuất từ kho (`EXPORT`):** `Xuat/Nhap = Xuat` VÀ `Tai Xe` thuộc `KHO 1..4` (`Loai Salan` là tên Sà lan + Lệnh xuất; tự động ánh xạ sang Tàu mẹ từ danh sách Tàu/Sà lan của Báo cáo tổng quan).
  - **Đi thẳng / Xá thẳng (`ĐI THẲNG`):** `Xuat/Nhap = Xuat` VÀ `Tai Xe` khác `KHO 1..4` (không trừ tồn kho, nhưng đưa vào sheet `ĐI THẲNG / XÁ THẲNG` và tổng hợp theo ngày vào cột `Xá thẳng` trên bảng `FINAL`).
- **D-04 (Mốc thời gian chốt báo cáo ngày - Ca 6h sáng):** Tính theo giờ cân ra (`Ngay can lan 2` + `Gio can lan 2`) từ `06:00 sáng hôm trước` đến `05:59:59 sáng hôm nay` quy về Ngày báo cáo hôm trước.
- **D-05 (Import 1 lần duy nhất tại Tồn Kho):** Người dùng chỉ import file CSV Nhập và CSV Xuất 1 lần tại màn hình Tồn Kho. Hệ thống vừa cập nhật dữ liệu Tồn kho 4 Kho, vừa tự động đẩy các chuyến `Xuat` sang `allocator_tickets` và đồng bộ sang Sà lan ở Báo cáo tổng quan để không phải import 2 nơi.
- **D-06 (Khởi tạo lịch sử từ file Excel đang dùng):** Có tính năng "Nạp từ file Excel Báo cáo Tồn kho đang dùng" (`WL GỖ NÉN_KHO 4...xlsx`, `WEIGHT LIST GỖ NÉN_KHO NGUYÊN NGỌC_GBD...xlsx`) để hút toàn bộ lịch sử `IMPORT`, `EXPORT`, `ĐI THẲNG`, danh mục `Data (Nhà xe)`, và mốc `Tồn đầu` hiện có của cả 4 kho lên Supabase.
- **D-07 (Đầu ra báo cáo hàng sáng):**
  - Hiển thị bảng tổng hợp `FINAL` trên Web (xem riêng từng Kho hoặc chế độ ghép ngang Kho 1-2-3) kèm nút **Chụp/Copy ảnh bảng tổng hợp** để gửi Zalo.
  - Xuất file Excel `.xlsx` chuẩn mẫu khách hàng gồm các sheet `IMPORT`, `EXPORT`, `FINAL`, `ĐI THẲNG / XÁ THẲNG`, `Data` giữ nguyên công thức `SUMIFS` / `SUMIF` và công thức cộng dồn tồn kho.
</decisions>

<canonical_refs>
- `.planning/notes/warehouse-inventory-report.md`
- `.planning/REQUIREMENTS.md` (`INV-01` .. `INV-05`)
- `.planning/ROADMAP.md` (Phase 20)
- Sample CSV: `C:\Users\TVPL-NgocAnh\Desktop\báo cáo cân hàng\2010ok.csv`
- Sample Excel Kho 4 (Eastwood): `Z:\BDACC\CS\WAREHOUSES\2026\Kho NGUYÊN NGỌC\EASTWOOD\WL GỖ NÉN_KHO 4 NGUYÊN NGỌC_21102026_EW.xlsx`
- Sample Excel Kho 1-2-3 (Gỗ Bình Định): `Z:\BDACC\CS\WAREHOUSES\2026\Kho NGUYÊN NGỌC\GỖ BÌNH ĐỊNH\WEIGHT LIST GỖ NÉN_KHO NGUYÊN NGỌC_GBD_21102026.xlsx`
</canonical_refs>
