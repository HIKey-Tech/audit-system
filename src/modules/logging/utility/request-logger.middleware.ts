// src/modules/logging/utility/request-logger.middleware.ts
import { Request, Response, NextFunction } from 'express';
import { auditLogService } from '../service/implementation/audit-log.service';

const MODULE_ALIASES: Record<string, string> = {
  users: 'user',
  documents: 'document',
  notifications: 'messaging',
  jobs: 'background',
  logs: 'logging',
};

const getRequestPath = (req: Request): string => {
  const [path] = req.originalUrl.split('?');
  return path || req.path;
};

const getModuleFromPath = (path: string): string => {
  const segments = path.split('/').filter(Boolean);
  const routeModule = segments[0] === 'api' ? segments[2] : segments[0];

  if (!routeModule) {
    return 'unknown';
  }

  return MODULE_ALIASES[routeModule] ?? routeModule;
};

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
    const requestPath = getRequestPath(req);
    const module = getModuleFromPath(requestPath);

    auditLogService.logAsync({
      userId: req.user?.id,
      action: `${req.method}:${requestPath}`,
      module,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      status: res.statusCode < 400 ? 'success' : 'failure',
      durationMs,
    });
  });

  next();
};
