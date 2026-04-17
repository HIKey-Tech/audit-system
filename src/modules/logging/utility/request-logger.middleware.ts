// src/modules/logging/utility/request-logger.middleware.ts
import { Request, Response, NextFunction } from 'express';
import { auditLogService } from '../service/implementation/audit-log.service';

/**
 * Express middleware that automatically logs mutating requests (POST/PUT/PATCH/DELETE)
 * to the audit log after the response is sent.
 */
export const requestAuditLogger = (
  req: Request,
  res: Response,
  next: NextFunction,
): void => {
  const MUTATING = ['POST', 'PUT', 'PATCH', 'DELETE'];

  if (!MUTATING.includes(req.method)) {
    return next();
  }

  const startAt = Date.now();

  res.on('finish', () => {
    const durationMs = Date.now() - startAt;
    const [, , module] = req.path.split('/'); // /api/v1/<module>/...

    auditLogService.logAsync({
      userId: req.user?.id,
      action: `${req.method}:${req.path}`,
      module: module ?? 'unknown',
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      status: res.statusCode < 400 ? 'success' : 'failure',
      durationMs,
    });
  });

  next();
};
