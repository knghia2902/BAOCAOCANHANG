# Phase 3: Document Conversion Pipelines - Pattern Mapping

This document maps the architectural and implementation patterns for the document conversion pipelines (DOCX to PDF and XLSX to PDF) based on the current codebase and project constraints.

## 1. Type Definitions for Conversion

**File:** `src/types/conversion.ts` (New)
**Role:** Defines TypeScript interfaces for conversion options, tracking progress, and returning results.
**Data Flow:** N/A (Type definitions only).
**Codebase Analog:** `src/types/pdf.ts` and `src/types/excel.ts`.
**Concrete Excerpts:**
```typescript
export interface ConversionProgressCallback {
    (message: string, percentage: number): void;
}

export interface ConversionOptions {
    onProgress?: ConversionProgressCallback;
}

export interface ConversionResult {
    success: boolean;
    filename?: string;
    error?: string;
}
```

## 2. Document Conversion Service

**File:** `src/services/conversion/DocumentConversionService.ts` (New)
**Role:** Encapsulates the logic for validating files, rendering DOCX/XLSX into a DOM container for user preview, and capturing that container into a PDF using `html2pdf.js`.
**Data Flow:**
- **Input:** A `File` object and an HTML DOM container (`HTMLElement`).
- **Parse & Render:** 
  - For **DOCX**: Uses `docx-preview`'s `renderAsync` with the file's `ArrayBuffer`.
  - For **XLSX**: Uses `ExcelService.readExcel` to parse via `exceljs`, then iterates over the first worksheet to build an HTML `<table>` injected into the container.
- **Export:** Dynamically imports `html2pdf.js` to avoid SSR/bundle issues (Pitfall 2), applies the PDF configuration (A4, portrait, margin 10mm, quality 0.98), captures the DOM container, and triggers the browser download.
**Codebase Analog:** 
- `src/services/pdf/PdfOcrService.ts` for the overall service class, singleton export, and `try/catch` error-handling pattern.
- `src/services/excel/ConverterService.ts` for file validation pattern and interacting with `ExcelService`.
**Concrete Excerpts:**
```typescript
import { ExcelService } from '@/services/excel/ExcelService';
import { renderAsync } from 'docx-preview';
import type { ConversionOptions, ConversionResult } from '@/types/conversion';

export class DocumentConversionService {
    private excelService: ExcelService;
    private readonly MAX_FILE_SIZE_MB = 15;

    constructor() {
        // Reuse ExcelService for its xlsx parsing and utility methods
        this.excelService = new ExcelService();
    }

    validateFile(file: File): { isValid: boolean; error?: string } {
        if (!this.excelService.validateFileSize(file, this.MAX_FILE_SIZE_MB)) {
            return { isValid: false, error: `File size exceeds ${this.MAX_FILE_SIZE_MB}MB limit` };
        }
        return { isValid: true };
    }

    async processDocxToPreview(file: File, container: HTMLElement, options?: ConversionOptions): Promise<ConversionResult> {
        const validation = this.validateFile(file);
        if (!validation.isValid) return { success: false, error: validation.error };

        options?.onProgress?.('Đọc file...', 0);
        
        try {
            const buffer = await file.arrayBuffer();
            options?.onProgress?.('Đang chuẩn bị render...', 20);
            
            // Render DOCX into the provided container
            await renderAsync(buffer, container, container, {
                inWrapper: false,
                ignoreWidth: false,
                ignoreHeight: false
            });
            options?.onProgress?.('Render preview hoàn tất', 70);
            
            return { success: true };
        } catch (error) {
            console.error('DOCX render failed:', error);
            return { success: false, error: error instanceof Error ? error.message : String(error) };
        }
    }

    async processXlsxToPreview(file: File, container: HTMLElement, options?: ConversionOptions): Promise<ConversionResult> {
        const validation = this.validateFile(file);
        if (!validation.isValid) return { success: false, error: validation.error };

        options?.onProgress?.('Đọc file...', 0);
        
        try {
            const workbook = await this.excelService.readExcel(file);
            options?.onProgress?.('Đang chuẩn bị render...', 20);
            
            const sheet = this.excelService.getWorksheet(workbook, 0); // D-04: Only first sheet
            if (!sheet) throw new Error('Không tìm thấy dữ liệu trong file Excel');
            
            // Build HTML table for preview
            let html = '<table class="min-w-full border-collapse border border-gray-300 text-sm">';
            sheet.eachRow((row) => {
                html += '<tr>';
                row.eachCell({ includeEmpty: true }, (cell) => {
                    // D-04: Empty cell handling is necessary to maintain layout alignment
                    const value = cell.value ?? '';
                    html += `<td class="border border-gray-300 px-2 py-1">${value}</td>`;
                });
                html += '</tr>';
            });
            html += '</table>';
            
            container.innerHTML = html;
            options?.onProgress?.('Render preview hoàn tất', 70);
            
            return { success: true };
        } catch (error) {
            console.error('XLSX render failed:', error);
            return { success: false, error: error instanceof Error ? error.message : String(error) };
        }
    }

    async exportToPdf(container: HTMLElement, originalFilename: string, options?: ConversionOptions): Promise<ConversionResult> {
        try {
            options?.onProgress?.('Đang xuất PDF...', 70);
            
            // CRITICAL PITFALL: Dynamic import required for html2pdf.js
            const html2pdf = (await import('html2pdf.js')).default;
            
            // D-07: Filename pattern
            const filename = originalFilename.replace(/\.[^/.]+$/, '') + '_converted.pdf';
            
            // D-06: PDF Output Configuration
            const opt = {
                margin: 10,
                filename: filename,
                image: { type: 'jpeg', quality: 0.98 },
                html2canvas: { scale: 2 },
                jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
            };
            
            await html2pdf().set(opt).from(container).save();
            options?.onProgress?.('Hoàn tất', 100);
            
            return { success: true, filename };
        } catch (error) {
            console.error('PDF export failed:', error);
            return { success: false, error: error instanceof Error ? error.message : String(error) };
        }
    }
}

// Export singleton instance
export const documentConversionService = new DocumentConversionService();
```
