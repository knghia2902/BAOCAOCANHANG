import { describe, it, expect } from 'vitest';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';
import { coordinateSorter } from '../CoordinateSorter';
import fs from 'fs';

interface ColInterval { minX: number; maxX: number; }

/**
 * Detect column boundaries using header-anchored gap-voting from RAW elements.
 * 1. Find header row → define N column intervals  
 * 2. For each gap region between adjacent headers, collect data-row gaps that fall in that region
 * 3. Use median of matched gaps as boundary (fallback: gap midpoint)
 */
function detectColumnBoundaries(rawLines: any[]): number[] {
    // Step 1: Find header block (row with most elements in first 10 rows)
    let mainHeaderIdx = -1, maxElements = 0;
    for (let i = 0; i < Math.min(10, rawLines.length); i++) {
        if (rawLines[i]!.elements.length > maxElements) {
            maxElements = rawLines[i]!.elements.length;
            mainHeaderIdx = i;
        }
    }
    if (mainHeaderIdx === -1 || maxElements < 2) return [];

    // Find multi-line header block (rows above mainHeader that align vertically)
    let minHeaderIdx = mainHeaderIdx;
    if (maxElements > 2) {
        for (let i = mainHeaderIdx - 1; i >= 0; i--) {
            const line = rawLines[i]!;
            if (line.elements.length === 0) break;
            let overlaps = false;
            for (const a of line.elements) {
                for (const b of rawLines[mainHeaderIdx]!.elements) {
                    if (Math.max(a.x, b.x) < Math.min(a.x + a.width, b.x + b.width) - 2) {
                        overlaps = true; break;
                    }
                }
                if (overlaps) break;
            }
            if (overlaps) break;
            minHeaderIdx = i;
        }
    }

    // Step 2: Build header column intervals (merge overlapping header elements)
    const headerEls: any[] = [];
    for (let i = minHeaderIdx; i <= mainHeaderIdx; i++) {
        headerEls.push(...rawLines[i]!.elements);
    }
    const rawRanges = headerEls.map((el: any) => ({ minX: el.x, maxX: el.x + el.width })).sort((a: ColInterval, b: ColInterval) => a.minX - b.minX);
    
    const intervals: ColInterval[] = [];
    if (rawRanges.length === 0) return [];
    let cur = { ...rawRanges[0]! };
    for (let i = 1; i < rawRanges.length; i++) {
        const next = rawRanges[i]!;
        const ov = Math.max(0, Math.min(cur.maxX, next.maxX) - Math.max(cur.minX, next.minX));
        const isDup = (next.maxX - next.minX) - ov < 2 || (cur.maxX - cur.minX) - ov < 2;
        if (next.minX < cur.maxX && (ov > 5 || isDup)) {
            cur.maxX = Math.max(cur.maxX, next.maxX);
        } else {
            intervals.push(cur);
            cur = { ...next };
        }
    }
    intervals.push(cur);
    if (intervals.length < 2) return [];

    // Step 3: Define gap regions between adjacent header columns
    const gapRegions = [];
    for (let i = 0; i < intervals.length - 1; i++) {
        gapRegions.push({
            left: intervals[i]!.maxX,
            right: intervals[i + 1]!.minX,
            fallback: (intervals[i]!.maxX + intervals[i + 1]!.minX) / 2
        });
    }

    // Step 4: Collect data row gaps and match to gap regions
    const matchedGaps: { leftRight: number; rightLeft: number }[][] = gapRegions.map(() => []);
    const TOLERANCE = 5; // allow small overshoot past region edges

    for (let lineIdx = 0; lineIdx < rawLines.length; lineIdx++) {
        if (lineIdx >= minHeaderIdx && lineIdx <= mainHeaderIdx) continue;
        const line = rawLines[lineIdx]!;
        if (line.elements.length < 2) continue;

        const sorted = [...line.elements].sort((a: any, b: any) => a.x - b.x);
        for (let j = 1; j < sorted.length; j++) {
            const leftRight = sorted[j-1]!.x + sorted[j-1]!.width; // right edge of left element
            const rightLeft = sorted[j]!.x; // left edge of right element
            if (rightLeft <= leftRight) continue; // overlapping, skip
            const gapCenter = (leftRight + rightLeft) / 2;

            // Match to a gap region (must fall within region ± tolerance)
            for (let g = 0; g < gapRegions.length; g++) {
                if (gapCenter >= gapRegions[g]!.left - TOLERANCE && gapCenter <= gapRegions[g]!.right + TOLERANCE) {
                    // Crossing filter: only keep if left element is in the LEFT column
                    // (left element center < midpoint of adjacent header centers)
                    const leftHeaderCenter = (intervals[g]!.minX + intervals[g]!.maxX) / 2;
                    const rightHeaderCenter = (intervals[g + 1]!.minX + intervals[g + 1]!.maxX) / 2;
                    const crossingThreshold = (leftHeaderCenter + rightHeaderCenter) / 2;
                    const leftElemCenter = sorted[j-1]!.x + sorted[j-1]!.width / 2;

                    if (leftElemCenter < crossingThreshold) {
                        matchedGaps[g]!.push({ leftRight, rightLeft });
                    }
                    break;
                }
            }
        }
    }

    // Step 5: Compute boundaries using tightest data edges
    // boundary = midpoint between max right-edge of left-column data and min left-edge of right-column data
    const boundaries: number[] = [];
    for (let g = 0; g < gapRegions.length; g++) {
        const edges = matchedGaps[g]!;
        if (edges.length > 0) {
            const maxLeftRight = Math.max(...edges.map((e: any) => e.leftRight));
            const minRightLeft = Math.min(...edges.map((e: any) => e.rightLeft));
            boundaries.push((maxLeftRight + minRightLeft) / 2);
        } else {
            boundaries.push(gapRegions[g]!.fallback);
        }
    }

    console.log("\n=== HEADER INTERVALS ===");
    intervals.forEach((inv, i) => console.log(`  Col ${i}: [${inv.minX.toFixed(1)}, ${inv.maxX.toFixed(1)}]`));
    console.log("\n=== GAP REGIONS & MATCHED GAPS ===");
    gapRegions.forEach((r, i) => {
        console.log(`  Region ${i}: [${r.left.toFixed(1)}, ${r.right.toFixed(1)}] → ${matchedGaps[i]!.length} gaps → boundary=${boundaries[i]!.toFixed(1)}`);
    });

    return boundaries;
}

