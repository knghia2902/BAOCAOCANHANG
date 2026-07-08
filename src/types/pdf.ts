// PDF and OCR type definitions

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
    pagesGrids?: string[][][];
}
