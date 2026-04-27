export interface ApiResponse<T = void> {
    success: boolean;
    message: string;
    data?: T;
    errors?: unknown;
    meta?: PaginationMeta;
    timestamp: string;
    requestId?: string;
}
export interface PaginationMeta {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
}
export interface PaginationQuery {
    page?: number;
    pageSize?: number;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
    search?: string;
}
export declare const buildResponse: <T>(data: T, message?: string, meta?: PaginationMeta) => ApiResponse<T>;
export declare const buildPaginationMeta: (total: number, page: number, pageSize: number) => PaginationMeta;
export declare const parsePagination: (query: PaginationQuery) => {
    skip: number;
    take: number;
    page: number;
    pageSize: number;
};
//# sourceMappingURL=api-response.type.d.ts.map