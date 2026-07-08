# Pitfalls Research

**Domain:** Browser-based serverless PDF/Office conversion & OCR
**Researched:** 2026-05-29
**Confidence:** HIGH

## Critical Pitfalls

### Pitfall 1: Browser Thread Blocking (UI Freezes)

**What goes wrong:**
During Tesseract OCR or deep PDF parsing, the browser becomes unresponsive. Buttons cannot be clicked, spinners freeze, and the browser may prompt the user to "Kill Page".

**Why it happens:**
The CPU-heavy OCR text extraction and text line sorting algorithms are executed on the main UI thread instead of background threads.

**How to avoid:**
Use `tesseract.js`'s built-in Web Worker configuration. For coordinate parsing and layout reconstruction, run processing in chunks using `requestAnimationFrame` or delegate to custom Web Workers.

**Warning signs:**
UI loading spinners stop spinning during conversion. Console warnings about long tasks taking >500ms.

**Phase to address:**
Phase 2 (Core Parsing & Web Worker Setup).

---

### Pitfall 2: Memory Leaks from Unreleased Web Workers

**What goes wrong:**
Memory usage climbs with each conversion. After 3-4 file conversions, the browser tab runs out of memory (OOM) and crashes.

**Why it happens:**
Tesseract.js workers are spawned on every file upload but are never terminated. PDF.js document pages are loaded into memory but never destroyed.

**How to avoid:**
Wrap conversion tasks in `try/finally` blocks. In the `finally` block, call `worker.terminate()` on the Tesseract worker and call `pdfDoc.destroy()` on the loaded PDF object.

**Warning signs:**
Browser tab RAM consumption continues to grow in Task Manager after a conversion finishes and the file is downloaded.

**Phase to address:**
Phase 2 (Core Parsing & Web Worker Setup).

---

### Pitfall 3: Vite Bundling Failures with PDF.js Workers

**What goes wrong:**
The PDF.js parser fails to run in production builds, throwing errors like "Setting up worker failed" or "WorkerSrc is not specified".

**Why it happens:**
Vite's bundler relocates the external worker file `pdf.worker.js` during compilation, breaking the relative path.

**How to avoid:**
Configure PDF.js to load the worker script from a matching CDN package. Set:
`pdfjs.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.0.379/pdf.worker.min.mjs'` (ensure the CDN version matches the installed NPM package version exactly).

**Warning signs:**
The PDF tool works locally during `npm run dev` but crashes immediately upon deployment on Netlify/Vercel.

**Phase to address:**
Phase 3 (Integration and UI Setup).

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Skipping image pre-processing | Saves coding time on canvas manipulation | Poor OCR accuracy for low-light photos or scanned files | v1 launch, provided users upload clean digital scans |
| Single-row Y-coordinate grouping | Easy to code row reconstruction | Mismatched rows for multi-line cells or merged cells | v1 launch; tables must have simple cell boundaries |

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| Tesseract.js Vietnamese model | Only loading English language (`eng`) | Load both models together: `await worker.loadLanguage('eng+vie')` and initialize with `await worker.initialize('eng+vie')`. |
| html2pdf.js scaling | Generated PDF pages cut off text at margins | Explicitly configure the viewport size and configure margins in `html2pdf` options (e.g. `margin: 10`, `image: { type: 'jpeg', quality: 0.98 }`). |

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| No progress status | Users assume the app crashed and close the tab | Show a progress bar indicating: "Loading PDF...", "Running OCR (Page 1/3)... [35%]" |
| Output file formatting mess | Excel tables look scrambled with text overlaps | Auto-fit column widths using cell string length calculations before saving via `exceljs`. |

## "Looks Done But Isn't" Checklist

- [ ] **OCR Conversion:** Appears to work on simple PNG images, but fails on multi-page scanned PDFs — verify by testing a 3-page scanned PDF file.
- [ ] **Word/Excel to PDF:** Works on simple text, but fails to render images or grids — verify by converting a DOCX file containing tables and headers.

---
*Pitfalls research for: Browser-based serverless PDF/Office conversion & OCR*
*Researched: 2026-05-29*
