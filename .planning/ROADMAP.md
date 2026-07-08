# Roadmap: Góc Nhỏ Tiện Ích Của Ánh (PDF & OCR Utilities)

## Overview

Implement serverless, client-side PDF document parsing, Optical Character Recognition (OCR), and file formatting conversions directly in the browser using Web Workers. This roadmap goes from installing core dependencies to writing text/table coordinate grouping algorithms, setting up background Tesseract.js threads, building HTML-to-PDF preview streams, and deploying the new utilities tab inside the Vue 3 portfolio app.

## Phases

- [x] **Phase 1: Dependency Setup & Worker Infrastructure** - Install packages and configure Vite. (completed 2026-05-29)
- [x] **Phase 2: PDF Parsing & OCR Implementation** - Build coordinate line parsers and Tesseract.js workers. (completed 2026-05-29)
- [ ] **Phase 3: Document Conversion Pipelines** - Implement DOCX/XLSX to PDF conversion paths.
- [ ] **Phase 4: UI Integration & Formats Dashboard** - Design tabs, dropzones, and progress indicators.

## Phase Details

### Phase 1: Dependency Setup & Worker Infrastructure
**Goal**: Install core packages and resolve Vite/TypeScript worker bundling configurations.
**Depends on**: Nothing
**Requirements**: Foundational setup
**Success Criteria** (what must be TRUE):
  1. File conversion and OCR dependencies are added to `package.json`.
  2. The application compiles and runs without Vite/TypeScript compilation errors.
  3. The PDF.js CDN worker resolves successfully.
**Plans**: 2 plans

Plans:
- [x] 01-01: Install npm dependencies and adjust TSConfig/Vite settings.
- [x] 01-02: Create worker configuration wrappers and test loading states.

### Phase 2: PDF Parsing & OCR Implementation
**Goal**: Build core parsing algorithms, Y-coordinate text grouping, and Tesseract.js web workers.
**Depends on**: Phase 1
**Requirements**: CONV-01, CONV-02, CONV-03, OCR-01, OCR-02, OCR-03, OCR-04
**Success Criteria** (what must be TRUE):
  1. System parses text from digital PDFs and sorts them into table coordinates.
  2. OCR engine extracts text from scanned image/PDF buffers.
  3. Real-time percentage progress callbacks fire during OCR execution.
  4. Structured Excel (.xlsx) and Word (.docx) file buffers are successfully built from text layers.
**Plans**: 3 plans

Plans:
- [x] 02-01: Write `PdfOcrService.ts` and implementation for digital PDF text coordinate grouping.
- [x] 02-02: Implement Tesseract.js worker with English and Vietnamese models for scanned files.
- [x] 02-03: Create output spreadsheet (`exceljs`) and document (`docx`) builders.

### Phase 3: Document Conversion Pipelines
**Goal**: Build DOCX and XLSX to PDF conversion paths using HTML DOM printing.
**Depends on**: Phase 2
**Requirements**: CONV-04, CONV-05
**Success Criteria** (what must be TRUE):
  1. Uploaded Word files are rendered as browser HTML pages via `docx-preview`.
  2. Uploaded spreadsheets are converted to HTML tables in the DOM.
  3. Previews are successfully compiled and downloaded as PDF documents via `html2pdf.js`.
**Plans**: 2 plans

Plans:
- [x] 03-01: Build DOCX -> PDF pipeline using `docx-preview` and `html2pdf.js`.
- [x] 03-02: Build XLSX -> PDF pipeline using Excel parsing and `html2pdf.js`.

### Phase 4: UI Integration & Formats Dashboard
**Goal**: Create responsive UI views, drag-and-drop dropzones, and link them to `/tools`.
**Depends on**: Phase 3
**Requirements**: UI-01, UI-02, UI-03
**Success Criteria** (what must be TRUE):
  1. PDF and OCR tools are accessible via tabs on the `/tools` page.
  2. Drag-and-drop dropzone rejects files larger than 15MB.
  3. Conversion progress indicators display stages and completion percentages.
**Plans**: 2 plans

Plans:
- [ ] 04-01: Design the `PdfOcrTools.vue` tabs, drag-and-drop panel, and progress indicators.
- [x] 04-02: Integrate views with PdfOcrService and style using Tailwind CSS.

## Progress

Phases execute in numeric order: 1 → 2 → 3 → 4

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Setup | 2/2 | Complete   | 2026-05-29 |
| 2. Parsing & OCR | 3/3 | Complete   | 2026-05-29 |
| 3. Pipelines | 0/2 | Not started | - |
| 4. UI Dashboard | 0/2 | Not started | - |
