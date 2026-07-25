# Phase 2: PDF Parsing & OCR Implementation - Patterns

## Target Files Map
| Proposed File | Role | Closest Analog | Relationship |
|---|---|---|---|
| `src/types/pdf.ts` | Type Definition | `src/types/excel.ts` | Khai báo các interface và enum cho PDF và OCR. |
| `src/services/pdf/CoordinateSorter.ts` | Utility Service | `src/services/excel/MergerService.ts` | Cung cấp thuật toán gom nhóm dòng (Y-coordinate) và gom cột (X-coordinate). |
| `src/services/pdf/DocumentBuilder.ts` | Builder Service | `src/services/excel/ExcelService.ts` | Lắp ráp các dòng/cột thành file `.docx` (docx.js) hoặc `.xlsx` (exceljs). |
| `src/services/pdf/PdfOcrService.ts` | Orchestrator Service | `src/services/excel/ConverterService.ts` | Điều phối toàn bộ quá trình đọc digital PDF, vẽ canvas chạy OCR, báo tiến trình, chạy Sorter và Builder. |

---

## Architectural Roles & Data Flow

```mermaid
graph TD
    A[UI Component / File Upload] -->|Upload File & Options| B[PdfOcrService]
    B -->|Check File Type & Use OCR?| C{Decision}
    C -->|Digital PDF & No OCR| D[Extract Text via PDF.js getTextContent]
    C -->|Scanned PDF or Use OCR| E[Render Page to Canvas @ 2.0x & run Tesseract Web Worker]
    
    D -->|Array of TextElement| F[CoordinateSorter.groupElementsByY]
    E -->|Array of TextElement| F
    
    F -->|LineGroup[]| G{Target Format?}
    
    G -->|Word .docx| H[DocumentBuilder.buildWordDocument]
    G -->|Excel .xlsx| I[CoordinateSorter.mapToExcelGrid]
    
    I -->|Grid string[][]| J[DocumentBuilder.buildExcelDocument]
    
    H -->|ArrayBuffer| K[Return PdfOcrResult]
    J -->|ArrayBuffer| K
    
    K -->|Download / Preview| A
```

---

## Code Excerpts & Coding Conventions

### 1. Types & Interfaces (Analog: `src/types/excel.ts`)
Tất cả các định nghĩa kiểu dữ liệu sẽ tuân thủ chuẩn PascalCase cho Interface và UPPER_SNAKE_CASE hoặc PascalCase cho Enum/Object Readonly.
```typescript
// src/types/pdf.ts

export interface TextElement {
    text: string;
    x: number;
    y: number;
    width: number;
    height: number;
    fontSize: number;
}

export interface LineGroup {
    y: number;
    averageFontSize: number;
    elements: TextElement[];
}

export const PdfOcrTargetFormat = {
    WORD: 'docx',
    EXCEL: 'xlsx'
} as const;

export type PdfOcrTargetFormat = typeof PdfOcrTargetFormat[keyof typeof PdfOcrTargetFormat];

export interface PdfOcrOptions {
    targetFormat: PdfOcrTargetFormat;
    useOcr?: boolean;
    onProgress?: (message: string, percentage: number) => void;
}

export interface PdfOcrResult {
    success: boolean;
    data?: ArrayBuffer;
    filename: string;
    mimeType: string;
    error?: string;
}
```

### 2. Service Singleton Pattern (Analog: `src/services/excel/ConverterService.ts`)
Tất cả các Service file đều export một class có constructor và export một thực thể singleton duy nhất ở cuối file. Thụt lề sử dụng đúng 4-space indentation, dấu chấm phẩy kết thúc câu lệnh bắt buộc.
```typescript
// src/services/pdf/PdfOcrService.ts
import * as pdfjsLib from 'pdfjs-dist';
import { createWorker } from 'tesseract.js';
import type { PdfOcrOptions, PdfOcrResult } from '@/types/pdf';

export class PdfOcrService {
    private static PDF_WORKER_VERSION = '5.7.284';

    constructor() {
        // Khởi tạo các thuộc tính nếu cần
    }

    async process(file: File, options: PdfOcrOptions): Promise<PdfOcrResult> {
        try {
            // Cài đặt workerSrc CDN giống DiagnosticService
            pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${PdfOcrService.PDF_WORKER_VERSION}/pdf.worker.min.mjs`;

            // Logic xử lý chính ...
            return {
                success: true,
                filename: file.name.replace(/\.[^/.]+$/, '') + `.${options.targetFormat}`,
                mimeType: options.targetFormat === 'docx' 
                    ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
                    : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                data: new ArrayBuffer(0) // thay thế bằng buffer thực tế
            };
        } catch (error) {
            console.error('PDF/OCR Processing failed:', error);
            return {
                success: false,
                filename: '',
                mimeType: '',
                error: error instanceof Error ? error.message : String(error)
            };
        }
    }
}

