export interface IColumnConfig {
    header: string;
    key: string;
    width?: number;
    style?: Record<string, any>;
}

export interface IRowData {
    [key: string]: any;
}

export interface IImportResult<T> {
    data: T[];
    errors?: string[];
    success: boolean;
}
