export interface IExcelService {
    /**
     * Export data to an Excel file.
     * @param data Array of data objects
     * @param columns Column configuration
     * @param filename Output filename
     */
    exportData<T>(data: T[], columns: any[], filename: string): Promise<void>;

    /**
     * Import data from an Excel file.
     * @param file The uploaded Excel file
     * @returns Array of parsed data objects
     */
    importData<T>(file: File): Promise<T[]>;
}