/** Column-aware merge: prevent merging elements across column boundaries */
function mergeWithBoundaries(lines: any[], boundaries: number[]): any[] {
    const mergedLines: any[] = [];
    for (const line of lines) {
        if (line.elements.length <= 1) { mergedLines.push(line); continue; }
        const sorted = [...line.elements].sort((a: any, b: any) => a.x - b.x);
        const merged: any[] = [];
        let cur = { ...sorted[0]! };
        for (let i = 1; i < sorted.length; i++) {
            const next = sorted[i]!;
            const gap = next.x - (cur.x + cur.width);
            const threshold = 1.0 * Math.max(cur.fontSize, next.fontSize);
            
            // Check if a boundary falls between elements
            const curRight = cur.x + cur.width;
            const nextLeft = next.x;
            let crossesBoundary = false;
            for (const b of boundaries) {
                if (b > curRight - 1 && b < nextLeft + 1) {
                    crossesBoundary = true; break;
                }
            }
            
            if (gap < threshold && !crossesBoundary) {
                cur.text = (cur.text + ' ' + next.text).trim();
                cur.width = (next.x + next.width) - cur.x;
            } else {
                merged.push(cur);
                cur = { ...next };
            }
        }
        merged.push(cur);
        mergedLines.push({ y: line.y, averageFontSize: line.averageFontSize, elements: merged });
    }
    return mergedLines;
}

/** Map elements to grid using boundaries */
function mapWithBoundaries(lines: any[], boundaries: number[]): string[][] {
    const numCols = boundaries.length + 1;
    const grid: string[][] = [];
    for (const line of lines) {
        const row = Array(numCols).fill('');
        for (const el of line.elements) {
            const startX = el.x, endX = el.x + el.width;
            let bestIdx = 0, bestOv = 0;
            for (let i = 0; i < numCols; i++) {
                const lo = i === 0 ? 0 : boundaries[i - 1]!;
                const hi = i === numCols - 1 ? Infinity : boundaries[i]!;
                const ov = Math.max(0, Math.min(endX, hi) - Math.max(startX, lo));
                if (ov > bestOv) { bestOv = ov; bestIdx = i; }
            }
            row[bestIdx] = row[bestIdx] ? (row[bestIdx] + ' ' + el.text).trim() : el.text;
        }
        grid.push(row);
    }
    return grid;
}

describe('Header-Anchored Gap-Voting', () => {
    it('should correctly detect boundaries and map all columns', async () => {
        const pdfPath = 'C:\\Users\\O5A00001315\\Downloads\\Ban CNTT-HPC - Wifi-mã vạch.pdf';
        if (!fs.existsSync(pdfPath)) {
            console.warn(`[align_gap] PDF file not found at ${pdfPath}. Skipping test.`);
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
        
        // New pipeline:
        const boundaries = detectColumnBoundaries(rawLines);
        const mergedLines = mergeWithBoundaries(rawLines, boundaries);
        const grid = mapWithBoundaries(mergedLines, boundaries);

        console.log(`\n=== BOUNDARIES: [${boundaries.map(b => b.toFixed(1)).join(', ')}] ===`);
        console.log(`=== ${boundaries.length + 1} COLUMNS ===\n`);

        console.log("=== OUTPUT ROWS ===");
        grid.forEach((row, idx) => {
            const content = row.join(' | ');
            if (content.trim()) console.log(`Line ${idx}: ${content}`);
        });

        // Verify header row
        const headerRow = grid[1]!;
        expect(headerRow).toBeDefined();
        expect(headerRow[0]).toContain('STT');
        expect(headerRow[3]).toContain('SL');
        expect(headerRow[4]).toContain('Vị trí');

        // Verify data row 3 (row 1): "8)" should be in SL tổng, "X4: 1 bộ" in Vị trí
        const dataRow = grid[3]!;
        console.log(`\nVerify data row 3:`);
        console.log(`  Col 3 (SL tổng): "${dataRow[3]}"`);
        console.log(`  Col 4 (Vị trí): "${dataRow[4]}"`);
        expect(dataRow[3]).toContain('8');
        expect(dataRow[4]).toContain('X4');

        // Verify "X1: 6 bộ" is in Vị trí (col 4), not SL tổng (col 3)
        const detailRow = grid[2]!;
        console.log(`\nVerify detail row 2:`);
        console.log(`  Col 3 (SL tổng): "${detailRow[3]}"`);
        console.log(`  Col 4 (Vị trí): "${detailRow[4]}"`);
        expect(detailRow[4]).toContain('X1');
    });
});
