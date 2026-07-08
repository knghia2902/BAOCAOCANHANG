# Requirements: Góc Nhỏ Tiện Ích Của Ánh (PDF & OCR Utilities)

**Defined:** 2026-05-29
**Core Value:** Enable serverless, high-performance client-side document processing and formatting tools directly within the browser, keeping user files private and secure.

## v1 Requirements

Requirements for initial release. Each maps to roadmap phases.

### Conversion Core (CONV)

- [ ] **CONV-01**: User can parse text elements and coordinate layouts from uploaded digital PDFs client-side using `pdfjs-dist`.
- [x] **CONV-02**: User can convert parsed digital PDF table coordinates into an Excel (`.xlsx`) sheet with appropriate row/column cell boundaries.
- [x] **CONV-03**: User can convert parsed digital PDF text segments into a Word (`.docx`) document, preserving basic paragraph flows and headings.
- [ ] **CONV-04**: User can upload a Word (`.docx`) file, render a preview in the browser DOM, and convert it to a downloadable PDF file client-side.
- [ ] **CONV-05**: User can upload an Excel (`.xlsx`) sheet, render a preview as an HTML table, and convert it to a downloadable PDF file client-side.

### Optical Character Recognition (OCR)

- [ ] **OCR-01**: User can run OCR on scanned PDFs and images (PNG, JPG) in the browser to extract text lines using a `tesseract.js` worker.
- [ ] **OCR-02**: User can select OCR languages, supporting English and Vietnamese models (`eng+vie`).
- [ ] **OCR-03**: User receives real-time progress callbacks (status, percentage complete) during OCR execution.
- [x] **OCR-04**: User can export OCR text results directly to the Excel (.xlsx) and Word (.docx) generators.

### User Interface (UI)

- [ ] **UI-01**: User can access the PDF/OCR utility dashboard through a new integrated tab structure on the portfolio's `/tools` page.
- [ ] **UI-02**: User can upload documents via a drag-and-drop file dropzone with validation enforcing a 15MB file size limit.
- [ ] **UI-03**: User can view a side-by-side progress bar and status spinner during heavy processing phases.

## v2 Requirements

Deferred to future release. Tracked but not in current roadmap.

### Advanced Formatting

- **CONV-06**: Complex PDF table border vector-matching for grid-heavy sheets.
- **CONV-07**: Multi-worksheet output support for multi-chapter PDF files.
- **OCR-05**: Client-side canvas pre-processing filters (binarization, contrast, rotation correction) to enhance low-quality mobile scans.

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| Cloud-side conversion API | High server hosting costs and compromises user document privacy. All code must run client-side. |
| Pixel-perfect styling matching | Unfeasible for complex client-side document conversions. Focus is on content structure. |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| CONV-01 | Phase 2 | Pending |
| CONV-02 | Phase 2 | Completed |
| CONV-03 | Phase 2 | Completed |
| CONV-04 | Phase 3 | Pending |
| CONV-05 | Phase 3 | Pending |
| OCR-01 | Phase 2 | Pending |
| OCR-02 | Phase 2 | Pending |
| OCR-03 | Phase 2 | Pending |
| OCR-04 | Phase 2 | Completed |
| UI-01 | Phase 4 | Pending |
| UI-02 | Phase 4 | Pending |
| UI-03 | Phase 4 | Pending |

**Coverage:**
- v1 requirements: 12 total
- Mapped to phases: 12
- Unmapped: 0 ✓

---
*Requirements defined: 2026-05-29*
*Last updated: 2026-05-29 after initial definition*
