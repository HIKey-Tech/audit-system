// src/shared/middleware/error-handler.middleware.ts
import { Request, Response, NextFunction } from 'express';
import { AppError } from '../errors/app.error';
import { logger } from '../utils/logger.util';
import { ApiResponse } from '../types/api-response.type';

export const errorHandlerMiddleware = (
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction,
): void => {
  const requestId = req.headers['x-request-id'] as string;

  if (err instanceof AppError) {
    if (!err.isOperational) {
      logger.error('Unhandled application error', { err, requestId, path: req.path });
    } else {
      logger.warn( 'Operational error', { errorCode: err.errorCode, message: err.message, path: req.path });
    }

    const response: ApiResponse = {
      success: false,
      message: err.message,
      errors: err.details,
      timestamp: new Date().toISOString(),
      requestId,
    };

    res.status(err.statusCode).json(response);
    return;
  }

  // Prisma error handling
  if (err.name === 'PrismaClientKnownRequestError') {
    const prismaErr = err as unknown as { code: string; meta?: Record<string, unknown> };
    logger.error( 'Prisma error', { prismaCode: prismaErr.code, meta: prismaErr.meta, path: req.path });

    res.status(400).json({
      success: false,
      message: 'Database operation failed',
      timestamp: new Date().toISOString(),
      requestId,
    } as ApiResponse);
    return;
  }

  // Unknown errors
  logger.error('Unexpected error', { err, requestId, path: req.path });

  res.status(500).json({
    success: false,
    message: 'An unexpected error occurred',
    timestamp: new Date().toISOString(),
    requestId,
  } as ApiResponse);
};

export const notFoundMiddleware = (req: Request, res: Response): void => {
  res.status(404).json({
    success: false,
    message: `Route ${req.method} ${req.path} not found`,
    timestamp: new Date().toISOString(),
  } as ApiResponse);
};