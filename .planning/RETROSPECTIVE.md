# Project Retrospective

*A living document updated after each milestone. Lessons feed forward into future planning.*

## Milestone: v1.0 — v1.0 MVP

**Shipped:** 2026-07-25
**Phases:** 4 | **Plans:** 9 | **Sessions:** 2

### What Was Built
- Cài đặt thành công các thư viện xử lý tài liệu client-side (pdfjs-dist, tesseract.js, docx, docx-preview, html2pdf.js) và vitest.
- Triển khai thuật toán gom dòng động CoordinateSorter và dịch vụ trích xuất PDF số PdfOcrService.
- Tích hợp động cơ Tesseract OCR song ngữ (eng+vie) chạy trong Web Worker.
- Xây dựng DocumentConversionService để hiển thị xem trước tài liệu DOCX/XLSX client-side và chuyển đổi sang PDF.
- Tích hợp giao diện Dashboard PdfOcrTools.vue vào ToolsView.
- Tích hợp các trường CCCD của thuyền viên và sửa logic đồng bộ sà lan trùng lặp dựa trên ticketNo.

### What Worked
- Sử dụng các thư viện chạy hoàn toàn ở phía client (Tesseract.js, ExcelJS, pdfjs-dist) giúp giảm thiểu chi phí máy chủ và đảm bảo bảo mật dữ liệu tuyệt đối cho người dùng.
- Tổ chức cấu trúc phase và lập kế hoạch chi tiết giúp dễ dàng kiểm tra và bàn giao trạng thái dự án.

### What Was Inefficient
- Quá trình kiểm định chất lượng (code review) ở Phase 2 bị hoãn lại do giới hạn tài nguyên (quota) ở thời điểm đó.

### Patterns Established
- Gom nhóm tọa độ theo dòng động hỗ trợ việc nhận diện bảng biểu trong tệp PDF.
- Tích hợp đồng bộ sà lan theo `ticketNo` giúp xử lý dữ liệu trùng lặp chính xác hơn phương thức đếm số lượng chuyến đi trước đây.

### Key Lessons
1. Xử lý Web Worker trong môi trường Vite cần định cấu hình bundle cẩn thận để tránh lỗi nạp động cơ ở client.
2. Sử dụng khóa duy nhất (như `ticketNo`) thay vì so sánh đếm số lượng bản ghi để tránh bỏ lỡ chuyến đi khi đồng bộ hóa sà lan.

### Cost Observations
- Model mix: 100% Gemini 3.5 Flash
- Sessions: 2
- Notable: Quá trình lưu trữ cột mốc diễn ra trơn tru nhờ công cụ gsd-tools tự động dọn dẹp các thư mục phase.

---

## Cross-Milestone Trends

### Process Evolution

| Milestone | Sessions | Phases | Key Change |
|-----------|----------|--------|------------|
| v1.0 | 2 | 4 | Initial release with client-side OCR & PDF utilities |

### Cumulative Quality

| Milestone | Tests | Coverage | Zero-Dep Additions |
|-----------|-------|----------|-------------------|
| v1.0 | 17 | N/A | pdfjs-dist, tesseract.js, docx, docx-preview, html2pdf.js |

### Top Lessons (Verified Across Milestones)

1. Zero-server client-side document processing is highly feasible and efficient using modern web tools.
