# Requirements: Góc Nhỏ Tiện Ích Của Ánh (Warehouse & Container Weighing Log)

**Defined:** 2026-07-25
**Core Value:** Enable centralized, cloud-synced weighbridge records for warehouse imports and container shipments, accessible and filterable from the management sidebar.

## v1.1 Requirements

Requirements for this milestone. Each maps to roadmap phases.

### Import & Parsing (IMP)

- [ ] **IMP-01**: User can import Excel weight list (`.xlsx`) files for warehouse receipts (factory-to-warehouse).
- [ ] **IMP-02**: User can import Excel weight list (`.xlsx`) files for container shipments (export/import).

### Database & Storage (DB)

- [ ] **DB-01**: System stores imported warehouse/container weighbridge records centrally in Supabase.
- [ ] **DB-02**: System automatically deduplicates records during import using a composite unique constraint of ticket number and record type.

### Query & Export (QRY)

- [ ] **QRY-01**: User can query and filter weighbridge records by type, date range, plate number, container number, and ticket number.
- [ ] **QRY-02**: User can export the queried/filtered results back to a downloadable Excel file (`.xlsx`).

### User Interface (UI)

- [ ] **UI-01**: User can select the new "Lịch sử cân Kho & Container" navigation menu item in the left sidebar "Tiện ích quản lý" (CargoAllocator.vue).
- [ ] **UI-02**: User can view a paginated table of records, upload new files, and delete/clear records.

### Vessel Classification & Permissions (VESSEL)

- [x] **VESSEL-01**: Tàu có hai trạng thái: "Đang làm hàng" và "Đã xong". Người dùng có thể bấm nút chốt "Đã xong" để khóa tàu ở chế độ Chỉ xem (Read-only); chỉ Admin mới có quyền bấm nút "Mở lại: Đang làm hàng".
- [x] **VESSEL-02**: Màn hình Báo cáo tổng quan và thanh danh sách bên trái được phân tách thành 2 tab rõ ràng: Tab "Đang làm hàng" (mặc định) và Tab "Đã xong".

### Allocator Database Migration & Data Recovery (PHASE-09)

- [ ] **DB-MIGRATE-01**: Thiết kế bảng quan hệ riêng `allocator_history_trips` trên Supabase, migrate 16,303 trips lịch sử từ `content.settings` JSON blob sang bảng mới.
- [ ] **DATA-RECOVER-01**: Khôi phục an toàn 1,657 chuyến xe bị thiếu (từ ngày 11/09 - 15/09) từ `weighbridge_trucks` và cấu hình sà lan sang bảng `allocator_history_trips`.
- [ ] **ALLOCATOR-SYNC-01**: Cập nhật `CargoAllocator.vue` để load/save Tab 3 (Theo dõi) trực tiếp trên bảng Supabase mới, không còn lỗi 500 timeout và đồng bộ realtime/phân trang chuẩn.

### Direct Barge Sync & Allocator Streamlining (SYNC-DIRECT)

- [ ] **SYNC-DIRECT-01**: Bỏ tab Phân bổ ở màn hình "Dữ liệu cân hàng", giao diện chỉ còn 2 tab: Tab 1 "Phiếu cân" và Tab 2 "Theo dõi".
- [ ] **SYNC-DIRECT-02**: Loại bỏ các thẻ cấu hình không còn sử dụng: "Quy tắc phân bổ" (chiến lược chia, định thời gian) và "Cấu hình tải trọng xe" ở phần đầu màn hình Dữ liệu cân hàng.
- [ ] **SYNC-DIRECT-03**: Nâng cấp tính năng Đồng bộ tại từng Sà lan trong "Báo cáo tổng quan" để tự động lọc và nạp các chuyến xe trực tiếp từ danh sách phiếu cân đã import (Tab 1 / `allocator_tickets`) theo Mã lệnh (`orderNo`).
- [ ] **SYNC-DIRECT-04**: Bổ sung nút "Lưu vào Sổ theo dõi" tại Tab 1 (Phiếu cân). Thao tác lưu là độc lập với việc đồng bộ Sà lan. Sau khi lưu thành công vào Sổ theo dõi (Tab 2), toàn bộ dữ liệu ở Tab 1 được xóa sạch (reset về rỗng).
- [ ] **SYNC-DIRECT-05**: Chuẩn hóa cấu trúc dữ liệu, giao diện hiển thị bảng và mẫu xuất file Excel của Tab 2 (Sổ theo dõi) theo đúng form và các tiêu chí chuẩn giống hệt file gốc import ở Tab 1.


