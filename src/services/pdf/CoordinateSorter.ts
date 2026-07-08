import type { TextElement, LineGroup } from '@/types/pdf';

export class CoordinateSorter {
    /**
     * Groups text elements into line groups based on Y coordinate with dynamic font height threshold.
     */
    groupElementsByY(elements: TextElement[]): LineGroup[] {
        // 1. Filter out empty elements
        const activeElements = elements.filter(el => el.text && el.text.trim() !== '');

        // 2. Sort elements by Y descending (highest Y first since origin is bottom-left)
        activeElements.sort((a, b) => b.y - a.y);

        const lines: LineGroup[] = [];

        for (const el of activeElements) {
            // Find an existing line where the Y distance is within the threshold:
            // threshold = 0.5 * Math.max(el.fontSize, line.averageFontSize)
            const matchingLine = lines.find(line => {
                const distance = Math.abs(el.y - line.y);
                const threshold = 0.8 * Math.max(el.fontSize, line.averageFontSize);
                return distance < threshold;
            });

            if (matchingLine) {
                matchingLine.elements.push(el);
                const totalElements = matchingLine.elements.length;
                matchingLine.y = (matchingLine.y * (totalElements - 1) + el.y) / totalElements;
                matchingLine.averageFontSize = (matchingLine.averageFontSize * (totalElements - 1) + el.fontSize) / totalElements;
            } else {
                lines.push({
                    y: el.y,
                    averageFontSize: el.fontSize,
                    elements: [el]
                });
            }
        }

        // 3. Sort elements in each line left-to-right (X ascending)
        for (const line of lines) {
            line.elements.sort((a, b) => a.x - b.x);
        }

        return lines;
    }

    /**
     * Maps line groups to a 2D Excel string grid based on X coordinate clustering.
     */
    mapToExcelGrid(lines: LineGroup[], clusterThreshold: number = 12): string[][] {
        // 1. Gather all unique starting X coordinates across the entire document
        const xCoordinates: number[] = [];
        for (const line of lines) {
            for (const el of line.elements) {
                xCoordinates.push(el.x);
            }
        }
        
        if (xCoordinates.length === 0) {
            return [];
        }

        xCoordinates.sort((a, b) => a - b);

        // 2. Group close X coordinates (1D Clustering)
        const columnClusters: number[][] = [];
        for (const x of xCoordinates) {
            let added = false;
            for (const cluster of columnClusters) {
                const avg = cluster.reduce((sum, val) => sum + val, 0) / cluster.length;
                if (Math.abs(x - avg) < clusterThreshold) {
                    cluster.push(x);
                    added = true;
                    break;
                }
            }
            if (!added) {
                columnClusters.push([x]);
            }
        }

        // 3. Sort column clusters by average X ascending
        const columnHeaders = columnClusters
            .map(cluster => cluster.reduce((sum, val) => sum + val, 0) / cluster.length)
            .sort((a, b) => a - b);

        // 4. Align row elements to their closest column marker
        const grid: string[][] = [];
        for (const line of lines) {
            const row = Array(columnHeaders.length).fill('');
            for (const el of line.elements) {
                // Find closest column index
                let closestIdx = 0;
                let minDiff = Infinity;
                for (let i = 0; i < columnHeaders.length; i++) {
                    const diff = Math.abs(el.x - columnHeaders[i]!);
                    if (diff < minDiff) {
                        minDiff = diff;
                        closestIdx = i;
                    }
                }
                // Append if multiple elements map to the same cell
                row[closestIdx] = row[closestIdx] 
                    ? (row[closestIdx] + ' ' + el.text).trim() 
                    : el.text;
            }
            grid.push(row);
        }

        return grid;
    }
}

export const coordinateSorter = new CoordinateSorter();
