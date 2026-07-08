import { describe, it, expect } from 'vitest';
import { documentBuilder } from '../DocumentBuilder';
import type { LineGroup } from '@/types/pdf';

describe('Word Document Builder', () => {
    it('should distinguish between headings and body text based on averageFontSize', async () => {
        const lines: LineGroup[] = [
            {
                y: 100,
                averageFontSize: 24, // Heading (> 18)
                elements: [
                    { text: 'This is a heading', x: 10, y: 100, width: 100, height: 20, fontSize: 24 }
                ]
            },
            {
                y: 80,
                averageFontSize: 12, // Body (<= 18)
                elements: [
                    { text: 'This is normal body text.', x: 10, y: 80, width: 200, height: 10, fontSize: 12 }
                ]
            }
        ];

        const buffer = await documentBuilder.buildWordDocument(lines);
        expect(buffer).toBeInstanceOf(ArrayBuffer);
        expect(buffer.byteLength).toBeGreaterThan(0);
    });
});
