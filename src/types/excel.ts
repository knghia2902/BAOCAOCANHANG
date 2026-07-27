// Excel Tool Type Definitions
// Stage 3: TypeScript types for Format Converter

/**
 * Supported conversion formats
 */
export const ConversionFormat = {
    EXCEL: 'xlsx',
    CSV: 'csv',
    JSON: 'json'
} as const;

export type ConversionFormat = typeof ConversionFormat[keyof typeof ConversionFormat];

/**
 * Options for file conversion
 */
export interface ConversionOptions {
    sourceFormat: ConversionFormat;
    targetFormat: ConversionFormat;
    preserveFormatting?: boolean;
    sheetIndex?: number; // For multi-sheet Excel (0-based)
    sheetName?: string; // Alternative to sheetIndex
    includeHeaders?: boolean; // For CSV/JSON conversion
}

/**
 * Result of a conversion operation
 */
export interface ConversionResult {
    success: boolean;
    data?: ArrayBuffer | string | Blob;
    filename: string;
    mimeType: string;
    error?: string;
    warnings?: string[];
}

/**
 * File upload validation result
 */
export interface FileValidation {
    isValid: boolean;
    format?: ConversionFormat;
    size: number;
    error?: string;
}

/**
 * Conversion progress (for future use)
 */
export interface ConversionProgress {
    stage: 'reading' | 'processing' | 'writing' | 'complete';
    percentage: number;
    message: string;
}

/**
 * Options for Smart Merge
 */
export interface MergeOptions {
    masterFile: File;
    otherFiles: File[];
    matchKey: string;
    headerRow: number;
    skipEmpty?: boolean;
    mergeType?: 'exact' | 'fuzzy';
    fuzzyThreshold?: number;
}

/**
 * Result of a merge operation
 */
export interface MergeResult {
    success: boolean;
    buffer?: ArrayBuffer;
    filename: string;
    mimeType: string;
    successCount: number;
    errors: string[];
    matchedRows: number;
    newRowsAdded: number;
    fuzzyMatches: number;
    error?: string;
}

/**
 * Record of a warehouse weighbridge ticket (nhập hàng nhà máy -> kho)
 */
export interface WarehouseTicket {
    id?: number;
    ticketNo: string;
    plateNumber: string;
    driver?: string;
    weight1?: number;
    weight2?: number;
    weightNet: number;
    dateIn?: string | Date;
    dateOut?: string | Date;
    goodsName?: string;
    note?: string;
    createdAt?: string | Date;
}

/**
 * Record of a container weighbridge ticket (xuất/nhập container)
 */
export interface ContainerTicket {
    id?: number;
    ticketNo: string;
    plateNumber: string;
    driver?: string;
    weight1?: number;
    weight2?: number;
    weightNet: number;
    dateIn?: string | Date;
    dateOut?: string | Date;
    containerNo?: string;
    goodsName?: string;
    note?: string;
    createdAt?: string | Date;
}

