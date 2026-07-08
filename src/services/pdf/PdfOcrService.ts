import * as pdfjsLib from 'pdfjs-dist';
import { createWorker } from 'tesseract.js';
import type { PdfOcrOptions, PdfOcrResult, TextElement, LineGroup } from '@/types/pdf';
import { coordinateSorter } from './CoordinateSorter';
import { documentBuilder } from './DocumentBuilder';

const loadImageToCanvas = (file: File, scale: number = 2.0): Promise<HTMLCanvasElement> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                canvas.width = img.naturalWidth * scale;
                canvas.height = img.naturalHeight * scale;
                const ctx = canvas.getContext('2d');
                if (ctx) {
                    ctx.imageSmoothingEnabled = true;
                    ctx.imageSmoothingQuality = 'high';
                    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                    resolve(canvas);
                } else {
                    reject(new Error('Failed to get 2D context'));
                }
            };
            img.onerror = () => reject(new Error('Failed to load image'));
            img.src = e.target?.result as string;
        };
        reader.onerror = () => reject(new Error('Failed to read file'));
        reader.readAsDataURL(file);
    });
};

const preprocessCanvasForOcr = (canvas: HTMLCanvasElement): void => {
    const ctx = canvas.getContext('2d');
    if (!ctx || typeof ctx.getImageData !== 'function') return;
    const width = canvas.width;
    const height = canvas.height;
    const imageData = ctx.getImageData(0, 0, width, height);
    const data = imageData.data;
    
    const pixels = new Uint8Array(width * height);
    const threshold = 190;
    
    // 1. Grayscale and Binarize
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const idx = (y * width + x) * 4;
            const r = data[idx]!;
            const g = data[idx + 1]!;
            const b = data[idx + 2]!;
            const gray = 0.299 * r + 0.587 * g + 0.114 * b;
            const isBlack = gray <= threshold;
            pixels[y * width + x] = isBlack ? 1 : 0;
        }
    }
    
    // 2. Line detection and erasure
    const toRemove = new Uint8Array(width * height);
    const H_LINE_LEN = 60;
    const V_LINE_LEN = 60;
    
    // Horizontal lines
    for (let y = 0; y < height; y++) {
        let runStart = -1;
        for (let x = 0; x < width; x++) {
            if (pixels[y * width + x] === 1) {
                if (runStart === -1) runStart = x;
            } else {
                if (runStart !== -1) {
                    const runLen = x - runStart;
                    if (runLen >= H_LINE_LEN) {
                        for (let rx = runStart; rx < x; rx++) {
                            toRemove[y * width + rx] = 1;
                        }
                    }
                    runStart = -1;
                }
            }
        }
        if (runStart !== -1) {
            const runLen = width - runStart;
            if (runLen >= H_LINE_LEN) {
                for (let rx = runStart; rx < width; rx++) {
                    toRemove[y * width + rx] = 1;
                }
            }
        }
    }
    
    // Vertical lines
    for (let x = 0; x < width; x++) {
        let runStart = -1;
        for (let y = 0; y < height; y++) {
            if (pixels[y * width + x] === 1) {
                if (runStart === -1) runStart = y;
            } else {
                if (runStart !== -1) {
                    const runLen = y - runStart;
                    if (runLen >= V_LINE_LEN) {
                        for (let ry = runStart; ry < y; ry++) {
                            toRemove[ry * width + x] = 1;
                        }
                    }
                    runStart = -1;
                }
            }
        }
        if (runStart !== -1) {
            const runLen = height - runStart;
            if (runLen >= V_LINE_LEN) {
                for (let ry = runStart; ry < height; ry++) {
                    toRemove[ry * width + x] = 1;
                }
            }
        }
    }
    
    // 3. Write back to imageData
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const idx = (y * width + x) * 4;
            if (toRemove[y * width + x] === 1) {
                data[idx] = 255;
                data[idx + 1] = 255;
                data[idx + 2] = 255;
            } else {
                const val = pixels[y * width + x] === 1 ? 0 : 255;
                data[idx] = val;
                data[idx + 1] = val;
                data[idx + 2] = val;
            }
            data[idx + 3] = 255; // Keep fully opaque
        }
    }
    
    ctx.putImageData(imageData, 0, 0);
};

