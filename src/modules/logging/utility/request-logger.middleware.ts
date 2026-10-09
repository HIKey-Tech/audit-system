// src/modules/logging/utility/request-logger.middleware.ts
import { Request, Response, NextFunction } from 'express';
import { auditLogService } from '../service/implementation/audit-log.service';
import { SecurityEvent } from '../domain/enum/logging.enum';
import { logSecurityEvent } from './security-event.utility';
import { runWithRequestContext } from '../../../shared/utils/request-context.util';

/**
 * Authentication endpoints already write a dedicated security event
 * (`auth.login.succeeded`, `auth.logout`, …) with the real user attached, so the
 * generic request row would only add an anonymous "System" duplicate.
 */
const SECURITY_EVENT_PATHS = /\/auth\/(login|logout|refresh)\/?$/;

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

const MUTATING = ['POST', 'PUT', 'PATCH', 'DELETE'];

/**
 * Express middleware that automatically logs mutating requests (POST/PUT/PATCH/DELETE)
 * to the audit log after the response is sent. Any request refused with 403 —
 * reads included — is additionally recorded as an `access.denied` security event.
 */
export const requestAuditLogger = (
  req: Request,
  res: Response,
  next: NextFunction,
): void => {
  const isMutating = MUTATING.includes(req.method);
  const startAt = Date.now();

  res.on('finish', () => {
    const requestPath = getRequestPath(req);

    if (res.statusCode === 403) {
      logSecurityEvent(SecurityEvent.AccessDenied, {
        userId: req.user?.id,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
        httpMethod: req.method,
        path: requestPath,
        status: 'failure',
      });
    }
    if (!isMutating) return;
    if (SECURITY_EVENT_PATHS.test(requestPath)) return;

    const durationMs = Date.now() - startAt;
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

  runWithRequestContext(
    { ipAddress: req.ip, userAgent: req.headers['user-agent'] },
    () => next(),
  );
};
