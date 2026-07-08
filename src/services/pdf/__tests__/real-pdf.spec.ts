import { describe, it } from 'vitest';
import { coordinateSorter } from '../CoordinateSorter';
import { documentBuilder } from '../DocumentBuilder';
import type { TextElement } from '@/types/pdf';
import fs from 'fs';

describe('Layout Reconstruction Test', () => {
    it('should reconstruct and save Excel from mock PDF coordinates', async () => {
        const elements: TextElement[] = [
            // Title
            { text: 'KIỂM KÊ LAPTOP', x: 385, y: 540, width: 100, height: 8, fontSize: 8 },
            
            // Header Row (split-line columns)
            { text: 'STT', x: 54, y: 511, width: 20, height: 6, fontSize: 6 },
            { text: 'Tên TS/CCDC', x: 108, y: 511, width: 50, height: 6, fontSize: 6 },
            
            // Mã TS/CCDC Theo Kế Toán
            { text: 'Mã TS/CCDC', x: 199, y: 520, width: 40, height: 6, fontSize: 6 },
            { text: 'Theo Kế Toán', x: 200, y: 500, width: 40, height: 6, fontSize: 6 },
            
            { text: 'Mã TS/CCDC', x: 267, y: 511, width: 40, height: 6, fontSize: 6 },
            { text: 'Cấu Hinh', x: 351, y: 511, width: 40, height: 6, fontSize: 6 },
            { text: 'Bộ phận SD', x: 413, y: 511, width: 40, height: 6, fontSize: 6 },
            { text: 'Nhân Viên SD', x: 475, y: 511, width: 45, height: 6, fontSize: 6 },
            { text: 'MAC', x: 560, y: 511, width: 30, height: 6, fontSize: 6 },
            { text: 'Biên Bản BG', x: 598, y: 511, width: 40, height: 6, fontSize: 6 },
            { text: 'LỆNH XUẤT', x: 654, y: 511, width: 40, height: 6, fontSize: 6 },
            { text: 'Ghi chú', x: 716, y: 511, width: 30, height: 6, fontSize: 6 },
            { text: 'Số Lượng LX', x: 753, y: 511, width: 40, height: 6, fontSize: 6 },

            // Data Row 0
            { text: '0', x: 54, y: 485, width: 10, height: 6, fontSize: 6 },
            { text: 'Laptop Dell Workstation 5560 i7 11850H', x: 108, y: 485, width: 80, height: 6, fontSize: 6 },
            { text: '67Q24F3', x: 267, y: 485, width: 40, height: 6, fontSize: 6 },
            { text: 'Core i7-11850H', x: 351, y: 485, width: 40, height: 6, fontSize: 6 },
            { text: 'PGĐ', x: 413, y: 485, width: 30, height: 6, fontSize: 6 },
            { text: 'chị Hương PGD (giữ)', x: 475, y: 485, width: 50, height: 6, fontSize: 6 },
            { text: '04:56:E6:52:86:2C', x: 560, y: 485, width: 50, height: 6, fontSize: 6 },
            { text: 'PM.203/22-00023', x: 654, y: 485, width: 50, height: 6, fontSize: 6 },
            { text: '1', x: 753, y: 485, width: 10, height: 6, fontSize: 6 }
        ];

        // Process elements
        const lines = coordinateSorter.groupElementsByY(elements);
        const buffer = await documentBuilder.buildExcelDocument(lines);

        const downloadsFolder = process.env.USERPROFILE 
            ? `${process.env.USERPROFILE}\\Downloads` 
            : './';
        const outputPath = fs.existsSync(downloadsFolder)
            ? `${downloadsFolder}\\test_output_via_vitest.xlsx`
            : './test_output_via_vitest.xlsx';

        fs.writeFileSync(outputPath, Buffer.from(buffer));
        console.log(`SUCCESSFULLY SAVED ${outputPath}`);
    });
});