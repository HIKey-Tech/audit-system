// src/shared/middleware/auth.middleware.ts
import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config/app.config';
import { AppError } from '../errors/app.error';

export interface AuthenticatedUser {
  id: string;
  email: string;
  displayName: string;
  roles: string[];
  permissions: string[];
  isSuperAdmin: boolean;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
    }
  }
}

export interface JwtPayload {
  sub: string;
  email: string;
  displayName: string;
  roles: string[];
  permissions: string[];
  isSuperAdmin: boolean;
  iat: number;
  exp: number;
}

export const authenticate = async (
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader?.startsWith('Bearer ')) {
      throw AppError.unauthorized('Missing or invalid authorization header');
    }

    const token = authHeader.slice(7);

    let payload: JwtPayload;
    try {
      payload = jwt.verify(token, config.jwt.secret) as JwtPayload;
    } catch (err) {
      if (err instanceof jwt.TokenExpiredError) {
        throw new AppError('Token expired', 401, 'TOKEN_EXPIRED' as never);
      }
      throw AppError.unauthorized('Invalid token');
    }

    req.user = {
      id: payload.sub,
      email: payload.email,
      displayName: payload.displayName,
      roles: payload.roles ?? [],
      permissions: payload.permissions ?? [],
      isSuperAdmin: payload.isSuperAdmin ?? false,
    };

    next();
  } catch (err) {
    next(err);
  }
};

export const requirePermission = (...requiredPermissions: string[]) =>
  (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      return next(AppError.unauthorized());
    }

    if (req.user.isSuperAdmin) {
      return next();
    }

    const hasAll = requiredPermissions.every((perm) =>
      req.user!.permissions.includes(perm),
    );

    if (!hasAll) {
      return next(AppError.forbidden('Insufficient permissions'));
    }

    next();
  };

export const requireRole = (...requiredRoles: string[]) =>
  (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      return next(AppError.unauthorized());
    }

    const hasRole = requiredRoles.some((role) =>
      req.user!.roles.includes(role),
    );

    if (!hasRole) {
      return next(AppError.forbidden('Insufficient role'));
    }

    next();
  };
