// src/shared/errors/app.error.ts
export enum ErrorCode {
  // Auth
  UNAUTHORIZED = 'UNAUTHORIZED',
  FORBIDDEN = 'FORBIDDEN',
  TOKEN_EXPIRED = 'TOKEN_EXPIRED',
  TOKEN_INVALID = 'TOKEN_INVALID',
  SSO_FAILED = 'SSO_FAILED',

  // Resources
  NOT_FOUND = 'NOT_FOUND',
  ALREADY_EXISTS = 'ALREADY_EXISTS',
  CONFLICT = 'CONFLICT',

  // Validation
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  BAD_REQUEST = 'BAD_REQUEST',

  // Server
  INTERNAL_ERROR = 'INTERNAL_ERROR',
  SERVICE_UNAVAILABLE = 'SERVICE_UNAVAILABLE',
  DATABASE_ERROR = 'DATABASE_ERROR',

  // Business
  OPERATION_FAILED = 'OPERATION_FAILED',
  INVALID_STATE = 'INVALID_STATE',
}

export class AppError extends Error {
  public readonly statusCode: number;
  public readonly errorCode: ErrorCode;
  public readonly isOperational: boolean;
  public readonly details?: unknown;

  constructor(
    message: string,
    statusCode: number,
    errorCode: ErrorCode,
    details?: unknown,
    isOperational = true,
  ) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.errorCode = errorCode;
    this.isOperational = isOperational;
    this.details = details;
    Error.captureStackTrace(this, this.constructor);
  }

  static unauthorized(message = 'Unauthorized'): AppError {
    return new AppError(message, 401, ErrorCode.UNAUTHORIZED);
  }

  static forbidden(message = 'Forbidden'): AppError {
    return new AppError(message, 403, ErrorCode.FORBIDDEN);
  }

  static notFound(resource: string): AppError {
    return new AppError(`${resource} not found`, 404, ErrorCode.NOT_FOUND);
  }

  static conflict(message: string): AppError {
    return new AppError(message, 409, ErrorCode.CONFLICT);
  }

  static badRequest(message: string, details?: unknown): AppError {
    return new AppError(message, 400, ErrorCode.BAD_REQUEST, details);
  }

  static validationError(details: unknown): AppError {
    return new AppError('Validation failed', 422, ErrorCode.VALIDATION_ERROR, details);
  }

  static internal(message = 'Internal server error'): AppError {
    return new AppError(message, 500, ErrorCode.INTERNAL_ERROR, undefined, false);
  }
}