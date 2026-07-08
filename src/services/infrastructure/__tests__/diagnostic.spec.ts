import { describe, it, expect } from 'vitest';
import { DiagnosticService } from '../DiagnosticService';

describe('DiagnosticService', () => {
    it('should successfully verify PDF worker initialization', async () => {
        const result = await DiagnosticService.checkPdfWorker();
        expect(result).toBe(true);
    });

    it('should successfully verify Tesseract worker initialization', async () => {
        // Running a real Tesseract worker compilation in Vitest might take a few seconds
        const result = await DiagnosticService.checkTesseractWorker();
        expect(result).toBe(true);
    }, 30000); // 30 seconds timeout
});
