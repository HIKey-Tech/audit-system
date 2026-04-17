// src/shared/middleware/auth.middleware.ts
import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config/app.config';
import { AppError } from '../errors/app.error';
import { prisma } from '../prisma/prisma.client';
import { userWithRolesInclude, UserWithRoles } from '../prisma/prisma.types';

export interface AuthenticatedUser {
  id: string;
  email: string;
  displayName: string;
  roles: string[];
  permissions: string[];
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

    const user = await prisma.user.findUnique({
      where: { id: payload.sub, is_active: true, deleted_at: null },
      include: userWithRolesInclude,
    }) as UserWithRoles | null;

    if (!user) {
      throw AppError.unauthorized('User not found or inactive');
    }

    const roles = user.user_roles.map((ur) => ur.role.name);

    const permissions: string[] = [
      ...new Set(
        user.user_roles.flatMap((ur) =>
          ur.role.role_permissions.map((rp) => rp.permission.name),
        ),
      ),
    ];

    req.user = {
      id: user.id,
      email: user.email,
      displayName: user.display_name ?? `${user.first_name} ${user.last_name}`,
      roles,
      permissions,
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