"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.notFoundMiddleware = exports.errorHandlerMiddleware = void 0;
const app_error_1 = require("../errors/app.error");
const logger_util_1 = require("../utils/logger.util");
const errorHandlerMiddleware = (err, req, res, _next) => {
    const requestId = req.headers['x-request-id'];
    if (err instanceof app_error_1.AppError) {
        if (!err.isOperational) {
            logger_util_1.logger.error('Unhandled application error', { err, requestId, path: req.path });
        }
        else {
            logger_util_1.logger.warn('Operational error', { errorCode: err.errorCode, message: err.message, path: req.path });
        }
        const response = {
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
        const prismaErr = err;
        logger_util_1.logger.error('Prisma error', { prismaCode: prismaErr.code, meta: prismaErr.meta, path: req.path });
        res.status(400).json({
            success: false,
            message: 'Database operation failed',
            timestamp: new Date().toISOString(),
            requestId,
        });
        return;
    }
    // Unknown errors
    logger_util_1.logger.error('Unexpected error', { err, requestId, path: req.path });
    res.status(500).json({
        success: false,
        message: 'An unexpected error occurred',
        timestamp: new Date().toISOString(),
        requestId,
    });
};
exports.errorHandlerMiddleware = errorHandlerMiddleware;
const notFoundMiddleware = (req, res) => {
    res.status(404).json({
        success: false,
        message: `Route ${req.method} ${req.path} not found`,
        timestamp: new Date().toISOString(),
    });
};
exports.notFoundMiddleware = notFoundMiddleware;
//# sourceMappingURL=error-handler.middleware.js.map