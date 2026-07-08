import { describe, it } from 'vitest';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';
import { coordinateSorter } from '../CoordinateSorter';
import fs from 'fs';

describe('Raw Element Analysis', () => {
    it('should show raw vs merged elements for column analysis', async () => {
        const pdfPath = 'C:\\Users\\O5A00001315\\Downloads\\Ban CNTT-HPC - Wifi-mã vạch.pdf';
        if (!fs.existsSync(pdfPath)) {
            console.warn(`[align_raw] PDF file not found at ${pdfPath}. Skipping test.`);
            return;
        }
        const loadingTask = pdfjsLib.getDocument({ url: pdfPath, useSystemFonts: true, disableFontFace: true });
        const pdf = await loadingTask.promise;
        const page = await pdf.getPage(1);
        const textContent = await page.getTextContent();
        const viewport = page.getViewport({ scale: 1.0 });

        const elements: any[] = [];
        for (const item of textContent.items) {
            if ('str' in item && item.str.trim() !== '') {
                const tx = pdfjsLib.Util.transform(viewport.transform, item.transform);
                elements.push({ text: item.str, x: tx[4], y: viewport.height - tx[5], width: item.width, height: item.height, fontSize: item.transform[0] });
            }
        }

        const rawLines = coordinateSorter.groupElementsByY(elements);

        // Show raw elements (before merge) for first 10 data lines
        console.log("=== RAW ELEMENTS (before mergeCloseElements) ===");
        for (let i = 0; i < Math.min(15, rawLines.length); i++) {
            const line = rawLines[i]!;
            const sorted = [...line.elements].sort((a, b) => a.x - b.x);
            console.log(`\nLine ${i} (${sorted.length} elements):`);
            sorted.forEach(el => {
                console.log(`  "${el.text}" x=${el.x.toFixed(1)} w=${el.width.toFixed(1)} right=${(el.x + el.width).toFixed(1)} fs=${el.fontSize.toFixed(1)}`);
            });
            // Show gaps between adjacent elements
            for (let j = 1; j < sorted.length; j++) {
                const prev = sorted[j-1]!;
                const curr = sorted[j]!;
                const gap = curr.x - (prev.x + prev.width);
                const threshold = 1.0 * Math.max(prev.fontSize, curr.fontSize);
                console.log(`  GAP: ${gap.toFixed(1)}px (threshold=${threshold.toFixed(1)}, ${gap < threshold ? 'MERGE' : 'KEEP'})`);
            }
        }
    });
});
