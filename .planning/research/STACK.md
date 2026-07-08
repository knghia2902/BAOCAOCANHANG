# Stack Research

**Domain:** Browser-based serverless PDF/Office conversion & OCR
**Researched:** 2026-05-29
**Confidence:** HIGH

## Recommended Stack

### Core Technologies

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| `pdfjs-dist` | ^4.0.0 | PDF Parsing & Text coordinate extraction | Industry-standard Mozilla project. Allows extracting text lines and positions to detect columns/tables. |
| `tesseract.js` | ^5.0.0 | Browser-based OCR | Pure JS port of Tesseract OCR. Executes in browser via Web Worker. High language coverage (including Vietnamese). |
| `docx` | ^8.2.0 | DOCX Generation | Generates structured Word documents (paragraphs, margins, tables) client-side from extracted text. |
| `html2pdf.js` | ^0.10.1 | HTML DOM to PDF | Integrates `html2canvas` and `jsPDF` to turn browser DOM elements (rendered Word/Excel previews) into PDF files. |

### Supporting Libraries

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `exceljs` | ^4.4.0 | Excel Reading & Writing | Already in project. Used to read spreadsheets (for XLSX -> PDF) and build sheets (for PDF -> XLSX). |
| `docx-preview` | ^0.1.20 | Render DOCX to HTML DOM | Needed for DOCX -> PDF pipeline to render Word binary data to the browser before printing to PDF. |
| `mammoth` | ^1.6.0 | Simple DOCX to HTML parser | Alternative lightweight DOCX parser for extracting clean text for rendering. |

### Development Tools

| Tool | Purpose | Notes |
|------|---------|-------|
| Web Workers | Background thread execution | Required to prevent Tesseract OCR and ExcelJS/PDFJS heavy parse loops from freezing the browser UI thread. |

## Installation

```bash
# Core
npm install pdfjs-dist tesseract.js docx html2pdf.js docx-preview mammoth
```

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| `tesseract.js` (Client-side) | Supabase Functions + Google Vision API | When absolute high-accuracy handwriting recognition is required, or for batch processing without using user CPU. |
| `html2pdf.js` (Client-side) | PDFKit / jsPDF direct drawing | When you need customized, page-by-page low-level drawing of PDFs rather than high-level HTML rendering. |

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| `pdf2json` | Server-side only (depends on Node `fs` and binary bindings) | `pdfjs-dist` for browser-compatible PDF rendering and extraction. |
| `docxtemplater` (Free version) | Severe feature restrictions and requires file templates | `docx` npm library for programmatic generation from scratch. |

## Stack Patterns by Variant

**If Scanned PDF is uploaded:**
- Use `pdfjs-dist` to render pages onto canvas elements.
- Use `tesseract.js` worker on each canvas to extract text lines via OCR.
- Feed OCR output to `docx` / `exceljs`.

**If Digital PDF is uploaded:**
- Use `pdfjs-dist` to fetch text objects directly from the file stream.
- Reconstruct text flow using position coordinates, skipping OCR (much faster and 100% accurate).

## Version Compatibility

| Package A | Compatible With | Notes |
|-----------|-----------------|-------|
| `pdfjs-dist@4.0.0` | Vite ^7.0.0 | Requires configuring Vite to ignore pdf.worker.js dynamic imports, or linking the worker file as an asset. |
| `tesseract.js@5.0.0` | Browser Web Workers | Worker scripts are downloaded from CDN by default; must configure local paths if offline support is required. |

## Sources

- [Mozilla PDF.js Docs](https://mozilla.github.io/pdf.js/) — Verified browser compatibility and text extraction APIs.
- [Tesseract.js GitHub](https://github.com/naptha/tesseract.js) — Verified web worker APIs and multi-language support.
- [DOCX NPM package](https://docx.js.org/) — Confirmed browser bundle size and file generation techniques.

---
*Stack research for: Browser-based serverless PDF/Office conversion & OCR*
*Researched: 2026-05-29*