### Wharfage Billing Period & Excel Tonnage (PHASE-14)

- [x] **WHARFAGE-FILTER-01**: Cung cấp bộ lọc theo chu kỳ chốt phí cầu bến (ngày 26 tháng trước đến 25 tháng này) và tùy chọn khoảng ngày linh hoạt (từ ngày - đến ngày) tại Báo cáo tổng quan sà lan, căn cứ vào thời gian kết thúc làm hàng (`dateEnd`) của sà lan.
- [x] **EXCEL-TONNAGE-01**: Bổ sung cột "Trọng tải (tấn)" vào file Excel xuất ra từ danh sách quản lý tất cả sà lan, lấy chính xác thông số kỹ thuật của sà lan và định dạng số phân cách hàng nghìn.

### Global Overview Barge Unification & Vessel Status Filter (PHASE-16)

- [ ] **UNIFY-BARGES-01**: Bảng Danh sách quản lý tất cả sà lan tại Báo cáo tổng quan hiển thị 100% sà lan của toàn bộ hệ thống (cả tàu đang làm hàng và tàu đã xong), không bị chia cắt theo tab của Sidebar.
- [ ] **VESSEL-FILTER-01**: Bổ sung bộ lọc Trạng thái tàu độc lập trên thanh công cụ lọc [Tất cả tàu | Tàu đang làm hàng | Tàu đã xong], hoạt động độc lập hoặc kết hợp linh hoạt với bộ lọc Kỳ tính phí.


### Allocator Barge Status Grouping (PHASE-17)

- [x] **ALLOC-GROUP-01**: Phân nhóm danh sách sà lan của tàu Nông Sản De Heus tại Sidebar thành 2 tab trạng thái trực quan [⏳ Chưa phân bổ (X) | ✅ Đã phân bổ (Y)] kèm số lượng đếm.
- [x] **ALLOC-GROUP-02**: Hiển thị danh sách thẻ sà lan chi tiết (tên sà lan, mã lệnh, hàng hóa, khối lượng/số chuyến). Khi bấm chọn sà lan trong "Đã phân bổ", hệ thống tự động chuyển sang Tab 3 (Sổ theo dõi) để xem dữ liệu và xuất Excel.
- [x] **ALLOC-GROUP-03**: Tự động chuyển trạng thái của sà lan từ "Chưa phân bổ" sang "Đã phân bổ" ngay khi người dùng lưu các chuyến xe phân bổ vào Sổ theo dõi.

### Admin Google Drive Backup & Restore (PHASE-18)

- [ ] **BACKUP-01**: Hệ thống trích xuất toàn bộ các bảng cơ sở dữ liệu Supabase và toàn bộ hình ảnh/tài liệu trên Supabase Storage (`portfolio-assets`), đóng gói nén thành một file `.zip` chuẩn kèm `manifest.json`.
- [ ] **BACKUP-02**: Trang `/admin` cung cấp cấu hình tự động sao lưu lên Google Drive (thông qua cầu nối Google Apps Script) theo giờ cài đặt hằng ngày và giới hạn số bản lưu tối đa (`maxBackups` — tự động xóa bản cũ nhất khi vượt quá).
- [ ] **BACKUP-03**: Trang `/admin` hiển thị danh sách lịch sử các bản sao lưu trên Google Drive, cho phép bấm nút **Restore (Khôi phục)** trực tiếp từ Google Drive hoặc **Import file `.zip`** từ máy tính để khôi phục toàn bộ database và hình ảnh/tài liệu.

