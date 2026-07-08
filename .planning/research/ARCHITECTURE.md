# Architecture Research

**Domain:** Browser-based serverless PDF/Office conversion & OCR
**Researched:** 2026-05-29
**Confidence:** HIGH

## Standard Architecture

### System Overview

```
┌─────────────────────────────────────────────────────────────┐
│                       UI Component Layer                    │
│   - PdfOcrTools.vue (tab bar, dropzone, previews, settings) │
├─────────────────────────────────────────────────────────────┤
│                    Orchestration Service                    │
│   - PdfOcrService.ts (PDF loading, text line sorting)       │
├─────────────────────────────────────────────────────────────┤
│                    Domain Services Layer                    │
│  ┌────────────────┐  ┌──────────────┐  ┌─────────────────┐  │
│  │  OCR Service   │  │  PDF Parser  │  │ Doc Generators  │  │
│  │ (Tesseract.js) │  │ (pdfjs-dist) │  │(exceljs & docx) │  │
│  └────────────────┘  └──────────────┘  └─────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

### Component Responsibilities

| Component | Responsibility | Typical Implementation |
|-----------|----------------|------------------------|
| `PdfOcrTools.vue` | UI layout, drag & drop, file selection, preview generation, and status states. | Vue SFC template using composition setup, displaying tab panes. |
| `PdfOcrService.ts` | Orchestrates workflow (parsing digital text vs rendering canvas for OCR, sorting lines). | Namespace object exporting document conversion coordinate flows. |
| `Tesseract.js` Worker | Runs heavy OCR processing in a separate background thread. | Web Worker script instantiated via `tesseract.js` scheduler. |
| Document Builders | Turn 2D array coordinates into downloadable files. | `exceljs` sheets and `docx` paragraph components. |

## Recommended Project Structure

```
src/
├── components/
│   └── tools/
│       ├── ExcelMerger.vue      # Existing tool
│       ├── FormatConverter.vue  # Existing tool
│       └── PdfOcrTools.vue      # [NEW] PDF & OCR conversion UI view
├── services/
│   ├── excel/
│   │   ├── ExcelService.ts      # Low-level ExcelJS helpers
│   │   ├── PdfOcrService.ts     # [NEW] Orchestrates OCR and PDF extraction logic
│   │   └── MergerService.ts     # Existing merger
│   └── storage/
│       └── StorageService.ts    # Supabase upload/delete
└── types/
    ├── excel.ts                 # Existing types
    └── pdfocr.ts                # [NEW] Types for OCR language and conversion states
```

### Structure Rationale

- **src/components/tools/:** Groups all interactive utility views in a single location for easy maintenance.
- **src/services/excel/:** Houses both the existing Excel services and the new PDF-to-Excel and PDF-to-Word coordinate parser classes to keep document processing modules cohesive.

## Architectural Patterns

### Pattern 1: Coordinate Row/Column Reconstruction (Table Extraction)

**What:** Digital PDFs do not store table layouts. They only store single characters or words with absolute (X, Y) coordinates. To rebuild rows and columns, we must group text items that are on the same vertical level.
**When to use:** Used when converting PDF to Excel (.xlsx).
**Trade-offs:** Fast and lightweight, but can get confused by merged cells or irregular vertical alignments.

**Example:**
```typescript
// Sort text items by vertical position (Y coordinate)
// Allow a small tolerance (e.g. 5 pixels) to group items into the same row
function reconstructRows(textItems: Array<{ text: string, x: number, y: number }>) {
    // Sort items primarily by Y (descending) and secondarily by X (ascending)
    textItems.sort((a, b) => (b.y - a.y) || (a.x - b.x));
    
    const rows: string[][] = [];
    let currentRow: Array<{ text: string, x: number }> = [];
    let lastY = -1;
    const tolerance = 5; // Pixels
    
    for (const item of textItems) {
        if (lastY === -1 || Math.abs(item.y - lastY) <= tolerance) {
            currentRow.push(item);
        } else {
            // Sort previous row horizontally by X coordinate
            currentRow.sort((a, b) => a.x - b.x);
            rows.push(currentRow.map(c => c.text));
            currentRow = [item];
        }
        lastY = item.y;
    }
    if (currentRow.length > 0) {
        currentRow.sort((a, b) => a.x - b.x);
        rows.push(currentRow.map(c => c.text));
    }
    return rows;
}
```

### Pattern 2: Web Worker Offloading for OCR

**What:** Instantiating the Tesseract.js Worker in a separate browser thread using web workers.
**When to use:** Mandatory for all OCR operations to keep the UI interactive and prevent page freezes.
**Trade-offs:** Requires worker lifecycle management (terminating worker when done to prevent memory leaks).

## Data Flow

### PDF Conversion Flow

```
[File Uploaded]
     ↓
[PdfOcrService: Read PDF structure]
     ↓
[Check: Does PDF have digital text?]
 ├── Yes ──> [Extract text & X,Y coordinates] ──> [Group into Rows/Cols]
 └── No  ──> [Render page to Canvas] ──> [Tesseract OCR Worker] ──> [Extract strings]
                                                                         ↓
[Download Result] <── [Generate XLSX/DOCX Buffer] <──────────────────────┘
```

## Scaling Considerations

| Scale | Architecture Adjustments |
|-------|--------------------------|
| 1-5 pages | Normal browser thread processing is fast (5-15 seconds total). |
| 5-20 pages | Memory consumption grows. Web Workers and progress updates are critical to prevent browser crashes. |
| 20+ pages | Pure browser conversion becomes highly prone to Out-Of-Memory. Show a UI warning recommending files be split, or use page throttling. |

---
*Architecture research for: Browser-based serverless PDF/Office conversion & OCR*
*Researched: 2026-05-29*
