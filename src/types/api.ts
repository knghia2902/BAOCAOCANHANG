export interface IApiResponse<T> {
    data: T;
    message?: string;
    statusCode: number;
}

export interface IPaginatedResponse<T> extends IApiResponse<T[]> {
    total: number;
    page: number;
    limit: number;
}