export class PdfOcrService {
    private static PDF_WORKER_VERSION = '5.7.284';

    constructor() {
        // Initialize if necessary
    }

    /**
     * Parse digital PDF file or run OCR if requested, then build the target document
     */
    async process(file: File, options: PdfOcrOptions): Promise<PdfOcrResult> {
        try {
            // Configure PDF.js worker CDN route
            pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${PdfOcrService.PDF_WORKER_VERSION}/build/pdf.worker.min.mjs`;

            const isImage = file.type.startsWith('image/') || /\.(png|jpe?g)$/i.test(file.name);
            const pagesElements: TextElement[][] = [];
            const canvases: { canvas: HTMLCanvasElement; scale: number }[] = [];

            if (isImage) {
                const scale = 4.0;
                const canvas = await loadImageToCanvas(file, scale);
                preprocessCanvasForOcr(canvas);
                canvases.push({ canvas, scale });
            } else {
                const pdfBuffer = await file.arrayBuffer();
                const loadingTask = pdfjsLib.getDocument({ data: pdfBuffer });
                const pdf = await loadingTask.promise;

                let runOcr = options.useOcr;

                if (!runOcr) {
                    // Try extracting digital text first
                    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
                        const page = await pdf.getPage(pageNum);
                        const textContent = await page.getTextContent();
                        const pageElements: TextElement[] = [];

                        for (const item of textContent.items) {
                            if ('str' in item) {
                                const transform = item.transform;
                                pageElements.push({
                                    text: item.str,
                                    x: transform[4],
                                    y: transform[5],
                                    width: item.width || 0,
                                    height: item.height || 0,
                                    fontSize: Math.abs(transform[3])
                                });
                            }
                        }
                        pagesElements.push(pageElements);
                    }

                    // Fallback to OCR if no text elements found
                    const totalElementsCount = pagesElements.reduce((sum, list) => sum + list.length, 0);
                    if (totalElementsCount === 0) {
                        runOcr = true;
                    }
                }

                if (runOcr) {
                    pagesElements.length = 0; // Clear empty digital pages if falling back to OCR
                    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
                        const page = await pdf.getPage(pageNum);
                        const viewport = page.getViewport({ scale: 2.0 });
                        const canvas = document.createElement('canvas');
                        canvas.width = viewport.width;
                        canvas.height = viewport.height;
                        const context = canvas.getContext('2d');
                        if (!context) {
                            throw new Error('Failed to get 2d context for canvas');
                        }
                        await page.render({ canvasContext: context, canvas, viewport }).promise;
                        preprocessCanvasForOcr(canvas);
                        canvases.push({ canvas, scale: 2.0 });
                    }
                }
            }

            if (canvases.length > 0) {
                const totalPages = canvases.length;
                let currentPageIdx = 0;

                // Load traineddata from local server instead of CDN to prevent network loading failures
                const langPath = typeof window !== 'undefined'
                    ? `${window.location.origin}/tessdata`
                    : undefined;

                const worker = await createWorker('eng+vie', 1, {
                    langPath,
                    gzip: false,
                    logger: (m) => {
                        if (m.status === 'recognizing text' && options.onProgress) {
                            const pageProgress = m.progress || 0;
                            const currentPercentage = Math.round(
                                ((currentPageIdx + pageProgress) / totalPages) * 100
                            );
                            options.onProgress(
                                `OCR Page ${currentPageIdx + 1}/${totalPages}: ${Math.round(pageProgress * 100)}%`,
                                currentPercentage
                            );
                        }
                    }
                });

                if (typeof worker.setParameters === 'function') {
                    await worker.setParameters({
                        tessedit_pageseg_mode: '6' as any,
                    });
                }

                try {
                    for (let i = 0; i < totalPages; i++) {
                        currentPageIdx = i;
                        const item = canvases[i];
                        if (!item) continue;
                        const { canvas, scale } = item;
                        const { data } = await worker.recognize(canvas, {}, { blocks: true });
                        const pageData = data as any;
                        console.log(`[PDF/OCR Service] Page ${i + 1} recognized raw text:`, pageData.text);
                        console.log(`[PDF/OCR Service] Page ${i + 1} words count:`, pageData.words?.length || 0);

                        let words: any[] = [];
                        if (pageData.words && pageData.words.length > 0) {
                            words = pageData.words;
                        } else if (pageData.blocks) {
                            for (const block of pageData.blocks) {
                                for (const paragraph of block.paragraphs) {
                                    for (const line of paragraph.lines) {
                                        for (const word of line.words) {
                                            words.push(word);
                                        }
                                    }
                                }
                            }
                        }
                        const pageHeight = canvas.height;

                        const pageElements: TextElement[] = [];
                        for (const word of words) {
                            pageElements.push({
                                text: word.text,
                                x: word.bbox.x0 / scale,
                                y: (pageHeight - word.bbox.y1) / scale,
                                width: (word.bbox.x1 - word.bbox.x0) / scale,
                                height: (word.bbox.y1 - word.bbox.y0) / scale,
                                fontSize: (word.bbox.y1 - word.bbox.y0) / scale
                            });
                        }
                        pagesElements.push(pageElements);

                        if (options.onProgress) {
                            options.onProgress(
                                `Processed page ${i + 1}/${totalPages}`,
                                Math.round(((i + 1) / totalPages) * 100)
                            );
                        }
                    }
                } finally {
                    await worker.terminate();
                }
            } else {
                if (options.onProgress) {
                    options.onProgress('Digital text parsed successfully', 100);
                }
            }

            const totalElements = pagesElements.reduce((sum, list) => sum + list.length, 0);
            console.log(`[PDF/OCR Service] Total elements extracted: ${totalElements}`);

            // Group elements using CoordinateSorter page-by-page
            const pagesLines: LineGroup[][] = pagesElements.map(pageEls =>
                coordinateSorter.groupElementsByY(pageEls)
            );
            const totalLinesCount = pagesLines.reduce((sum, list) => sum + list.length, 0);
            console.log(`[PDF/OCR Service] Total grouped lines across pages: ${totalLinesCount}`);

            // Build the appropriate document based on format
            let data: ArrayBuffer;
            if (options.targetFormat === 'docx') {
                console.log(`[PDF/OCR Service] Building Word document with ${pagesLines.length} pages`);
                data = await documentBuilder.buildWordDocument(pagesLines);
            } else {
                console.log(`[PDF/OCR Service] Building Excel document with ${pagesLines.length} pages`);
                data = await documentBuilder.buildExcelDocument(pagesLines);
            }

            // Generate 2D string grid for UI preview before downloading
            const pagesGrids: string[][][] = pagesLines.map(pageLines => {
                const boundaries = documentBuilder.detectColumnBoundaries(pageLines);
                let lines: LineGroup[];
                if (boundaries.length > 0) {
                    lines = documentBuilder.mergeWithBoundaries(pageLines, boundaries);
                    return documentBuilder.mapWithBoundaries(lines, boundaries);
                } else {
                    lines = documentBuilder.mergeCloseElements(pageLines);
                    return documentBuilder.mapToExcelGrid(lines, 15);
                }
            });

            // Target metadata
            const filename = file.name.replace(/\.[^/.]+$/, '') + `.${options.targetFormat}`;
            const mimeType = options.targetFormat === 'docx'
                ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
                : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

            return {
                success: true,
                filename,
                mimeType,
                data,
                pagesGrids
            };

        } catch (error) {
            console.error('PDF/OCR Processing failed:', error);
            return {
                success: false,
                filename: '',
                mimeType: '',
                error: error instanceof Error ? error.message : String(error)
            };
        }
    }
}

export const pdfOcrService = new PdfOcrService();
