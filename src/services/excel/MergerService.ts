import { excelService } from './ExcelService';
import type { MergeResult } from '../../types/excel';
import ExcelJS from 'exceljs';

export class MergerService {
    /**
     * Extract unique headers from a specific row in an Excel file
     */
    async extractHeaders(file: File, headerRowIndex: number = 1): Promise<string[]> {
        try {
            const workbook = await excelService.readExcel(file);
            const worksheet = excelService.getWorksheet(workbook);
            if (!worksheet) return [];

            const headers: string[] = [];
            const row = worksheet.getRow(headerRowIndex);
            row.eachCell((cell) => {
                const val = cell.text.trim();
                if (val) headers.push(val);
            });
            return headers;
        } catch (err) {
            console.error('Error extracting headers:', err);
            return [];
        }
    }

    /**
     * Merge multiple files into a master file
     */
    async merge(options: {
        masterFile: File,
        otherFiles: File[],
        matchKey: string,
        headerRow: number,
        skipEmpty?: boolean
    }): Promise<MergeResult> {
        let matchedRowsCount = 0;
        let newRowsCount = 0;
        let fuzzyMatchesCount = 0;
        const errors: string[] = [];

        try {
            // 1. Load Master
            const masterWorkbook = await excelService.readExcel(options.masterFile);
            const masterSheet = excelService.getWorksheet(masterWorkbook);
            if (!masterSheet) throw new Error('Could not find worksheet in master file.');

            // 2. Map Master Headers
            const masterHeaders: Record<string, number> = {};
            const mHeaderRow = masterSheet.getRow(options.headerRow);
            mHeaderRow.eachCell((cell, colNum) => {
                const val = cell.text.trim();
                if (val) masterHeaders[val] = colNum;
            });

            const matchKeyCol = masterHeaders[options.matchKey];
            if (!matchKeyCol) throw new Error(`Match key "${options.matchKey}" not found in master headers.`);

            // 3. Process Other Files
            for (const file of options.otherFiles) {
                try {
                    const workbook = await excelService.readExcel(file);
                    const worksheet = excelService.getWorksheet(workbook);
                    if (!worksheet) continue;

                    const currentHeaders: Record<string, number> = {};
                    worksheet.getRow(options.headerRow).eachCell((cell, colNum) => {
                        const val = cell.text.trim();
                        if (val) currentHeaders[val] = colNum;
                    });

                    const currentMatchKeyCol = currentHeaders[options.matchKey];
                    if (!currentMatchKeyCol) {
                        errors.push(`File "${file.name}" missing match key column.`);
                        continue;
                    }

                    // Iterate rows in other file
                    worksheet.eachRow((row, rowNum) => {
                        if (rowNum <= options.headerRow) return;

                        const keyValue = row.getCell(currentMatchKeyCol).text.trim();
                        if (!keyValue && options.skipEmpty) return;

                        // Find match in master
                        let targetRow: ExcelJS.Row | null = null;
                        masterSheet.eachRow((mRow, mRowNum) => {
                            if (mRowNum <= options.headerRow) return;
                            if (mRow.getCell(matchKeyCol).text.trim() === keyValue) {
                                targetRow = mRow;
                            }
                        });

                        if (targetRow) {
                            this.copyRowData(row, targetRow, currentHeaders, masterHeaders);
                            matchedRowsCount++;
                        }
                    });
                } catch (err: any) {
                    errors.push(`Error processing "${file.name}": ${err.message}`);
                }
            }

            // 4. Finalize
            const buffer = await masterWorkbook.xlsx.writeBuffer();
            return {
                success: true,
                buffer: buffer as ArrayBuffer,
                filename: `Merged_${options.masterFile.name}`,
                mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                successCount: matchedRowsCount,
                errors: errors,
                matchedRows: matchedRowsCount,
                newRowsAdded: newRowsCount,
                fuzzyMatches: fuzzyMatchesCount
            };
        } catch (err: any) {
            throw err;
        }
    }

    /**
     * Download wrapper
     */
    download(data: ArrayBuffer, filename: string) {
        excelService.downloadFile(data, filename, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    }

    private copyRowData(
        sourceRow: ExcelJS.Row,
        targetRow: ExcelJS.Row,
        sourceHeaders: Record<string, number>,
        targetHeaders: Record<string, number>
    ) {
        Object.keys(sourceHeaders).forEach(header => {
            const sCol = sourceHeaders[header]!;
            const tCol = targetHeaders[header];

            if (tCol) {
                const sCell = sourceRow.getCell(sCol);
                const tCell = targetRow.getCell(tCol);
                tCell.value = sCell.value;
                if (sCell.style) {
                    tCell.style = { ...sCell.style };
                }
            }
        });
        targetRow.commit();
    }
}

export const mergerService = new MergerService();
