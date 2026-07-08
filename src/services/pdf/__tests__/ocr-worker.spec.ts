import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createWorker } from 'tesseract.js';
import { pdfOcrService } from '../PdfOcrService';
import { PdfOcrTargetFormat } from '@/types/pdf';

// Mock pdfjs-dist
vi.mock('pdfjs-dist', () => {
    const mockRender = vi.fn().mockReturnValue({
        promise: Promise.resolve()
    });
    const mockGetPage = vi.fn().mockResolvedValue({
        getViewport: vi.fn().mockReturnValue({ width: 200, height: 300 }),
        render: mockRender,
        getTextContent: vi.fn().mockResolvedValue({ items: [] }) // Scanned PDF has no text items
    });
    return {
        GlobalWorkerOptions: {
            workerSrc: ''
        },
        getDocument: vi.fn().mockReturnValue({
            promise: Promise.resolve({
                numPages: 2,
                getPage: mockGetPage
            })
        })
    };
});

// Mock tesseract.js
vi.mock('tesseract.js', () => {
    const mockTerminate = vi.fn().mockResolvedValue(undefined);
    const mockRecognize = vi.fn().mockImplementation(async () => {
        return {
            data: {
                blocks: [
                    {
                        paragraphs: [
                            {
                                lines: [
                                    {
                                        words: [
                                            { text: 'MockText', bbox: { x0: 20, y0: 20, x1: 100, y1: 40 } }
                                        ]
                                    }
                                ]
                            }
                        ]
                    }
                ]
            }
        };
    });

    const mockCreateWorker = vi.fn().mockImplementation(async (_langs, _oem, options) => {
        const logger = options?.logger;
        return {
            recognize: async () => {
                if (logger) {
                    logger({ status: 'recognizing text', progress: 0.5 });
                    logger({ status: 'recognizing text', progress: 1.0 });
                }
                return mockRecognize();
            },
            terminate: mockTerminate
        };
    });

    return {
        createWorker: mockCreateWorker,
        _mockTerminate: mockTerminate,
        _mockRecognize: mockRecognize
    };
});

describe('Tesseract OCR Worker Integration', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({} as any);
    });

    it('should run OCR and calculate correct page-by-page progress percentage', async () => {
        const dummyBuffer = new Uint8Array([37, 80, 68, 70, 45, 49, 46, 52, 10]);
        const mockFile = new File([dummyBuffer], 'scanned-doc.pdf', { type: 'application/pdf' });

        const progressCalls: { message: string; percentage: number }[] = [];
        const options = {
            targetFormat: PdfOcrTargetFormat.WORD,
            useOcr: true,
            onProgress: (message: string, percentage: number) => {
                progressCalls.push({ message, percentage });
            }
        };

        const result = await pdfOcrService.process(mockFile, options);

        expect(result.success).toBe(true);
        expect(createWorker).toHaveBeenCalledWith('eng+vie', 1, expect.any(Object));

        expect(progressCalls).toContainEqual({
            message: 'OCR Page 1/2: 50%',
            percentage: 25
        });
        expect(progressCalls).toContainEqual({
            message: 'OCR Page 2/2: 50%',
            percentage: 75
        });
        expect(progressCalls).toContainEqual({
            message: 'Processed page 2/2',
            percentage: 100
        });

        const { _mockTerminate } = await import('tesseract.js') as any;
        expect(_mockTerminate).toHaveBeenCalled();
    });

    it('should terminate the worker in a finally block even if recognize throws an error', async () => {
        const dummyBuffer = new Uint8Array([37, 80, 68, 70, 45, 49, 46, 52, 10]);
        const mockFile = new File([dummyBuffer], 'scanned-doc.pdf', { type: 'application/pdf' });

        const { _mockRecognize, _mockTerminate } = await import('tesseract.js') as any;
        _mockRecognize.mockRejectedValueOnce(new Error('Recognize failed'));

        const options = {
            targetFormat: PdfOcrTargetFormat.WORD,
            useOcr: true
        };

        const result = await pdfOcrService.process(mockFile, options);

        expect(result.success).toBe(false);
        expect(result.error).toContain('Recognize failed');
        expect(_mockTerminate).toHaveBeenCalled();
    });
});
