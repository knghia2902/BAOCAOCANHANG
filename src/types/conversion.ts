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
