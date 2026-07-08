import { describe, it, expect, vi, beforeEach } from 'vitest';
import { pdfOcrService } from '../PdfOcrService';
import { PdfOcrTargetFormat } from '@/types/pdf';

vi.mock('pdfjs-dist', () => {
    return {
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
                                str: 'Sample Header',
                                transform: [24, 0, 0, 24, 10, 100],
                                width: 100,
                                height: 24
                            },
                            {
                                str: 'Row 1 Col 1',
                                transform: [12, 0, 0, 12, 10, 80],
                                width: 50,
                                height: 12
                            },
                            {
                                str: 'Row 1 Col 2',
                                transform: [12, 0, 0, 12, 60, 80],
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

describe('PdfOcrService Integration', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should successfully parse a digital PDF and output a valid Word (.docx) buffer', async () => {
        const dummyBuffer = new Uint8Array([37, 80, 68, 70, 45, 49, 46, 52, 10]);
        const mockFile = new File([dummyBuffer], 'doc.pdf', { type: 'application/pdf' });

        const result = await pdfOcrService.process(mockFile, {
            targetFormat: PdfOcrTargetFormat.WORD
        });

        expect(result.success).toBe(true);
        expect(result.filename).toBe('doc.docx');
        expect(result.mimeType).toBe('application/vnd.openxmlformats-officedocument.wordprocessingml.document');
        expect(result.data).toBeInstanceOf(ArrayBuffer);
        expect(result.data!.byteLength).toBeGreaterThan(0);
    });

    it('should successfully parse a digital PDF and output a valid Excel (.xlsx) buffer', async () => {
        const dummyBuffer = new Uint8Array([37, 80, 68, 70, 45, 49, 46, 52, 10]);
        const mockFile = new File([dummyBuffer], 'sheet.pdf', { type: 'application/pdf' });

        const result = await pdfOcrService.process(mockFile, {
            targetFormat: PdfOcrTargetFormat.EXCEL
        });

        expect(result.success).toBe(true);
        expect(result.filename).toBe('sheet.xlsx');
        expect(result.mimeType).toBe('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        expect(result.data).toBeInstanceOf(ArrayBuffer);
        expect(result.data!.byteLength).toBeGreaterThan(0);
    });
});
