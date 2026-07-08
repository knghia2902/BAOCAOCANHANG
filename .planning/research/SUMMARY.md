# Project Research Summary

**Project:** Góc Nhỏ Tiện Ích Của Ánh (PDF & OCR Utilities)
**Domain:** Browser-based serverless PDF/Office conversion & OCR
**Researched:** 2026-05-29
**Confidence:** HIGH

## Executive Summary

This research establishes a technical blueprint for adding serverless, browser-only PDF conversion and OCR features to the portfolio dashboard. By executing all document parsing and image character recognition directly in the client browser, we eliminate backend cloud costs, maintain user document privacy, and allow static deployment on Netlify or Vercel.

The recommended approach uses **`pdfjs-dist`** for PDF loading and rendering, **`tesseract.js`** for browser-side OCR (with Vietnamese language support), **`exceljs`** and **`docx`** for file generation, and **`html2pdf.js`** for Word/Excel to PDF printing. Key technical challenges include offloading heavy processing to Web Workers to prevent browser tab lockups, cleaning up memory to avoid Out-Of-Memory (OOM) crashes, and configuring Vite to bundle the PDF worker correctly.

## Key Findings

### Recommended Stack

We recommend a serverless client-side JavaScript processing stack:
- **`pdfjs-dist` (Mozilla)**: Primary parser to load PDFs, read metadata, and render pages onto browser canvases.
- **`tesseract.js`**: Pure JS port of Tesseract OCR, executing in a background Web Worker to read text from scanned documents/images with Vietnamese character support.
- **`exceljs`**: Existing project dependency, utilized to reconstruct Excel cells and columns from coordinates.
- **`docx`**: Programmatic DOCX builder to generate structured Word documents client-side.
- **`html2pdf.js` (with `html2canvas` + `jsPDF`)**: Converts previewed HTML document renders into downloads.

### Expected Features

**Must have (table stakes):**
- Digital PDF text extraction (fast path without OCR).
- Scanned PDF and image OCR (English + Vietnamese models).
- Structured table extraction (PDF to Excel column proximity matching).
- Word paragraph recovery (PDF to DOCX line flow grouping).
- Responsive UI with conversion progress bars.
- Simple Word/Excel to PDF conversion.

**Should have (competitive):**
- Side-by-side file dropzone and visual canvas page preview.
- Excel style cell width matching.

**Defer (v2+):**
- Server-side fallback processing for files larger than 20MB.

### Architecture Approach

The architecture separates UI state, conversion orchestration services, and background workers:
1. **UI Layer (`PdfOcrTools.vue`)**: Multi-tab interface containing upload inputs, status trackers, and previews.
2. **Orchestrator (`PdfOcrService.ts`)**: Loads document buffers, tests for digital text layers, handles page iteration, and calls builders.
3. **Workers (`Tesseract.js` worker thread)**: Asynchronous OCR execution without blocking main thread.

### Critical Pitfalls

1. **Main UI Thread Lockup:** Heavy OCR blocks the page loop. *Solution: Mandate Tesseract Web Workers.*
2. **Worker Memory Leaks:** Web Workers and page canvases accumulate. *Solution: Enforce worker termination and canvas cleanup in try/finally blocks.*
3. **Vite Worker Relocation:** Production builds lose the PDF.js worker path. *Solution: Configure stable CDN worker path.*

## Implications for Roadmap

Based on research, the project roadmap will be structured into four sequential phases:

### Phase 1: Dependency Setup & Worker Infrastructure
- **Rationale:** Establishes the Web Worker architecture and loads packages before writing features.
- **Delivers:** Correct NPM installations, Vite config overrides, and a verified CDN PDF worker path.
- **Avoids:** Vite bundling errors in production.

### Phase 2: PDF Parsing & OCR Implementation
- **Rationale:** Builds the core extraction logic (digital coordinates mapping and OCR text reading).
- **Delivers:** `PdfOcrService.ts` backend wrapper with support for Vietnamese/English OCR models.
- **Addresses:** PDF-to-XLSX, PDF-to-DOCX, and OCR-to-Text requirements.
- **Avoids:** Main thread locks and memory leaks.

### Phase 3: Document Conversion Pipelines (Word/Excel to PDF)
- **Rationale:** Builds the backward conversion path (Office formats to PDF).
- **Delivers:** `docx-preview` rendering pipeline and `html2pdf` integration.
- **Addresses:** Word/Excel to PDF conversions.

### Phase 4: UI Integration & Formats Dashboard
- **Rationale:** Hooks up the services to the visual client interface.
- **Delivers:** `PdfOcrTools.vue` component containing progress bars, tabs, previews, and links it to `/tools`.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Library choices are standard, mature, and browser-tested. |
| Features | HIGH | Table extraction and OCR are well-supported client-side. |
| Architecture | HIGH | Decoupled services match the existing codebase architecture. |
| Pitfalls | HIGH | Main gotchas (workers, Vite, OOM) have proven solutions. |

**Overall confidence: HIGH**

## Sources

- [Mozilla PDF.js Docs](https://mozilla.github.io/pdf.js/)
- [Tesseract.js OCR engine GitHub](https://github.com/naptha/tesseract.js)
- [html2pdf.js library documentation](https://github.com/eKoopmans/html2pdf.js)

---
*Research completed: 2026-05-29*
*Ready for roadmap: yes*