### Daily Warehouse Inventory Reporting — 4 Kho (PHASE-20)

- [x] **INV-01**: Hỗ trợ tính năng "Nạp từ file Excel Báo cáo Tồn kho đang dùng" để khởi tạo và hút toàn bộ lịch sử `IMPORT`, `EXPORT`, `ĐI THẲNG / XÁ THẲNG`, danh mục `Data (Nhà xe)`, và mốc `Tồn đầu` hiện có của cả 4 Kho lên Supabase.
- [x] **INV-02**: Tự động phân loại phiếu cân từ file Weight List (CSV/Excel) theo ca chốt 6h sáng (06:00 hôm trước -> 05:59 hôm nay quy về ngày hôm trước) thành 3 luồng: Nhập kho (`Xuat/Nhap = Nhap` & `Loai Salan = KHO 1..4`), Xuất kho (`Xuat/Nhap = Xuat` & `Tai Xe = KHO 1..4`), và Đi thẳng (`Xuat/Nhap = Xuat` & `Tai Xe != KHO 1..4`).
- [x] **INV-03**: Thực hiện quy trình "Import 1 lần ở Tồn kho": khi import file CSV Xuất hàng tại màn hình Tồn kho, hệ thống tự động đẩy/đồng bộ các chuyến xuất sang Dữ liệu cân hàng (`allocator_tickets`) và Sà lan/Tàu mẹ tương ứng ở Báo cáo tổng quan.
- [x] **INV-04**: Hiển thị bảng tổng hợp `FINAL` cộng dồn lịch sử xuyên suốt theo từng Kho (không reset khi đổi khách hàng) kèm tính năng chụp/copy ảnh bảng tổng hợp nhanh để gửi qua Zalo mỗi buổi sáng.
- [x] **INV-05**: Xuất file Excel Báo cáo Tồn kho chuẩn mẫu khách hàng (gồm các sheet `IMPORT`, `EXPORT`, `FINAL`, `ĐI THẲNG`, `Data`) giữ nguyên công thức `SUMIFS`/`SUMIF` và công thức cộng dồn tồn cuối kỳ.

### Standardized Weighbridge Template & Vessel Master Data (WBTPL)

- [x] **WBTPL-01**: Chuẩn hóa 1 mẫu phiếu cân toàn cảng duy nhất được cấu hình trực tiếp tại thanh công cụ của màn hình "Báo cáo cân hàng" (Báo cáo tổng quan), loại bỏ việc lưu và chỉnh sửa layout riêng rẽ tại từng sà lan. Mọi điều chỉnh layout áp dụng đồng bộ ngay lập tức cho toàn bộ sà lan.
- [x] **WBTPL-02**: Quản lý Master Data (bảng danh mục chuẩn) gồm 3 trường thông tin: Tên khách hàng, Loại hàng, và Mã hàng.
- [x] **WBTPL-03**: Form tạo/sửa Nguồn tàu (Vessel) cung cấp bảng chọn 3 thông tin từ Master Data. Tất cả sà lan thuộc nguồn tàu bắt buộc thừa kế 100% dữ liệu này (khóa sửa tại sà lan). Cấp sà lan chỉ nhập liệu các thông tin động thực tế (số phiếu, danh sách xe, kết luận phẩm cấp).

### Interactive Warehouse Map — Sơ đồ Kho Cảng Nguyên Ngọc (PHASE-21)

