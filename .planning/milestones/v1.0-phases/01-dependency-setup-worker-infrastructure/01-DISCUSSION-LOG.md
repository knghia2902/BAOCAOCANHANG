# Phase 1: Dependency Setup & Worker Infrastructure - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-29
**Phase:** 1-Dependency Setup & Worker Infrastructure
**Areas discussed:** PDF.js CDN Worker vs Local Bundling

---

## PDF.js CDN Worker vs Local Bundling

| Option | Description | Selected |
|--------|-------------|----------|
| **Tải từ CDN** | Dùng link cdnjs hoặc unpkg tương thích với version cài đặt — Đơn giản nhất, tránh các lỗi đóng gói (bundling) của Vite 7 trên môi trường Production và đúng với tiêu chí ROADMAP.md. | ✓ |
| **Đóng gói cục bộ (Local Bundling)** | Cấu hình Vite sử dụng Worker cục bộ để hỗ trợ hoàn toàn offline, nhưng cấu hình phức tạp hơn và có nguy cơ lỗi MIME type trên Vercel/Netlify. | |

**User's choice:** Tải từ CDN
**Notes:** Quyết định này giúp giảm thiểu rủi ro lỗi MIME type khi deploy lên môi trường Production, giảm dung lượng bundle ban đầu và đáp ứng chính xác tiêu chí thành công thứ 3 trong ROADMAP.md.

---

## the agent's Discretion

- **Phiên bản thư viện**: Cài đặt các phiên bản tương thích tốt nhất của `pdfjs-dist`, `tesseract.js`, `docx`, `docx-preview`, và `html2pdf.js` với Vite 7 + Vue 3.
- **Tesseract Training Data Source**: Sử dụng CDN tải dữ liệu huấn luyện ngôn ngữ để tối ưu hóa dung lượng repository.
- **Phương pháp xác thực**: Thiết kế Service chẩn đoán độc lập (Diagnostic Checker) in trạng thái sẵn sàng của Worker lên bảng điều khiển Console của trình duyệt.

## Deferred Ideas

None — discussion stayed within phase scope
