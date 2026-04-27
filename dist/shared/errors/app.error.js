"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppError = exports.ErrorCode = void 0;
// src/shared/errors/app.error.ts
var ErrorCode;
(function (ErrorCode) {
    // Auth
    ErrorCode["UNAUTHORIZED"] = "UNAUTHORIZED";
    ErrorCode["FORBIDDEN"] = "FORBIDDEN";
    ErrorCode["TOKEN_EXPIRED"] = "TOKEN_EXPIRED";
    ErrorCode["TOKEN_INVALID"] = "TOKEN_INVALID";
    ErrorCode["SSO_FAILED"] = "SSO_FAILED";
    // Resources
    ErrorCode["NOT_FOUND"] = "NOT_FOUND";
    ErrorCode["ALREADY_EXISTS"] = "ALREADY_EXISTS";
    ErrorCode["CONFLICT"] = "CONFLICT";
    // Validation
    ErrorCode["VALIDATION_ERROR"] = "VALIDATION_ERROR";
    ErrorCode["BAD_REQUEST"] = "BAD_REQUEST";
    // Server
    ErrorCode["INTERNAL_ERROR"] = "INTERNAL_ERROR";
    ErrorCode["SERVICE_UNAVAILABLE"] = "SERVICE_UNAVAILABLE";
    ErrorCode["DATABASE_ERROR"] = "DATABASE_ERROR";
    // Business
    ErrorCode["OPERATION_FAILED"] = "OPERATION_FAILED";
    ErrorCode["INVALID_STATE"] = "INVALID_STATE";
})(ErrorCode || (exports.ErrorCode = ErrorCode = {}));
class AppError extends Error {
    statusCode;
    errorCode;
    isOperational;
    details;
    constructor(message, statusCode, errorCode, details, isOperational = true) {
        super(message);
        this.name = 'AppError';
        this.statusCode = statusCode;
        this.errorCode = errorCode;
        this.isOperational = isOperational;
        this.details = details;
        Error.captureStackTrace(this, this.constructor);
    }
    static unauthorized(message = 'Unauthorized') {
        return new AppError(message, 401, ErrorCode.UNAUTHORIZED);
    }
    static forbidden(message = 'Forbidden') {
        return new AppError(message, 403, ErrorCode.FORBIDDEN);
    }
    static notFound(resource) {
        return new AppError(`${resource} not found`, 404, ErrorCode.NOT_FOUND);
    }
    static conflict(message) {
        return new AppError(message, 409, ErrorCode.CONFLICT);
    }
    static badRequest(message, details) {
        return new AppError(message, 400, ErrorCode.BAD_REQUEST, details);
    }
    static validationError(details) {
        return new AppError('Validation failed', 422, ErrorCode.VALIDATION_ERROR, details);
    }
    static internal(message = 'Internal server error') {
        return new AppError(message, 500, ErrorCode.INTERNAL_ERROR, undefined, false);
    }
}
exports.AppError = AppError;
//# sourceMappingURL=app.error.js.map