import { ExcelService } from '@/services/excel/ExcelService';
import { renderAsync } from 'docx-preview';
import type { ConversionOptions, ConversionResult } from '@/types/conversion';

class DocumentConversionService {
    private excelService: ExcelService;
    private readonly MAX_FILE_SIZE_MB = 15;

    constructor() {
        this.excelService = new ExcelService();
    }

    validateFile(file: File): { isValid: boolean; error?: string } {
        const isValid = this.excelService.validateFileSize(file, this.MAX_FILE_SIZE_MB);
        if (!isValid) {
            return { isValid: false, error: 'File size exceeds 15MB limit' };
        }
        return { isValid: true };
    }

    async processDocxToPreview(file: File, container: HTMLElement, options?: ConversionOptions): Promise<ConversionResult> {
        try {
            const validation = this.validateFile(file);
            if (!validation.isValid) {
                return { success: false, error: validation.error };
            }

            options?.onProgress?.('�?c file...', 0);
            const buffer = await file.arrayBuffer();

            options?.onProgress?.('�ang chu?n b? render...', 20);
            await renderAsync(buffer, container, container, { inWrapper: false, ignoreWidth: false, ignoreHeight: false });

            options?.onProgress?.('Render preview ho�n t?t', 70);
            return { success: true };
        } catch (error: any) {
            console.error('Error processing docx to preview:', error);
            return { success: false, error: error.message || 'Unknown error occurred' };
        }
    }

        async processXlsxToPreview(file: File, container: HTMLElement, options?: ConversionOptions): Promise<ConversionResult> {
        try {
            const validation = this.validateFile(file);
            if (!validation.isValid) {
                return { success: false, error: validation.error };
            }

            options?.onProgress?.('�?c file...', 0);
            const workbook = await this.excelService.readExcel(file);
            const worksheet = this.excelService.getWorksheet(workbook, 0);

            if (!worksheet) {
                return { success: false, error: 'Kh�ng t�m th?y sheet n�o trong file' };
            }

            options?.onProgress?.('�ang chu?n b? render...', 20);
            let tableHtml = '<div class="overflow-auto max-h-[80vh] bg-white p-4 rounded shadow-sm">';
            tableHtml += '<table class="min-w-full divide-y divide-gray-200 border border-gray-300 text-sm">';
            tableHtml += '<tbody class="divide-y divide-gray-200">';
            const maxCols = worksheet.columnCount;
            worksheet.eachRow((row, rowNumber) => {
                tableHtml += '<tr>';
                for (let col = 1; col <= maxCols; col++) {
                    const cell = row.getCell(col);
                    let value = "";
                    if (cell.value !== null && cell.value !== undefined) {
                        if (typeof cell.value === 'object') {
                            if ('richText' in cell.value) {
                                value = cell.value.richText.map(rt => rt.text).join('');
                            } else if ('formula' in cell.value && 'result' in cell.value) {
                                value = (cell.value.result ?? '').toString();
                            } else {
                                value = cell.value.toString();
                            }
                        } else {
                            value = cell.value.toString();
                        }
                    }
                    value = value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
                    const isHeader = rowNumber === 1;
                    const cellTag = isHeader ? 'th' : 'td';
                    const cellClasses = isHeader 
                        ? 'px-3 py-2 bg-gray-50 text-left font-medium text-gray-700 border border-gray-300' 
                        : 'px-3 py-2 text-gray-600 border border-gray-300 whitespace-pre-wrap';
                    tableHtml += "<" + cellTag + " class=\"" + cellClasses + "\">" + value + "</" + cellTag + ">";
                }
                tableHtml += '</tr>';
            });
            tableHtml += '</tbody></table></div>';
            container.innerHTML = tableHtml;

            options?.onProgress?.('Render preview ho�n t?t', 70);
            return { success: true };
        } catch (error: any) {
            console.error('Error processing xlsx to preview:', error);
            return { success: false, error: error.message || 'Unknown error occurred' };
        }
    }


    async exportToPdf(container: HTMLElement, originalFilename: string, options?: ConversionOptions): Promise<ConversionResult> {
        try {
            options?.onProgress?.('�ang xu?t PDF...', 70);
            const html2pdf = (await import('html2pdf.js')).default;

            const filename = originalFilename.replace(/\.[^/.]+$/, '') + '_converted.pdf';
            const opt = { 
                margin: 10, 
                filename: filename, 
                image: { type: 'jpeg' as const, quality: 0.98 }, 
                html2canvas: { scale: 2 }, 
                jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' as const } 
            };

            await html2pdf().set(opt).from(container).save();

            options?.onProgress?.('Ho�n t?t', 100);
            return { success: true, filename };
        } catch (error: any) {
            console.error('Error exporting to pdf:', error);
            return { success: false, error: error.message || 'Unknown error occurred' };
        }
    }
}

export const documentConversionService = new DocumentConversionService();
