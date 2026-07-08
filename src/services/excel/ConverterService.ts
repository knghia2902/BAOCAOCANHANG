// Converter Service - Format conversion logic
// Stage 4: Core conversion implementation

import * as ExcelJS from 'exceljs';
import { ExcelService } from './ExcelService';
import type { ConversionOptions, ConversionResult, FileValidation } from '@/types/excel';
import { ConversionFormat } from '@/types/excel';

export class ConverterService {
    private excelService: ExcelService;

    constructor() {
        this.excelService = new ExcelService();
    }

    /**
     * Validate uploaded file
     */
    validateFile(file: File): FileValidation {
        // Check file size
        if (!this.excelService.validateFileSize(file, 10)) {
            return {
                isValid: false,
                size: file.size,
                error: 'File size exceeds 10MB limit'
            };
        }

        // Detect format from extension
        const extension = file.name.split('.').pop()?.toLowerCase();
        let format: ConversionFormat | undefined;

        switch (extension) {
            case 'xlsx':
            case 'xls':
                format = ConversionFormat.EXCEL;
                break;
            case 'csv':
                format = ConversionFormat.CSV;
                break;
            case 'json':
                format = ConversionFormat.JSON;
                break;
            default:
                return {
                    isValid: false,
                    size: file.size,
                    error: 'Unsupported file format. Please use .xlsx, .csv, or .json'
                };
        }

        return {
            isValid: true,
            format,
            size: file.size
        };
    }

    /**
     * Convert Excel to CSV
     */
    async excelToCsv(file: File, sheetIndex: number = 0): Promise<ConversionResult> {
        try {
            const workbook = await this.excelService.readExcel(file);
            const worksheet = this.excelService.getWorksheet(workbook, sheetIndex);

            if (!worksheet) {
                return {
                    success: false,
                    filename: '',
                    mimeType: '',
                    error: 'Worksheet not found'
                };
            }

            const rows: string[][] = [];
            worksheet.eachRow((row) => {
                const values = row.values as any[];
                // Skip first element (ExcelJS adds undefined at index 0)
                const rowData = values.slice(1).map(cell => {
                    if (cell === null || cell === undefined) return '';

                    // Handle different cell types
                    let cellValue = '';
                    if (typeof cell === 'object' && cell.text) {
                        // Rich text
                        cellValue = cell.text;
                    } else if (typeof cell === 'object' && cell.result !== undefined) {
                        // Formula
                        cellValue = String(cell.result);
                    } else {
                        cellValue = String(cell);
                    }

                    return cellValue;
                });
                rows.push(rowData);
            });

            // Convert to CSV with proper escaping
            const csvContent = rows.map(row => {
                return row.map(cell => {
                    // Check if cell needs quoting
                    if (cell.includes(',') || cell.includes('"') || cell.includes('\n') || cell.includes('\r')) {
                        // Escape quotes by doubling them
                        return `"${cell.replace(/"/g, '""')}"`;
                    }
                    return cell;
                }).join(',');
            }).join('\r\n'); // Use CRLF for better compatibility

            const filename = file.name.replace(/\.[^/.]+$/, '') + '.csv';
            return {
                success: true,
                data: '\uFEFF' + csvContent, // Add BOM for UTF-8 encoding
                filename,
                mimeType: 'text/csv;charset=utf-8'
            };
        } catch (error) {
            return {
                success: false,
                filename: '',
                mimeType: '',
                error: `Conversion failed: ${error instanceof Error ? error.message : 'Unknown error'}`
            };
        }
    }

    /**
     * Convert CSV to Excel
     */
    async csvToExcel(file: File): Promise<ConversionResult> {
        try {
            const csvContent = await file.text();
            const workbook = new ExcelJS.Workbook();
            const worksheet = workbook.addWorksheet('Data');

            // Parse CSV
            const lines = csvContent.split('\n').filter(line => line.trim());
            lines.forEach((line) => {
                // Simple CSV parsing (handles quoted values)
                const values: string[] = [];
                let current = '';
                let inQuotes = false;

                for (let i = 0; i < line.length; i++) {
                    const char = line[i];
                    if (char === '"') {
                        inQuotes = !inQuotes;
                    } else if (char === ',' && !inQuotes) {
                        values.push(current.trim());
                        current = '';
                    } else {
                        current += char;
                    }
                }
                values.push(current.trim());

                worksheet.addRow(values);
            });

            // Auto-fit columns
            const colCount = worksheet.columnCount;
            if (colCount > 0) {
                worksheet.columns = Array.from({ length: colCount }, () => ({}));
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
            }

            const buffer = await this.excelService.writeExcel(workbook);
            const filename = file.name.replace(/\.[^/.]+$/, '') + '.xlsx';

            return {
                success: true,
                data: buffer,
                filename,
                mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
            };
        } catch (error) {
            return {
                success: false,
                filename: '',
                mimeType: '',
                error: `Conversion failed: ${error instanceof Error ? error.message : 'Unknown error'}`
            };
        }
    }

