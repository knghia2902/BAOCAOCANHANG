import ExcelJS from 'exceljs';
import type { IExcelService } from './interfaces';
import type { IColumnConfig } from '../excel/types';

export class ExcelService implements IExcelService {
    async exportData<T>(data: T[], columns: IColumnConfig[], filename: string): Promise<void> {
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Data');

        worksheet.columns = columns.map((col) => ({
            header: col.header,
            key: col.key,
            width: col.width ?? 20,
            style: col.style,
        }));

        // Add rows
        worksheet.addRows(data);

        // Write buffer
        const buffer = await workbook.xlsx.writeBuffer();
        this.saveAsFile(buffer, filename);
    }

    async importData<T>(file: File): Promise<T[]> {
        const arrayBuffer = await file.arrayBuffer();
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.load(arrayBuffer);

        const worksheet = workbook.getWorksheet(1);
        const data: T[] = [];

        if (worksheet) {
            const headers: string[] = [];
            worksheet.getRow(1).eachCell((cell, colNumber) => {
                headers[colNumber] = cell.text; // Store header by column index
            });

            worksheet.eachRow((row, rowNumber) => {
                if (rowNumber === 1) return; // Skip header

                const rowData: any = {};
                row.eachCell((cell, colNumber) => {
                    const header = headers[colNumber];
                    if (header) {
                        rowData[header] = cell.value;
                    }
                });
                data.push(rowData);
            });
        }

        return data;
    }

    private saveAsFile(buffer: ArrayBuffer, filename: string): void {
        const blob = new Blob([buffer], {
            type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = filename.endsWith('.xlsx') ? filename : `${filename}.xlsx`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }
}