- [x] **WMAP-01**: Tích hợp Tab/Chế độ xem **"Sơ đồ kho cảng"** ngay trong màn hình Báo Cáo Tồn Kho 4 Kho (`/tools/warehouse`), hiển thị mặt bằng 5 phân khu chuẩn tỷ lệ (`BÃI CONT`, `KHO 1 - 6 ô`, `KHO 2 - 11 ô`, `KHO 3 - 11 ô`, `KHO 4 - 12 ô` kèm cửa kho và nhãn "Băng tải") và tự động đồng bộ Tên khách hàng + Số tấn tồn cuối mới nhất từ 4 Kho (hỗ trợ nhập/ghi đè số Cont có hàng, Cont rỗng và thời gian cập nhật).
- [x] **WMAP-02**: Cung cấp trình chỉnh sửa đa giác trực quan (Interactive SVG Polygon Editor) cho từng kho: hỗ trợ tạo một hoặc nhiều khối đa giác (mảng hàng chính vát chéo/bậc thang và các đống hàng lẻ ở góc), kéo thả đỉnh (vertex handles), thêm/xóa đỉnh và tự động bắt dính (snap) vào vạch kẻ ô ngang hoặc cạnh tường kho.
- [x] **WMAP-03**: Lưu trữ trạng thái sơ đồ lên Supabase kèm cơ chế phân quyền theo vai trò (`authStore`): mọi người dùng đều xem được sơ đồ sạch đẹp ở chế độ Xem (View-only) và chụp/copy ảnh báo cáo, chỉ người dùng có quyền cập nhật mới bật được chế độ Chỉnh sửa và Lưu sơ đồ.

### Split Kho 4 for Bach Khoa & Eastwood (KHO4-BK)

- [ ] **INV-BK-01**: Phân chia Kho 4 thành 2 phân hệ độc lập: Kho 4 (Eastwood) và Kho 4 (Bách Khoa), mỗi bên có Tồn đầu kỳ, Ngày bắt đầu và ghi chú ngày riêng biệt (Tồn đầu Bách Khoa mặc định khởi tạo = 0 tấn).
- [ ] **INV-BK-02**: Tự động nhận diện và phân luồng phiếu cân Kho 4 dựa vào từ khóa tên khách hàng (`customerName`: Bách Khoa / Bach Khoa / BK vs Eastwood / East Wood / EW) kèm khả năng chỉnh sửa nhóm thủ công nếu cần.
- [ ] **INV-BK-03**: Báo cáo tổng hợp FINAL và xuất file Excel độc lập cho Bách Khoa (`WEIGHT LIST GỖ NÉN_KHO NGUYÊN NGỌC_BK_<DDMMYYYY>.xlsx`) gồm đầy đủ các sheet IMPORT 4, EXPORT 4, FINAL 4 với công thức số dư lũy kế.
- [ ] **INV-BK-04**: Bố trí phân khu tách riêng một góc trong Kho 4 trên Sơ đồ kho trực quan (Warehouse Visual Map) dành riêng cho khách hàng Bách Khoa.

### Shipment Settlement, Debit Note & Barge Demurrage (SETTLE - PHASE-23)

- [ ] **SETTLE-01**: Cung cấp cấu hình Ma trận Biểu giá Hợp đồng (Contract Pricing Matrix) lưu theo Khách hàng / Hợp đồng, hỗ trợ 7 bậc biến động giá dầu Petrolimex DO Vùng 1 cho cả Biểu giá xếp dỡ cảng biển (Kho ra Nhà Bè, Xe sang sà lan Nhà Bè, Gò Gia...) và Biểu cước vận tải xe đường bộ theo từng tuyến kho/nhà máy.
- [ ] **SETTLE-02**: Bảng kê chi tiết Lưu neo phương tiện (Barge Demurrage): cho phép người dùng nhập trực tiếp Ngày đến cảng & Ngày rời phao cho từng sà lan của tàu, tự động tính số ngày thực tế, số ngày vượt lưu cơ bản (7 ngày), làm tròn cảng biển (nấc 0.5 ngày và 1 ngày), và ra số tiền lưu sà lan.
- [ ] **SETTLE-03**: Giao diện Lập Đề nghị thanh toán (Debit Note): cho phép chọn chuyến tàu đã hoàn tất giao hàng, chọn mức giá dầu thực hiện (kèm công cụ tính giá dầu trung bình thời gian làm hàng), tích chọn các dịch vụ đưa vào DNTT (kèm số hợp đồng / phụ lục), tự động điền đơn giá và khối lượng từ Weightlist (Xuất kho vs Xe sang sà lan), tính thuế VAT 8% và dịch số tiền thành chữ song ngữ Việt - Anh.
- [ ] **SETTLE-04**: Trình kết xuất file Excel quyết toán lô hàng chuẩn mẫu trọn gói 8 sheet (`DNTT 1`, `DNTT 2`, `Giá dầu`, `BK SALAN`, `EXPORT XUẤT KHO`, `WL XUẤT SALAN`, `LƯU SÀ LAN`, `TRUCK `) đồng bộ công thức và định dạng theo file mẫu chuẩn cảng.

