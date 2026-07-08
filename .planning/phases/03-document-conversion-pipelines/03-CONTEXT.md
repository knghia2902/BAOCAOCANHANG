# Phase 3: Document Conversion Pipelines - Context

**Gathered:** 2026-05-29
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase này xây dựng hai pipeline chuyển đổi tài liệu client-side:
1. **DOCX → PDF**: Upload file Word, render preview bằng `docx-preview`, người dùng xem trước rồi nhấn nút xuất PDF qua `html2pdf.js`.
2. **XLSX → PDF**: Upload file Excel, parse bằng `exceljs`, render thành HTML `<table>` để preview, người dùng nhấn nút xuất PDF qua `html2pdf.js`.

Cả hai pipeline đều follow pattern: Upload → Parse → Preview → Export PDF.

</domain>

<decisions>
## Implementation Decisions

### DOCX → PDF Pipeline
- **D-01:** Sử dụng chiến lược **Render-then-print** — Gọi `docx-preview.renderAsync()` để render nội dung Word thành HTML trong một container hiển thị, sau đó dùng `html2pdf.js` chụp container đó và xuất PDF. Không cần parse XML thủ công.
- **D-02:** Hiển thị preview trước khi tải — Người dùng nhìn thấy bản xem trước tài liệu Word được render trong vùng hiển thị trên trang, rồi nhấn nút "Tải PDF" để xuất. Không tự động download.

### XLSX → PDF Pipeline
- **D-03:** Dùng `exceljs` có sẵn — Parse workbook bằng `exceljs` (đã cài từ Phase 1 và đang sử dụng trong `ConverterService.ts`), render dữ liệu thành HTML `<table>`, rồi `html2pdf.js` chuyển sang PDF.
- **D-04:** Chỉ render sheet đầu tiên trong v1 — Đơn giản hoá logic, multi-sheet sẽ là tính năng v2 (CONV-07 trong REQUIREMENTS.md).
- **D-05:** Preview XLSX giống DOCX — Hiển thị HTML table preview trước, người dùng nhấn nút tải PDF. UX nhất quán giữa hai pipeline.

### PDF Output Configuration
- **D-06:** Khổ giấy A4, margin 10mm, image quality 0.98 — Chuẩn cho tài liệu văn phòng Việt Nam. Cấu hình `html2pdf.js` options:
  ```js
  {
    margin: 10,
    filename: '{originalName}_converted.pdf',
    image: { type: 'jpeg', quality: 0.98 },
    html2canvas: { scale: 2 },
    jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
  }
  ```
- **D-07:** Tên file xuất ra: tên gốc + `_converted.pdf`. Ví dụ: `baocao.docx` → `baocao_converted.pdf`.

### File Handling & Limits
- **D-08:** Giới hạn dung lượng file 15MB — Nhất quán với giới hạn dropzone UI-02 trong REQUIREMENTS.md. File vượt quá sẽ bị reject trước khi xử lý.
- **D-09:** Progress chia 3 giai đoạn với status text + percentage:
  - Đọc file: 0% → 20%
  - Render preview: 20% → 70%
  - Xuất PDF: 70% → 100%

### Agent's Discretion
- Cách tổ chức file/class service (tách service riêng hay gộp chung) — agent quyết định dựa trên pattern của Phase 2.
- Styling CSS cho preview container — agent quyết định phù hợp với Tailwind CSS đã có.
- Error handling chi tiết — agent quyết định dựa trên pattern `try/catch` + `console.error` hiện tại.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Core Requirements & Roadmap
- `.planning/ROADMAP.md` §Phase 3: Document Conversion Pipelines — Goal, success criteria, plan list.
- `.planning/REQUIREMENTS.md` §CONV-04, §CONV-05 — Acceptance criteria cho DOCX→PDF và XLSX→PDF.

### Prior Phase Context
- `.planning/phases/01-dependency-setup-worker-infrastructure/01-CONTEXT.md` — Quyết định cài đặt `docx-preview`, `html2pdf.js`. Lưu ý pitfall: `html2pdf.js` PHẢI dùng dynamic import.
- `.planning/phases/01-dependency-setup-worker-infrastructure/01-RESEARCH.md` §Pitfall 2 — Lỗi "self is not defined" từ `html2pdf.js` và cách khắc phục bằng dynamic import.
- `.planning/phases/02-pdf-parsing-ocr-implementation/02-CONTEXT.md` — Pattern service class đã thiết lập.

### Type Declarations
- `src/types/docx-preview.d.ts` — Custom TypeScript declaration cho `docx-preview` với API `renderAsync()`.

### Existing Code Patterns
- `src/services/excel/ConverterService.ts` — Pattern đọc file Excel bằng `exceljs`, tham chiếu cách validate file và parse workbook.
- `src/services/pdf/PdfOcrService.ts` — Pattern service class Phase 2, tham chiếu cách tổ chức service mới.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `exceljs` (installed) — Đã dùng trong `ConverterService.ts` và `MergerService.ts`. Tái sử dụng để parse XLSX workbook.
- `docx-preview@0.3.7` (installed) — Type declarations đã có tại `src/types/docx-preview.d.ts`. API chính: `renderAsync(document, container, styleContainer, options)`.
- `html2pdf.js@0.14.0` (installed) — PHẢI dùng dynamic import: `const html2pdf = (await import('html2pdf.js')).default;`.
- `src/services/excel/ExcelService.ts` — Có helper `validateFileSize(file, maxMB)` có thể tham khảo.

### Established Patterns
- **Service Abstraction Layer**: Mọi logic xử lý tài liệu đặt trong `src/services/` class-based, không gọi thư viện trực tiếp từ UI.
- **File validation**: Check extension + file size trước khi xử lý (pattern từ `ConverterService.validateFile()`).
- **Dynamic import**: `html2pdf.js` phải dùng `await import()` để tránh lỗi SSR/bundle.

### Integration Points
- Service mới sẽ nằm trong `src/services/pdf/` hoặc `src/services/conversion/` — agent quyết định vị trí.
- Phase 4 (UI) sẽ gọi service này từ Vue components — cần export interface rõ ràng.

</code_context>

<specifics>
## Specific Ideas

- **Consistent UX**: Cả hai pipeline (DOCX và XLSX) đều follow cùng flow: Upload → Preview → Export PDF. Người dùng không cần học hai cách khác nhau.
- **html2pdf.js dynamic import pattern**: `const html2pdf = (await import('html2pdf.js')).default;` — đặt trong method, không import static ở đầu file.

</specifics>

<deferred>
## Deferred Ideas

- Multi-sheet XLSX export (CONV-07) — v2 requirement, đã tracked trong REQUIREMENTS.md.
- Cho phép người dùng chọn khổ giấy/orientation — có thể thêm vào Phase 4 hoặc v2.

</deferred>

---
*Phase: 03-document-conversion-pipelines*
*Context gathered: 2026-05-29*
