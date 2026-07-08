import { describe, it, expect } from 'vitest';
import { coordinateSorter } from '../CoordinateSorter';
import type { TextElement } from '@/types/pdf';

describe('CoordinateSorter Y-Grouping', () => {
    it('should filter out empty elements', () => {
        const elements: TextElement[] = [
            { text: '   ', x: 10, y: 100, width: 10, height: 10, fontSize: 12 },
            { text: '', x: 20, y: 100, width: 10, height: 10, fontSize: 12 },
            { text: 'Hello', x: 30, y: 100, width: 10, height: 10, fontSize: 12 }
        ];
        const lines = coordinateSorter.groupElementsByY(elements);
        expect(lines).toHaveLength(1);
        expect(lines[0]!.elements).toHaveLength(1);
        expect(lines[0]!.elements[0]!.text).toBe('Hello');
    });

    it('should group elements in the same line when Y difference is below threshold', () => {
        // Average fontSize is 12, threshold = 6.
        // Y difference between 100 and 102 is 2 < 6, so they should be grouped together.
        const elements: TextElement[] = [
            { text: 'World', x: 80, y: 102, width: 30, height: 10, fontSize: 12 },
            { text: 'Hello', x: 20, y: 100, width: 30, height: 10, fontSize: 12 }
        ];
        const lines = coordinateSorter.groupElementsByY(elements);
        expect(lines).toHaveLength(1);
        expect(lines[0]!.elements).toHaveLength(2);
        // And they should be sorted by X ascending: 'Hello' (x=20) then 'World' (x=80)
        expect(lines[0]!.elements[0]!.text).toBe('Hello');
        expect(lines[0]!.elements[1]!.text).toBe('World');
    });

    it('should separate elements into different lines when Y difference exceeds threshold', () => {
        // Average fontSize is 12, threshold = 6.
        // Y difference is 100 vs 90 is 10 > 6, so they should be in separate lines.
        const elements: TextElement[] = [
            { text: 'Line 2', x: 20, y: 90, width: 30, height: 10, fontSize: 12 },
            { text: 'Line 1', x: 20, y: 100, width: 30, height: 10, fontSize: 12 }
        ];
        const lines = coordinateSorter.groupElementsByY(elements);
        expect(lines).toHaveLength(2);
        // Lines should be sorted by Y descending: Line 1 (y=100) first, Line 2 (y=90) second.
        expect(lines[0]!.elements[0]!.text).toBe('Line 1');
        expect(lines[1]!.elements[0]!.text).toBe('Line 2');
    });

    it('should sort elements horizontally from left-to-right (X ascending)', () => {
        const elements: TextElement[] = [
            { text: 'C', x: 100, y: 100, width: 10, height: 10, fontSize: 12 },
            { text: 'A', x: 10, y: 100, width: 10, height: 10, fontSize: 12 },
            { text: 'B', x: 50, y: 100, width: 10, height: 10, fontSize: 12 }
        ];
        const lines = coordinateSorter.groupElementsByY(elements);
        expect(lines).toHaveLength(1);
        expect(lines[0]!.elements[0]!.text).toBe('A');
        expect(lines[0]!.elements[1]!.text).toBe('B');
        expect(lines[0]!.elements[2]!.text).toBe('C');
    });
});

describe('CoordinateSorter Excel Grid Mapping', () => {
    it('should cluster X-coordinates into columns correctly', () => {
        const elementsLine1: TextElement[] = [
            { text: 'Col 1 Row 1', x: 10, y: 100, width: 10, height: 10, fontSize: 12 },
            { text: 'Col 2 Row 1', x: 105, y: 100, width: 10, height: 10, fontSize: 12 }
        ];
        const elementsLine2: TextElement[] = [
            { text: 'Col 1 Row 2', x: 12, y: 80, width: 10, height: 10, fontSize: 12 },
            { text: 'Col 2 Row 2', x: 107, y: 80, width: 10, height: 10, fontSize: 12 }
        ];

        const lines = coordinateSorter.groupElementsByY([...elementsLine1, ...elementsLine2]);
        expect(lines).toHaveLength(2);

        // Map to grid
        const grid = coordinateSorter.mapToExcelGrid(lines, 12);
        expect(grid).toHaveLength(2);
        // Expect 2 columns: Col 1 is at ~11, Col 2 is at ~106
        expect(grid[0]!.length).toBe(2);
        expect(grid[0]![0]).toBe('Col 1 Row 1');
        expect(grid[0]![1]).toBe('Col 2 Row 1');
        expect(grid[1]![0]).toBe('Col 1 Row 2');
        expect(grid[1]![1]).toBe('Col 2 Row 2');
    });
});
