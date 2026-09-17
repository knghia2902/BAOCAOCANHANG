import { ExcelService } from './ExcelService';

// Singleton instance
export const excelService = new ExcelService();

export * from './interfaces';
export * from './excel/AllocatorService';
