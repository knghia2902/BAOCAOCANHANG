import { describe, it, expect, vi } from 'vitest';
import * as pdfjsLib from 'pdfjs-dist';
import { pdfOcrService } from '../PdfOcrService';
import { PdfOcrTargetFormat } from '@/types/pdf';

vi.mock('pdfjs-dist', async (importOriginal) => {
    const original = await importOriginal<typeof import('pdfjs-dist')>();
    return {
        ...original,
        GlobalWorkerOptions: {
            workerSrc: ''
        },
        getDocument: vi.fn().mockReturnValue({
            promise: Promise.resolve({
                numPages: 1,
                getPage: vi.fn().mockResolvedValue({
                    getTextContent: vi.fn().mockResolvedValue({
                        items: [
                            {
                                str: 'Row 1 Col 1',
                                transform: [12, 0, 0, 12, 10, 100],
                                width: 50,
                                height: 12
                            },
                            {
                                str: 'Row 1 Col 2',
                                transform: [12, 0, 0, 12, 100, 100],
                                width: 50,
                                height: 12
                            }
                        ]
                    })
                })
            })
        })
    };
});

describe('PdfOcrService - Digital PDF Parsing', () => {
    it('should successfully parse a digital PDF and extract text coordinates', async () => {
        const dummyBuffer = new Uint8Array([37, 80, 68, 70, 45, 49, 46, 52, 10]);
        const mockFile = new File([dummyBuffer], 'test-document.pdf', { type: 'application/pdf' });
        
        let progressPercent = 0;
        let progressMsg = '';
        const options = {
            targetFormat: PdfOcrTargetFormat.WORD,
            onProgress: (msg: string, percentage: number) => {
                progressPercent = percentage;
                progressMsg = msg;
            }
        };

        const result = await pdfOcrService.process(mockFile, options);

        expect(result.success).toBe(true);
        expect(result.filename).toBe('test-document.docx');
        expect(result.mimeType).toBe('application/vnd.openxmlformats-officedocument.wordprocessingml.document');
        expect(progressPercent).toBe(100);
        expect(progressMsg).toBe('Digital text parsed successfully');
        expect(pdfjsLib.getDocument).toHaveBeenCalled();
    });

    it('should calculate correct filename and mimeType for EXCEL target format', async () => {
        const dummyBuffer = new Uint8Array([37, 80, 68, 70, 45, 49, 46, 52, 10]);
        const mockFile = new File([dummyBuffer], 'sample.pdf', { type: 'application/pdf' });
        
        const result = await pdfOcrService.process(mockFile, {
            targetFormat: PdfOcrTargetFormat.EXCEL
        });

        expect(result.success).toBe(true);
        expect(result.filename).toBe('sample.xlsx');
        expect(result.mimeType).toBe('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    });
});
