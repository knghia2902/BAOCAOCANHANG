import { describe, it, expect } from 'vitest';
import { documentBuilder } from '../DocumentBuilder';
import type { LineGroup } from '@/types/pdf';

describe('Excel Builder Column Clustering', () => {
    it('should cluster X-coordinates into columns and map them to standard 2D grid', () => {
        const lines: LineGroup[] = [
            {
                y: 100,
                averageFontSize: 12,
                elements: [
                    { text: 'A1', x: 10, y: 100, width: 10, height: 10, fontSize: 12 },
                    { text: 'B1', x: 50, y: 100, width: 10, height: 10, fontSize: 12 }
                ]
            },
            {
                y: 80,
                averageFontSize: 12,
                elements: [
                    { text: 'A2', x: 12, y: 80, width: 10, height: 10, fontSize: 12 },
                    { text: 'B2', x: 52, y: 80, width: 10, height: 10, fontSize: 12 }
                ]
            }
        ];

        const grid = documentBuilder.mapToExcelGrid(lines, 12);
        expect(grid).toHaveLength(2);
        expect(grid[0]).toEqual(['A1', 'B1']);
        expect(grid[1]).toEqual(['A2', 'B2']);
    });

    it('should generate valid Excel ArrayBuffer', async () => {
        const lines: LineGroup[] = [
            {
                y: 100,
                averageFontSize: 12,
                elements: [
                    { text: 'Name', x: 10, y: 100, width: 10, height: 10, fontSize: 12 },
                    { text: 'Age', x: 60, y: 100, width: 10, height: 10, fontSize: 12 }
                ]
            },
            {
                y: 80,
                averageFontSize: 12,
                elements: [
                    { text: 'Alice', x: 11, y: 80, width: 10, height: 10, fontSize: 12 },
                    { text: '30', x: 61, y: 80, width: 10, height: 10, fontSize: 12 }
                ]
            }
        ];

        const buffer = await documentBuilder.buildExcelDocument(lines);
        expect(buffer).toBeInstanceOf(ArrayBuffer);
        expect(buffer.byteLength).toBeGreaterThan(0);
    });
});
