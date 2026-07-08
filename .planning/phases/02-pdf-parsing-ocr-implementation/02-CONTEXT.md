# Phase 2: PDF Parsing & OCR Implementation - Context

**Gathered:** 2026-05-29
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase này xây dựng toàn bộ thuật toán lõi để trích xuất văn bản từ PDF số và nhận diện văn bản (OCR) từ PDF quét / hình ảnh, sau đó chuyển cấu trúc dữ liệu thô này thành các file Word (.docx) và Excel (.xlsx):
1. Thuật toán trích xuất các khối chữ từ PDF số và sắp xếp chúng theo dòng dựa trên tọa độ.
2. Tích hợp Tesseract.js Web Worker để chạy OCR nhận diện văn bản tiếng Anh và tiếng Việt từ ảnh chụp/canvas trang PDF.
3. Thiết lập cơ chế trả về tiến độ OCR thực tế dưới dạng phần trăm (percentage progress callbacks).
4. Thiết lập module xây dựng tài liệu Word (`docx`) và Excel (`exceljs`) từ văn bản đã được gom nhóm.

</domain>

<decisions>
## Implementation Decisions

### PDF Parsing & Coordinate Sorting
- **D-01:** Thuật toán gom nhóm dòng theo trục Y (Y-Coordinate Grouping) sử dụng phương pháp tính toán động theo chiều cao font chữ (Dynamic Threshold). Hai phần tử chữ kế tiếp được coi là cùng một dòng nếu khoảng cách tọa độ Y của chúng nhỏ hơn 50% chiều cao trung bình của font chữ đó. Quyết định này giúp thuật toán hoạt động chính xác cả với tài liệu có cỡ chữ rất nhỏ hoặc tiêu đề lớn.
- **D-04:** Để tái lập cột Excel (Column Mapping) từ các đoạn chữ PDF số, thuật toán sẽ phân tích tọa độ trục X, gom cụm các tọa độ X trùng hoặc rất gần nhau để suy luận ra chỉ số cột tương ứng cho các ô trong bảng dữ liệu.

### Optical Character Recognition (OCR)
- **D-02:** Khi xử lý PDF quét (scanned PDF), trang tài liệu sẽ được PDF.js vẽ ra đối tượng Canvas với tỷ lệ độ phân giải Scale 2.0x trước khi chạy OCR. Quy mô này đảm bảo độ sắc nét cao giúp nhận diện chính xác các từ chữ nhỏ và dấu tiếng Việt mà không gây quá tải bộ nhớ RAM trên trình duyệt của máy khách.
- **D-03:** Bộ máy OCR của Tesseract.js được cấu hình tải và sử dụng đồng thời hai mô hình ngôn ngữ tiếng Anh và tiếng Việt (`eng+vie`) để xử lý được các tài liệu song ngữ hoặc tài liệu chứa thuật ngữ kỹ thuật tiếng Anh xen kẽ.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Core Requirements & Roadmap
- `.planning/ROADMAP.md` §Phase 2: PDF Parsing & OCR Implementation — Yêu cầu chi tiết và tiêu chí thành công của Phase 2.
- `.planning/REQUIREMENTS.md` §Conversion Core (CONV) & §Optical Character Recognition (OCR) — Yêu cầu chức năng CONV-01, CONV-02, CONV-03 và OCR-01, OCR-02, OCR-03, OCR-04.
- `.planning/phases/01-dependency-setup-worker-infrastructure/01-CONTEXT.md` — Quyết định tải worker CDN đã được phê duyệt ở Phase 1.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/services/infrastructure/DiagnosticService.ts` — Sử dụng cách thiết lập worker và tải CDN worker đã được cài đặt và kiểm định thành công ở Phase 1 làm tham chiếu.
- `src/services/excel/ConverterService.ts` & `MergerService.ts` — Tham chiếu các mẫu khởi tạo workbook Excel, xử lý dòng/cột và ghi file nhị phân qua `exceljs`.

### Established Patterns
- **Service encapsulation**: Các dịch vụ parsing và OCR sẽ được bọc hoàn toàn trong các class Service mới ở `src/services/pdf/` hoặc `src/services/ocr/` độc lập với giao diện hiển thị.
- **Unit testing**: Viết unit test cho các service xử lý thuật toán thông qua Vitest để kiểm chứng logic chính xác tự động.

### Integration Points
- Tạo mới dịch vụ `PdfOcrService.ts` trong `src/services/` và các module builder phụ trợ.

</code_context>

<specifics>
## Specific Ideas

- **Progress Callback**: Tiến trình của OCR sẽ được lấy từ thuộc tính `progress` trong các sự kiện mà Tesseract.js Worker gửi về qua phương thức `logger`. Cần ánh xạ sự kiện này thành phần trăm hoàn thành thực tế (0 - 100%) và truyền ngược lại thông qua một callback function để UI hiển thị.

</specifics>

<deferred>
## Deferred Ideas

- None — discussion stayed within phase scope.

</deferred>

---
*Phase: 02-pdf-parsing-ocr-implementation*
*Context gathered: 2026-05-29*
