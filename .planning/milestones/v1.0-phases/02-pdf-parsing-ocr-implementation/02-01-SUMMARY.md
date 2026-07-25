---
phase: 02-pdf-parsing-ocr-implementation
plan: 01
subsystem: pdf
tags: [pdfjs-dist, coordinate-sorter, digital-pdf]
requires: []
provides:
  - TextElement, LineGroup, and options/result type definitions in src/types/pdf.ts
  - Y-coordinate dynamic grouping and X-coordinate 1D clustering in CoordinateSorter.ts
  - Digital PDF parsing and text/coordinate extraction in PdfOcrService.ts
affects: [pdf-parsing-ocr-implementation]

tech-stack:
  added: [happy-dom]
  patterns: [Y-coordinate grouping based on 50% font size, X-coordinate 1D clustering]

key-files:
  created: [src/types/pdf.ts, src/services/pdf/CoordinateSorter.ts, src/services/pdf/PdfOcrService.ts, src/services/pdf/__tests__/coordinate.spec.ts, src/services/pdf/__tests__/pdf-digital.spec.ts]
  modified: [package.json, package-lock.json]

key-decisions:
  - "Implemented dynamic Y-coordinate grouping (threshold = 0.5 * Math.max(el.fontSize, line.averageFontSize)) to handle varying font sizes."
  - "Configured PDF.js worker path utilizing CDN for client-side execution."

patterns-established:
  - "Encapsulation of layout sorting algorithms inside a standalone utility class (CoordinateSorter)."

requirements-completed:
  - CONV-01: Digital PDF Parsing Foundation and Coordinates Sorting.

duration: 15min
completed: 2026-05-29
---

# Phase 2 Plan 1: PDF Coordinate Foundation & Digital Parsing Summary

**Xây dựng thành công nền tảng dữ liệu tọa độ PDF/OCR (src/types/pdf.ts), thuật toán gom dòng động CoordinateSorter và dịch vụ trích xuất PDF số PdfOcrService.**

## Performance

- **Duration:** 15 min
- **Started:** 2026-05-29T16:04:57+07:00
- **Completed:** 2026-05-29T16:08:00+07:00
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments
- Khai báo đầy đủ các interface dùng chung `TextElement`, `LineGroup`, `PdfOcrOptions` và `PdfOcrResult` tại `src/types/pdf.ts`.
- Triển khai lớp `CoordinateSorter` thực hiện gom nhóm dòng động Y-coordinate với ngưỡng tỷ lệ $50\%$ kích thước font chữ (Decision D-01) và gom cột X-coordinate (Decision D-04).
- Triển khai `PdfOcrService` cấu hình worker CDN chính xác của PDF.js và trích xuất thành công chữ và tọa độ từ PDF số.
- Thiết lập và chạy thành công bộ unit test tự động bằng Vitest cho thuật toán Coordinate Sorter và dịch vụ PdfOcrService.

## Task Commits

Each task was committed atomically:

1. **Task 1: Create PDF/OCR type definitions and Coordinate Sorter** - `688250d` (feat)
2. **Task 2: Build PdfOcrService and digital PDF text parser** - `09aa03a` (feat)

## Files Created/Modified
- `src/types/pdf.ts` - Định nghĩa kiểu dữ liệu.
- `src/services/pdf/CoordinateSorter.ts` - Thuật toán gom dòng và cột.
- `src/services/pdf/PdfOcrService.ts` - Khởi động worker và phân tích cấu trúc PDF số.
- `src/services/pdf/__tests__/coordinate.spec.ts` - Unit test cho Coordinate Sorter.
- `src/services/pdf/__tests__/pdf-digital.spec.ts` - Unit test cho PdfOcrService.
- `package.json` / `package-lock.json` - Thêm happy-dom làm devDependency cho Vitest.

## Decisions Made
- Lựa chọn giải pháp mock PDF.js `getDocument` trong unit test để tránh phân phối tệp PDF nhị phân trong mã nguồn và đẩy nhanh tốc độ chạy kiểm thử.
- Tách biệt hoàn toàn thuật toán sắp xếp sắp đặt vị trí `CoordinateSorter` ra khỏi dịch vụ `PdfOcrService` để có thể tái sử dụng cho cả ảnh quét OCR sau này.

## Deviations from Plan
- Cài đặt thêm `happy-dom` vào `devDependencies` vì Vitest yêu cầu môi trường DOM để khởi tạo các biến môi trường test.

## Issues Encountered
None.

## Next Phase Readiness
- Nền tảng phân tích tọa độ và trích xuất chữ từ PDF đã sẵn sàng.
- Sẵn sàng chuyển giao cho Plan 2 (Wave 2) để tích hợp Tesseract.js Web Worker cho việc quét PDF ảnh (scanned PDF).

## Self-Check: PASSED