    /**
     * Convert Excel to JSON
     */
    async excelToJson(file: File, sheetIndex: number = 0): Promise<ConversionResult> {
        try {
            const workbook = await this.excelService.readExcel(file);
            const worksheet = this.excelService.getWorksheet(workbook, sheetIndex);

            if (!worksheet) {
                return {
                    success: false,
                    filename: '',
                    mimeType: '',
                    error: 'Worksheet not found'
                };
            }

            const jsonData: any[] = [];
            let headers: string[] = [];

            worksheet.eachRow((row, rowNumber) => {
                const values = row.values as any[];
                const rowData = values.slice(1); // Skip first undefined element

                if (rowNumber === 1) {
                    // First row as headers
                    headers = rowData.map(cell => String(cell || `Column${rowData.indexOf(cell)}`));
                } else {
                    // Create object from row
                    const obj: any = {};
                    headers.forEach((header, index) => {
                        obj[header] = rowData[index] !== undefined ? rowData[index] : null;
                    });
                    jsonData.push(obj);
                }
            });

            const jsonString = JSON.stringify(jsonData, null, 2);
            const filename = file.name.replace(/\.[^/.]+$/, '') + '.json';

            return {
                success: true,
                data: jsonString,
                filename,
                mimeType: 'application/json'
            };
        } catch (error) {
            return {
                success: false,
                filename: '',
                mimeType: '',
                error: `Conversion failed: ${error instanceof Error ? error.message : 'Unknown error'}`
            };
        }
    }

    /**
     * Convert JSON to Excel
     */
    async jsonToExcel(file: File): Promise<ConversionResult> {
        try {
            const jsonContent = await file.text();
            const jsonData = JSON.parse(jsonContent);

            if (!Array.isArray(jsonData) || jsonData.length === 0) {
                return {
                    success: false,
                    filename: '',
                    mimeType: '',
                    error: 'JSON must be an array of objects'
                };
            }

            const workbook = new ExcelJS.Workbook();
            const worksheet = workbook.addWorksheet('Data');

            // Get headers from first object
            const headers = Object.keys(jsonData[0]);
            worksheet.addRow(headers);

            // Add data rows
            jsonData.forEach(obj => {
                const row = headers.map(header => obj[header]);
                worksheet.addRow(row);
            });

            // Style header row
            const headerRow = worksheet.getRow(1);
            headerRow.font = { bold: true };
            headerRow.fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'FFE0E0E0' }
            };

            // Auto-fit columns
            const colCount = worksheet.columnCount;
            if (colCount > 0) {
                worksheet.columns = Array.from({ length: colCount }, () => ({}));
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
            }

            const buffer = await this.excelService.writeExcel(workbook);
            const filename = file.name.replace(/\.[^/.]+$/, '') + '.xlsx';

            return {
                success: true,
                data: buffer,
                filename,
                mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
            };
        } catch (error) {
            return {
                success: false,
                filename: '',
                mimeType: '',
                error: `Conversion failed: ${error instanceof Error ? error.message : 'Unknown error'}`
            };
        }
    }

    /**
     * Main conversion method
     */
    async convert(file: File, options: ConversionOptions): Promise<ConversionResult> {
        const { sourceFormat, targetFormat } = options;

        // Excel → CSV
        if (sourceFormat === ConversionFormat.EXCEL && targetFormat === ConversionFormat.CSV) {
            return this.excelToCsv(file, options.sheetIndex);
        }

        // CSV → Excel
        if (sourceFormat === ConversionFormat.CSV && targetFormat === ConversionFormat.EXCEL) {
            return this.csvToExcel(file);
        }

        // Excel → JSON
        if (sourceFormat === ConversionFormat.EXCEL && targetFormat === ConversionFormat.JSON) {
            return this.excelToJson(file, options.sheetIndex);
        }

        // JSON → Excel
        if (sourceFormat === ConversionFormat.JSON && targetFormat === ConversionFormat.EXCEL) {
            return this.jsonToExcel(file);
        }

        return {
            success: false,
            filename: '',
            mimeType: '',
            error: 'Unsupported conversion path'
        };
    }
}

export const converterService = new ConverterService();
