# Phase 1: Dependency Setup & Worker Infrastructure - Patterns

## Target Files Map
| Proposed File | Role | Closest Analog | Relationship |
|---|---|---|---|
| `src/services/infrastructure/DiagnosticService.ts` | Service | `src/services/excel/ConverterService.ts` | Cùng cấu trúc Class Service bao gói các logic bên ngoài. |
| `src/types/docx-preview.d.ts` | Type Decl | `src/vite-env.d.ts` | Khai báo kiểu TypeScript cho các package JS thiếu file declaration. |

## Code Excerpts

### Service Class Pattern (Analog: `ConverterService.ts`)
```typescript
import { ExcelService } from './ExcelService';
import type { ConversionOptions, ConversionResult, FileValidation } from '@/types/excel';

export class ConverterService {
    private excelService: ExcelService;

    constructor() {
        this.excelService = new ExcelService();
    }

    async excelToCsv(file: File, sheetIndex: number = 0): Promise<ConversionResult> {
        try {
            // Logic xử lý có bọc try-catch
            return {
                success: true,
                // ...
            };
        } catch (error) {
            console.error('Error details:', error);
            return {
                success: false,
                error: String(error)
            };
        }
    }
}
```

### TypeScript Module Declaration Pattern (Analog: `src/vite-env.d.ts`)
```typescript
/// <reference types="vite/client" />
```

Chúng ta sẽ khai báo cho `docx-preview` trong `src/types/docx-preview.d.ts` tương tự:
```typescript
declare module 'docx-preview' {
    export function renderAsync(
        document: Blob | ArrayBuffer | Uint8Array,
        bodyContainer: HTMLElement,
        styleContainer?: HTMLElement | null,
        options?: any
    ): Promise<any>;
}
```
