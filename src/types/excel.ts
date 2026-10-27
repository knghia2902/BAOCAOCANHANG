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

/**
 * 4-Warehouse Daily Morning Inventory Types (Phase 20)
 */
export type WarehouseId = 'KHO 1' | 'KHO 2' | 'KHO 3' | 'KHO 4';

export type WarehouseFlowType = 'IMPORT' | 'EXPORT' | 'DIRECT';

export interface WarehouseInventoryTicket {
    id: string;
    soPhieu: string;
    maLenh?: string;
    reportDate: string; // YYYY-MM-DD (after 06:00 AM cutoff)
    weighInDate?: string;
    weighInTime?: string;
    weighOutDate: string; // DD/MM/YYYY or YYYY-MM-DD
    weighOutTime: string; // HH:mm:ss or HH:mm
    flowType: WarehouseFlowType;
    warehouseId: WarehouseId | null;
    customerName: string;
    cargoType: string;
    vehiclePlate: string;
    carrierName: string; // Nhà xe (from Data lookup or sheet)
    grossWeight: number; // Tons
    tareWeight: number; // Tons
    netWeight: number; // Tons (e.g. 42.20)
    factoryWeight?: number | null; // KL Phiếu nhà máy (Tons) for IMPORT
    bargeInfo?: string; // Loai Salan for EXPORT / DIRECT
    vesselName?: string; // Tàu mẹ / Đích đến for EXPORT / DIRECT
    sourceOrRemark?: string; // Tai Xe (Factory name for IMPORT, Direct source for DIRECT)
    originWarehouseName?: string; // TÊN KHO / Tên Kho (Kho 1-2-3 IMPORT / XÁ THẲNG)
    originArea?: string; // KHU VỰC / Khu Vực (Kho 1-2-3 IMPORT / XÁ THẲNG)
    rawNote?: string;
    createdAt?: string;
}

export interface WarehouseConfig {
    warehouseId: WarehouseId;
    initialStock: number; // Tồn đầu kỳ (Tons)
    initialDate: string; // YYYY-MM-DD or DD/MM/YYYY
    currentCustomer: string;
    dailyRemarks: Record<string, string>; // Key: reportDate (YYYY-MM-DD) -> Remark text
    updatedAt?: string;
}

export interface WarehouseVehicleMap {
    vehiclePlate: string; // Normalized key (uppercase alphanumeric)
    displayPlate: string; // Display plate (e.g. 50H-235.64)
    carrierName: string; // Nhà xe (e.g. NGUYÊN NGỌC, TẤN PHÁT)
}

export interface WarehouseFinalRow {
    reportDate: string; // YYYY-MM-DD
    displayDate: string; // DD/MM/YYYY
    importTons: number;
    importTrips: number;
    exportTons: number;
    exportTrips: number;
    directTons: number;
    directTrips: number;
    remainingStockTons: number; // Tồn kho cộng dồn liên tục
    remark: string; // Ghi chú (kết hợp tự động tàu/sà lan xuất + ghi chú tay)
    autoRemark: string;
    manualRemark: string;
    customers: string[];
}

export interface WarehouseImportSummary {
    importedCount: number;
    newCount?: number;
    duplicateCount?: number;
    importFlowCount: number;
    exportFlowCount: number;
    directFlowCount: number;
    ignoredCount: number;
    syncedToAllocatorCount: number;
    matchedBargesCount: number;
    vehiclesLearnedCount: number;
    warehousesUpdated: WarehouseId[];
    errors: string[];
}

export interface WarehouseMapVertex {
    /** Tọa độ ngang chuẩn hóa trong kho: 0 (tường trái) -> 1 (tường phải) */
    xRatio: number;
    /** Tọa độ dọc tính theo số ô kho: 0 (đáy kho) -> totalBays (đỉnh kho) */
    bayY: number;
}

export interface WarehouseMapPolygon {
    id: string;
    label?: string;
    color?: string;
    vertices: WarehouseMapVertex[];
}

export interface WarehouseZoneMapConfig {
    warehouseId: WarehouseId;
    areaM2: number;
    totalBays: number;
    fillColor: string;
    cargoName: string;
    customCustomerName?: string;
    overrideStockTons?: number | null;
    showConveyor?: boolean;
    conveyorBayY?: number;
    polygons: WarehouseMapPolygon[];
}

export interface ContainerYardMapConfig {
    loadedConts: number;
    emptyConts: number;
    overrideTotalConts?: number | null;
    fillColor?: string;
}

export interface WarehouseVisualMapState {
    title: string;
    updatedAtLabel: string;
    containerYard: ContainerYardMapConfig;
    warehouses: Record<WarehouseId, WarehouseZoneMapConfig>;
    updatedAt?: string;
    updatedBy?: string;
}
