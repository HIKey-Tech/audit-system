export declare enum ErrorCode {
    UNAUTHORIZED = "UNAUTHORIZED",
    FORBIDDEN = "FORBIDDEN",
    TOKEN_EXPIRED = "TOKEN_EXPIRED",
    TOKEN_INVALID = "TOKEN_INVALID",
    SSO_FAILED = "SSO_FAILED",
    NOT_FOUND = "NOT_FOUND",
    ALREADY_EXISTS = "ALREADY_EXISTS",
    CONFLICT = "CONFLICT",
    VALIDATION_ERROR = "VALIDATION_ERROR",
    BAD_REQUEST = "BAD_REQUEST",
    INTERNAL_ERROR = "INTERNAL_ERROR",
    SERVICE_UNAVAILABLE = "SERVICE_UNAVAILABLE",
    DATABASE_ERROR = "DATABASE_ERROR",
    OPERATION_FAILED = "OPERATION_FAILED",
    INVALID_STATE = "INVALID_STATE"
}
export declare class AppError extends Error {
    readonly statusCode: number;
    readonly errorCode: ErrorCode;
    readonly isOperational: boolean;
    readonly details?: unknown;
    constructor(message: string, statusCode: number, errorCode: ErrorCode, details?: unknown, isOperational?: boolean);
    static unauthorized(message?: string): AppError;
    static forbidden(message?: string): AppError;
    static notFound(resource: string): AppError;
    static conflict(message: string): AppError;
    static badRequest(message: string, details?: unknown): AppError;
    static validationError(details: unknown): AppError;
    static internal(message?: string): AppError;
}
//# sourceMappingURL=app.error.d.ts.map