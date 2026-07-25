# Milestones

## v1.0 v1.0 (Shipped: 2026-07-25)

**Phases completed:** 4 phases, 9 plans, 17 tasks

**Key accomplishments:**

- Cài đặt thành công các thư viện xử lý tài liệu client-side (pdfjs-dist, tesseract.js, docx, docx-preview, html2pdf.js), vitest và cấu hình build target ES2022 trong vite.config.ts.
- Tạo thành công định nghĩa kiểu TypeScript cho docx-preview, triển khai DiagnosticService kiểm định worker cho PDF.js và Tesseract.js, thiết lập môi trường kiểm thử browser (happy-dom) cho Vitest.
- Xây dựng thành công nền tảng dữ liệu tọa độ PDF/OCR (src/types/pdf.ts), thuật toán gom dòng động CoordinateSorter và dịch vụ trích xuất PDF số PdfOcrService.
- Tích hợp động cơ Tesseract OCR song ngữ (eng+vie) chạy trong Web Worker để nhận dạng văn bản từ ảnh và PDF quét, đảm bảo giải phóng bộ nhớ an toàn (terminate) và cập nhật tiến trình 0-100% thời gian thực.
- Excel and Word document building from coordinates, complete client-side PDF/OCR compilation pipeline, and full integration tests.
- DocumentConversionService implemented for client-side DOCX preview and conversion to PDF using docx-preview and html2pdf.js
- DocumentConversionService updated with processXlsxToPreview for parsing Excel to HTML table and exporting via html2pdf.js
- Unified PDF Extraction, OCR, and Document Conversion Dashboard Component (PdfOcrTools.vue) embedded in Tools View

---
