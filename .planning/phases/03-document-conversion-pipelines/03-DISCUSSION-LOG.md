# Phase 3: Document Conversion Pipelines - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-29
**Phase:** 03-document-conversion-pipelines
**Areas discussed:** DOCX strategy, XLSX strategy, PDF output config, File handling & limits

---

## DOCX → PDF Conversion Strategy

| Option | Description | Selected |
|--------|-------------|----------|
| Render-then-print | Dùng `docx-preview.renderAsync()` hiển thị Word thành HTML trong container, rồi `html2pdf.js` chụp thành PDF | ✓ |
| Direct-convert | Parse DOCX XML tự tay rồi tạo PDF bằng jsPDF API | |

**User's choice:** Render-then-print
**Notes:** Đơn giản, dùng đúng thư viện đã cài từ Phase 1.

---

## DOCX Preview Behavior

| Option | Description | Selected |
|--------|-------------|----------|
| Hiển thị preview trước | Người dùng thấy bản xem trước, rồi nhấn nút tải PDF | ✓ |
| Tải thẳng | Render ẩn, tự động tải PDF | |
| Cả hai | Preview + nút tải | |

**User's choice:** Hiển thị preview trước khi tải
**Notes:** Người dùng cần xem trước tài liệu trước khi xuất PDF.

---

## XLSX → PDF Conversion Strategy

| Option | Description | Selected |
|--------|-------------|----------|
| Dùng `exceljs` có sẵn | Parse workbook bằng `exceljs`, render thành HTML `<table>`, rồi `html2pdf.js` chuyển PDF | ✓ |
| Dùng `SheetJS` | Parse bằng SheetJS và `XLSX.utils.sheet_to_html()`. Cần thêm dependency mới | |

**User's choice:** Dùng `exceljs` có sẵn
**Notes:** Tái sử dụng thư viện đã cài và đang dùng trong ConverterService.

---

## Multi-sheet Handling

| Option | Description | Selected |
|--------|-------------|----------|
| Chỉ sheet đầu tiên | Render sheet đầu tiên làm mặc định | ✓ |
| Tất cả sheets | Gom tất cả sheets thành 1 PDF | |
| Cho chọn sheet | Dropdown để chọn sheet | |

**User's choice:** Chỉ sheet đầu tiên
**Notes:** Đơn giản cho v1. Multi-sheet (CONV-07) là v2 feature.

---

## XLSX Preview Behavior

| Option | Description | Selected |
|--------|-------------|----------|
| Giống DOCX | Hiển thị HTML table preview trước, nhấn nút tải PDF | ✓ |
| Tải thẳng | Tự động xuất PDF không preview | |

**User's choice:** Giống DOCX — UX nhất quán
**Notes:** Cả DOCX và XLSX đều follow: Upload → Preview → Export PDF.

---

## PDF Output Config

| Option | Description | Selected |
|--------|-------------|----------|
| A4, margin 10mm, quality 0.98 | Chuẩn văn phòng Việt Nam | ✓ |
| Letter, margin 1 inch | Chuẩn Mỹ | |
| Cho phép chọn | Dropdown chọn khổ giấy | |

**User's choice:** A4, margin 10mm, chất lượng 0.98
**Notes:** Phổ biến nhất cho tài liệu văn phòng Việt Nam.

---

## Output Filename

| Option | Description | Selected |
|--------|-------------|----------|
| Tên gốc + _converted.pdf | `baocao.docx` → `baocao_converted.pdf` | ✓ |
| Giữ tên + đổi đuôi | `baocao.docx` → `baocao.pdf` | |

**User's choice:** Tên gốc + `_converted.pdf`
**Notes:** Phân biệt rõ file gốc và file đã chuyển đổi.

---

## File Size Limit

| Option | Description | Selected |
|--------|-------------|----------|
| 15MB | Giống giới hạn dropzone UI-02 | ✓ |
| 20MB | Giới hạn tối đa từ PROJECT.md | |
| 10MB | An toàn hơn cho máy yếu | |

**User's choice:** 15MB
**Notes:** Nhất quán với REQUIREMENTS.md UI-02.

---

## Progress Reporting

| Option | Description | Selected |
|--------|-------------|----------|
| Progress 3 giai đoạn | Đọc file (20%) → Render preview (50%) → Xuất PDF (30%). Status text + percentage | ✓ |
| Chỉ spinner | Loading spinner đơn giản | |
| Agent tự chọn | Agent quyết định | |

**User's choice:** Progress chia 3 giai đoạn
**Notes:** Status text + percentage cho trải nghiệm tốt hơn.

---

## Agent's Discretion

- Cách tổ chức file/class service
- Styling CSS cho preview container
- Error handling chi tiết

## Deferred Ideas

- Multi-sheet XLSX export (CONV-07) — v2
- Cho phép chọn khổ giấy/orientation — v2 hoặc Phase 4
