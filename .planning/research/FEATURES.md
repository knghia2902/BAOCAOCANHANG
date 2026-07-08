# Feature Research

**Domain:** Browser-based serverless PDF/Office conversion & OCR
**Researched:** 2026-05-29
**Confidence:** HIGH

## Feature Landscape

### Table Stakes (Users Expect These)

Features users assume exist. Missing these makes the file conversion tools feel buggy or unusable.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Digital PDF Text Extraction | Core capability to pull raw text without OCR for fast results. | LOW | Uses `pdfjs-dist` text item content. |
| Scanned PDF OCR | Allows extracting text from scanned pages or pictures. | HIGH | Uses `tesseract.js` worker on rendered canvases. |
| Table Grid Detection (PDF to Excel) | Reconstructs tables into rows/columns instead of raw text blocks. | HIGH | Requires grouping text blocks sharing similar Y coordinates. |
| Paragraph Recovery (PDF to Word) | Merges lines into readable text flows instead of single-line fragments. | MEDIUM | Group lines by X margin and vertical distance. |
| Conversion Progress Indicators | Conversion takes time (5-15 seconds per page for OCR). UI must not appear frozen. | MEDIUM | Map worker progress events to progress bar. |

### Differentiators (Competitive Advantage)

Features that elevate the quality of browser-based utilities.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Vietnamese Language OCR | Full support for accented characters in Vietnamese. | MEDIUM | Load `vie` training files into Tesseract.js. |
| Drag-and-Drop file processing | Premium, seamless user experience. | LOW | HTML5 Drag and Drop events. |
| Side-by-side Document Preview | Allows users to check output alignment before downloading. | MEDIUM | Render canvas preview of pages. |
| Excel Layout Styles preservation | Colors and cell widths matched in generated sheet. | MEDIUM | Translate PDF styles into `exceljs` properties. |

### Anti-Features (Commonly Requested, Often Problematic)

Features that seem good but create performance or scope creep issues.

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| Infinite file size uploads | Users want to convert massive 100MB+ documents. | Will crash browser memory (OOM) or lock the CPU thread. | Enforce a strict 15MB file size limit in the UI and show alerts. |
| Pixel-perfect layout preservation | Users want output Word/Excel files to look exactly like PDF styling. | Hard fixed layouts don't flow well when converted to text-reflowable formats (DOCX/XLSX). | Focus on extracting clean data, structured tables, and correct text hierarchies. |

## Feature Dependencies

```
[Upload PDF/Image]
     └──requires──> [pdfjs-dist Canvas Rendering]
                        └──requires──> [Tesseract.js OCR Worker]
                                           └──feeds──> [exceljs XLSX Builder]
                                           └──feeds──> [docx DOCX Builder]

[Word/Excel file upload] ──renders──> [docx-preview / html table] ──prints──> [html2pdf.js PDF output]
```

### Dependency Notes

- **OCR feeds document builders:** Before running `docx` or `exceljs`, the text/table data must be extracted and structured by the OCR worker.
- **Conversion previews depend on canvas renders:** Drawing to HTML canvas is necessary both for user visual preview and for Tesseract.js to read pixels for OCR.

## MVP Definition

### Launch With (v1)

- [ ] **PDF to XLSX conversion:** Digital text table parsing and XLSX file download.
- [ ] **PDF to DOCX conversion:** Raw text paragraph parsing and DOCX download.
- [ ] **OCR Image/PDF to Text:** Extracts text from scans/images, with Vietnamese and English language models.
- [ ] **DOCX/XLSX to PDF:** Converts simple documents to PDF via HTML intermediate print.
- [ ] **UI Integration:** Fully integrated tabs into the portfolio's `/tools` view.

### Add After Validation (v1.x)

- [ ] **Deep table column alignment:** Detect cell borders from PDF vector graphs for border-heavy tables.
- [ ] **Multi-page Excel generation:** Split PDF chapters into multiple worksheets.

### Future Consideration (v2+)

- [ ] **Cloud processing fallback:** Offloads large files (>15MB) to Supabase Edge Functions with a dedicated Python PDF converter.

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| PDF to XLSX (Table Extraction) | HIGH | HIGH | P1 |
| PDF to DOCX (Text Extraction) | HIGH | MEDIUM | P1 |
| Scanned PDF OCR (Tesseract) | HIGH | HIGH | P1 |
| Word/Excel to PDF | MEDIUM | MEDIUM | P1 |
| Progress Indicators & Cancel | HIGH | LOW | P1 |
| Side-by-side Preview | MEDIUM | MEDIUM | P2 |
| Custom cell border matching | LOW | HIGH | P3 |

---
*Feature research for: Browser-based serverless PDF/Office conversion & OCR*
*Researched: 2026-05-29*
