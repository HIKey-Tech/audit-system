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
    TOO_MANY_REQUESTS = "TOO_MANY_REQUESTS",
    INTERNAL_ERROR = "INTERNAL_ERROR",
    SERVICE_UNAVAILABLE = "SERVICE_UNAVAILABLE",
    BAD_GATEWAY = "BAD_GATEWAY",
    GATEWAY_TIMEOUT = "GATEWAY_TIMEOUT",
    DATABASE_ERROR = "DATABASE_ERROR",
    OPERATION_FAILED = "OPERATION_FAILED",
    INVALID_STATE = "INVALID_STATE"
}
/** Shown to users whenever a permission check fails — points them to who can fix it. */
export declare const PERMISSION_DENIED_MESSAGE = "You don't have permission to do this. Please contact your system administrator.";
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
    static tooManyRequests(message?: string): AppError;
    static validationError(details: unknown): AppError;
    static internal(message?: string): AppError;
    static serviceUnavailable(message?: string): AppError;
    static badGateway(message?: string): AppError;
    static gatewayTimeout(message?: string): AppError;
}
//# sourceMappingURL=app.error.d.ts.map