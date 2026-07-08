// Excel Service - Base class for Excel operations
// Stage 4: Core logic implementation

import * as ExcelJS from 'exceljs';

export class ExcelService {
    /**
     * Read Excel file from File object
     * @param file - File object from input
     * @returns ExcelJS Workbook
     */
    async readExcel(file: File): Promise<ExcelJS.Workbook> {
        const workbook = new ExcelJS.Workbook();
        const arrayBuffer = await file.arrayBuffer();
        await workbook.xlsx.load(arrayBuffer);
        return workbook;
    }

    /**
     * Write workbook to ArrayBuffer
     * @param workbook - ExcelJS Workbook
     * @returns ArrayBuffer ready for download
     */
    async writeExcel(workbook: ExcelJS.Workbook): Promise<ArrayBuffer> {
        const buffer = await workbook.xlsx.writeBuffer();
        return buffer;
    }

    /**
     * Download file to user's computer
     * @param data - ArrayBuffer or string
     * @param filename - Name of the file
     * @param mimeType - MIME type
     */
    downloadFile(data: ArrayBuffer | string, filename: string, mimeType: string): void {
        const blob = new Blob([data], { type: mimeType });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    }

    /**
     * Get worksheet by index or name
     * @param workbook - ExcelJS Workbook
     * @param indexOrName - Sheet index (0-based) or name
     * @returns Worksheet or null
     */
    getWorksheet(workbook: ExcelJS.Workbook, indexOrName: number | string = 0): ExcelJS.Worksheet | null {
        if (typeof indexOrName === 'number') {
            return workbook.worksheets[indexOrName] || null;
        }
        return workbook.getWorksheet(indexOrName) || null;
    }

    /**
     * Validate file type
     * @param file - File object
     * @param allowedExtensions - Array of allowed extensions
     * @returns boolean
     */
    validateFileType(file: File, allowedExtensions: string[]): boolean {
        const extension = file.name.split('.').pop()?.toLowerCase();
        return extension ? allowedExtensions.includes(extension) : false;
    }

    /**
     * Validate file size
     * @param file - File object
     * @param maxSizeMB - Maximum size in MB
     * @returns boolean
     */
    validateFileSize(file: File, maxSizeMB: number = 10): boolean {
        const maxBytes = maxSizeMB * 1024 * 1024;
        return file.size <= maxBytes;
    }
}

export const excelService = new ExcelService();
