---
phase: 02-pdf-parsing-ocr-implementation
plan: 02
subsystem: pdf-ocr
tags: [tesseract.js, pdfjs-dist, ocr, memory-cleanup, progress-tracking]
requires: ["02-01"]
provides:
  - Multilingual Tesseract OCR processing with 'eng+vie' languages (D-03)
  - PDF rendering to HTML Canvas at 2.0x scale (D-02) and image load support
  - Thread memory leak mitigation via try-finally worker.terminate() block
  - Page-by-page progress calculation with onProgress callback
affects: [pdf-parsing-ocr-implementation]

tech-stack:
  added: []
  patterns: [Bilingual Tesseract Worker, 2.0x Canvas PDF rendering scale, Coordinates conversion to original scale, try-finally memory release]

key-files:
  created: [src/services/pdf/__tests__/ocr-worker.spec.ts]
  modified: [src/services/pdf/PdfOcrService.ts, src/services/pdf/CoordinateSorter.ts, src/services/pdf/__tests__/coordinate.spec.ts]

key-decisions:
  - "Configured bilingual 'eng+vie' models simultaneously for Tesseract worker to handle mixed-language and technical terms (D-03)."
  - "Enforced 2.0x scale PDF viewport rendering to dynamic HTML Canvas to balance memory efficiency and accuracy of Vietnamese diacritics (D-02)."
  - "Implemented coordinate normalization: scaled OCR bounding box coordinates back to 1.0x (original PDF scale) for downstream paragraph/heading builders consistency."
  - "Wrapped worker lifecycle operations in a try-finally block executing worker.terminate() to prevent RAM bloating on large documents."

patterns-established:
  - "Sequentially reuse single Tesseract worker instance across multi-page document conversions."
  - "Normalized geometric coordinate spaces between different file input formats (PDF vs Image) and scales."

requirements-completed:
  - OCR-01: Multilingual Optical Character Recognition (Vietnamese + English).
  - OCR-02: Accurate Canvas Rendering Scale for Diacritics (2.0x scale).
  - OCR-03: Page progress reporting and worker cleanup.

duration: 20min
completed: 2026-05-29
---

# Phase 2 Plan 2: PDF Page OCR & Web Worker Lifecycle Summary

**Tích hợp động cơ Tesseract OCR song ngữ (eng+vie) chạy trong Web Worker để nhận dạng văn bản từ ảnh và PDF quét, đảm bảo giải phóng bộ nhớ an toàn (terminate) và cập nhật tiến trình 0-100% thời gian thực.**

## Performance

- **Duration:** 20 min
- **Started:** 2026-05-29T16:08:18+07:00
- **Completed:** 2026-05-29T16:13:00+07:00
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- Tích hợp Tesseract.js Web Worker hỗ trợ đồng thời tiếng Anh và tiếng Việt (`eng+vie`) cho PDF quét và hình ảnh trực tiếp.
- Triển khai thuật toán vẽ canvas trang PDF ở tỷ lệ `scale: 2.0` bằng PDF.js trước khi chạy OCR để bảo toàn dấu tiếng Việt và chữ nhỏ.
- Quy đổi hệ tọa độ OCR từ gốc trên-trái (Tesseract) về gốc dưới-trái (PDF) và quy mô về 1.0x để đồng nhất logic căn chỉnh/sắp xếp của `CoordinateSorter` và các builder sau này.
- Bọc toàn bộ quy trình nhận dạng trong khối `try-finally` thực hiện giải phóng tài nguyên qua `worker.terminate()` phòng tránh lỗi rò rỉ RAM (Denial of Service).
- Xây dựng công thức tính tiến độ chung qua nhiều trang gửi callback `onProgress` với các chỉ số làm tròn thực tế.
- Viết bộ unit test giả lập (mock) chi tiết cho Web Worker, kiểm nghiệm luồng thành công, tiến trình cập nhật, và dọn dẹp tài nguyên khi có lỗi.

## Task Commits

Each task was committed atomically:

1. **feat(02-02): implement PDF canvas rendering and Tesseract worker initialization** - `7e5c8ca`
2. **test(02-02): implement OCR progress tracking and memory cleanup unit tests** - `3bbda76`

## Files Created/Modified
- `src/services/pdf/PdfOcrService.ts` - Tích hợp nạp canvas, Tesseract Worker và thu thập từ ngữ.
- `src/services/pdf/CoordinateSorter.ts` - Sửa lỗi TypeScript nghiêm ngặt về khả năng undefined của column headers.
- `src/services/pdf/__tests__/coordinate.spec.ts` - Bổ sung non-null assertion trong unit test để tương thích strict TS checks.
- `src/services/pdf/__tests__/ocr-worker.spec.ts` - Unit test kiểm thử luồng tiến trình và giải phóng worker.

## Decisions Made
- Chuyển đổi và quy mô ngược tọa độ OCR về 1.0x giúp đơn giản hóa logic xác định tiêu đề và nhóm cột ở Plan 3.
- Duyệt qua cây phân cấp `blocks -> paragraphs -> lines -> words` của Tesseract.js một cách tường minh để đảm bảo an toàn kiểu dữ liệu (strongly typed) thay vì ép kiểu thô `any`.

## Deviations from Plan
- Cập nhật thêm lớp kiểm tra an toàn kiểu (`columnHeaders[i]!`) cho `CoordinateSorter.ts` và tệp spec tương ứng để giải quyết lỗi biên dịch phát sinh khi chạy `vue-tsc` trên toàn project.

## Issues Encountered
- Happy-dom không cung cấp sẵn context render 2D cho HTML Canvas, dẫn đến lỗi hàm getContext trả về null trong test. Khắc phục bằng cách sử dụng `vi.spyOn(HTMLCanvasElement.prototype, 'getContext')` trả về một mock context trống trong phần setup của test suite.

## Next Phase Readiness
- Trích xuất dữ liệu tọa độ từ PDF số và PDF quét hoàn tất.
- Sẵn sàng chuyển giao cho Plan 3 (Wave 3) để xây dựng tài liệu Word (`docx.js`) và Excel (`exceljs`) từ cấu trúc từ ngữ đã được gom dòng/cột.

## Self-Check: PASSED