export const pdfOcrService = new PdfOcrService();
```

### 3. File Generation & Writing Pattern (Analog: `src/services/excel/ExcelService.ts` & `MergerService.ts`)
Sử dụng các thư viện `exceljs` và `docx` để tạo workbook/document và chuyển đổi sang ArrayBuffer nhị phân. Không sử dụng các phương thức lưu file trực tiếp trong service mà trả về ArrayBuffer để bên ngoài (ví dụ component UI) tự gọi tải hoặc preview.
```typescript
// src/services/pdf/DocumentBuilder.ts
import * as ExcelJS from 'exceljs';
import { Document, Packer, Paragraph, TextRun } from 'docx';
import type { LineGroup } from '@/types/pdf';

export class DocumentBuilder {
    /**
     * Build excel file from coordinate grid
     */
    async buildExcelDocument(grid: string[][]): Promise<ArrayBuffer> {
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Extracted Text');

        for (const row of grid) {
            worksheet.addRow(row);
        }

        // Auto-fit columns (tương tự như ConverterService.ts)
        worksheet.columns.forEach(column => {
            if (column && column.eachCell) {
                let maxLength = 0;
                column.eachCell({ includeEmpty: false }, cell => {
                    const cellValue = cell.value ? String(cell.value) : '';
                    maxLength = Math.max(maxLength, cellValue.length);
                });
                column.width = Math.min(maxLength + 2, 50);
            }
        });

        const buffer = await workbook.xlsx.writeBuffer();
        return buffer as ArrayBuffer;
    }

    /**
     * Build word document (.docx) from Y-coordinate groups
     */
    async buildWordDocument(lines: LineGroup[]): Promise<ArrayBuffer> {
        const children: Paragraph[] = [];

        for (const line of lines) {
            const lineText = line.elements.map(e => e.text).join(' ');
            
            // Check heading heuristic
            const isHeading = line.averageFontSize > 18; 
            
            children.push(
                new Paragraph({
                    children: [
                        new TextRun({
                            text: lineText,
                            size: isHeading ? 32 : 24, // 16pt vs 12pt
                            bold: isHeading
                        })
                    ],
                    spacing: { after: 120 }
                })
            );
        }

        const doc = new Document({
            sections: [{ properties: {}, children }]
        });

        const blob = await Packer.toBlob(doc);
        return await blob.arrayBuffer();
    }
}

export const documentBuilder = new DocumentBuilder();
```

### 4. Tesseract Web Worker Lifecycle and Progress (Analog: `src/services/infrastructure/DiagnosticService.ts`)
Để tránh rò rỉ bộ nhớ (memory leaks), Tesseract Worker bắt buộc phải được bọc trong block `try-finally` để gọi lệnh `.terminate()` dọn dẹp tài nguyên khi xảy ra sự cố.
```typescript
// Trích xuất từ PdfOcrService.ts khi chạy OCR
const worker = await createWorker('eng+vie', 1, {
    logger: (m) => {
        if (m.status === 'recognizing text' && options.onProgress) {
            // Tính toán tiến trình trang hiện tại kết hợp tiến trình chung
            const pageProgress = m.progress;
            const currentPercentage = Math.round(
                ((currentPageIdx + pageProgress) / totalPages) * 100
            );
            options.onProgress(`OCR Page ${currentPageIdx + 1}/${totalPages}: ${Math.round(pageProgress * 100)}%`, currentPercentage);
        }
    }
});

try {
    // Xử lý các trang PDF qua canvas
} finally {
    await worker.terminate();
}
```

---

## Anti-Patterns to Avoid
1. **Lạm dụng khởi tạo Worker**: Tránh tạo mới Worker cho mỗi trang trong một tài liệu PDF nhiều trang. Khởi tạo một lần và tái sử dụng cho tất cả các trang của cùng một file.
2. **Hard-coded Y Threshold**: Không sử dụng ngưỡng tĩnh cố định (như `5px`) để nhóm các từ trên cùng dòng. Hãy áp dụng thuật toán ngưỡng động bằng $50\%$ kích thước trung bình của font chữ thuộc phần tử/dòng đó theo quyết định **D-01**.
3. **Mất diacritics tiếng Việt**: Đảm bảo vẽ PDF Canvas ở scale đúng `2.0x` theo quyết định **D-02** và cấu hình ngôn ngữ `eng+vie` theo quyết định **D-03**.
4. **Không giải phóng bộ nhớ**: Quên gọi `worker.terminate()` trong block `finally` dẫn đến việc tab trình duyệt bị tràn RAM và sập khi người dùng thực hiện chuyển đổi liên tiếp.