## Future Requirements (v2+)

- **QRY-03**: Interactive dashboard charts showing monthly tonnage and volume trends.
- **IMP-03**: Support importing weighlist from PDF/CSV files directly.

## Out of Scope

- Real-time cloud sync push notifications when other users import files (simple page refresh/requery is sufficient).
- Custom Excel layout configuration per file type (all files must follow the standard weighbridge column format).

## Traceability

Which phases cover which requirements.

| Requirement | Phase | Status |
|-------------|-------|--------|
| IMP-01 | Phase 5 | Pending |
| IMP-02 | Phase 5 | Pending |
| DB-01 | Phase 5 | Pending |
| DB-02 | Phase 5 | Pending |
| QRY-01 | Phase 6 | Pending |
| QRY-02 | Phase 7 | Pending |
| UI-01 | Phase 6 | Pending |
| UI-02 | Phase 6 | Pending |
| VESSEL-01 | Phase 8 | Complete |
| VESSEL-02 | Phase 8 | Complete |
| DB-MIGRATE-01 | Phase 9 | Complete |
| DATA-RECOVER-01 | Phase 9 | Complete |
| ALLOCATOR-SYNC-01 | Phase 9 | Complete |
| SYNC-DIRECT-01 | Phase 11 | Complete |
| SYNC-DIRECT-02 | Phase 11 | Complete |
| SYNC-DIRECT-03 | Phase 11 | Complete |
| SYNC-DIRECT-04 | Phase 11 | Complete |
| SYNC-DIRECT-05 | Phase 11 | Complete |
| WHARFAGE-FILTER-01 | Phase 14 | Complete |
| EXCEL-TONNAGE-01 | Phase 14 | Complete |
| UNIFY-BARGES-01 | Phase 16 | Complete |
| VESSEL-FILTER-01 | Phase 16 | Complete |
| ALLOC-GROUP-01 | Phase 17 | Complete |
| ALLOC-GROUP-02 | Phase 17 | Complete |
| ALLOC-GROUP-03 | Phase 17 | Complete |
| BACKUP-01 | Phase 18 | Pending |
| BACKUP-02 | Phase 18 | Pending |
| BACKUP-03 | Phase 18 | Pending |
| INV-01 | Phase 20 | Complete |
| INV-02 | Phase 20 | Complete |
| INV-03 | Phase 20 | Complete |
| INV-04 | Phase 20 | Complete |
| INV-05 | Phase 20 | Complete |
| WBTPL-01 | Quick 261025-tu5 | Complete |
| WBTPL-02 | Quick 261025-tu5 | Complete |
| WBTPL-03 | Quick 261025-tu5 | Complete |
| WMAP-01 | Phase 21 | Complete |
| WMAP-02 | Phase 21 | Complete |
| WMAP-03 | Phase 21 | Complete |
| INV-BK-01 | Pending | Pending |
| INV-BK-02 | Pending | Pending |
| INV-BK-03 | Pending | Pending |
| INV-BK-04 | Pending | Pending |
| SETTLE-01 | Phase 23 | Pending |
| SETTLE-02 | Phase 23 | Pending |
| SETTLE-03 | Phase 23 | Pending |
| SETTLE-04 | Phase 23 | Pending |

**Coverage:**
- v1.1 / v1.2 / v1.3 requirements: 47 total
- Mapped to phases: 43
- Pending mapping: 4

---
*Requirements defined: 2026-07-25*
*Last updated: 2026-11-11 after Debit Note & Barge Demurrage exploration*
