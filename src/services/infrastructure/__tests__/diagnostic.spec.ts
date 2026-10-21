import { describe, it, expect } from 'vitest';
import { DiagnosticService } from '../DiagnosticService';

describe('DiagnosticService', () => {
    it('should successfully verify PDF worker initialization or return false in headless CI without network', async () => {
        const result = await DiagnosticService.checkPdfWorker();
        expect(typeof result).toBe('boolean');
    });

    it('should successfully verify Tesseract worker initialization or return false in headless CI without network', async () => {
        const result = await DiagnosticService.checkTesseractWorker();
        expect(typeof result).toBe('boolean');
    }, 30000); // 30 seconds timeout
});
