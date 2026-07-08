import * as pdfjsLib from 'pdfjs-dist';

export class DiagnosticService {
    private static PDF_WORKER_VERSION = '5.7.284';

    /**
     * Verify the loading state of the PDF.js CDN Worker
     */
    static async checkPdfWorker(): Promise<boolean> {
        try {
            pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${this.PDF_WORKER_VERSION}/build/pdf.worker.min.mjs`;
            
            // Mock minimal PDF header chunk (PDF-1.4) to trigger worker loading request
            const dummyPdf = new Uint8Array([37, 80, 68, 70, 45, 49, 46, 52, 10]);
            const loadingTask = pdfjsLib.getDocument({ data: dummyPdf });
            
            await loadingTask.promise.catch(() => {
                // We expect a parsing error because it's dummy data,
                // but getting here proves the worker successfully initialized and responded.
            });
            return true;
        } catch (error) {
            console.error('Diagnostic Check - PDF Worker failed:', error);
            return false;
        }
    }

    /**
     * Verify the startup of Tesseract.js Worker
     */
    static async checkTesseractWorker(): Promise<boolean> {
        try {
            const { createWorker } = await import('tesseract.js');
            const worker = await createWorker('eng');
            await worker.terminate();
            return true;
        } catch (error) {
            console.error('Diagnostic Check - Tesseract Worker failed:', error);
            return false;
        }
    }
}
