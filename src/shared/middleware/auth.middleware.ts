// src/shared/middleware/auth.middleware.ts
import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config/app.config';
import { AppError } from '../errors/app.error';
import { assertSessionValid } from '../security/session-guard';

export interface AuthenticatedUser {
  id: string;
  email: string;
  displayName: string;
  roles: string[];
  permissions: string[];
  isSuperAdmin: boolean;
}

export interface MfaTokenSubject {
  id: string;
  email: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
      mfaToken?: MfaTokenSubject;
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

    let payload: JwtPayload & { scope?: string };
    try {
      payload = jwt.verify(token, config.jwt.secret, {
        algorithms: ['HS256'],
      }) as JwtPayload & { scope?: string };
    } catch (err) {
      if (err instanceof jwt.TokenExpiredError) {
        throw new AppError('Token expired', 401, 'TOKEN_EXPIRED' as never);
      }
      throw AppError.unauthorized('Invalid token');
    }

    // Scoped tokens (mfa_enroll / mfa_challenge) are not full access tokens.
    if (payload.scope) {
      throw AppError.unauthorized('Invalid token');
    }

    // Enforce server-side revocation: a deactivated/deleted user, or a token
    // issued before a logout-all / password change / role change, is rejected
    // even though the JWT itself is still cryptographically valid.
    await assertSessionValid(payload.sub, payload.iat);

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

/**
 * Guards the intermediate MFA endpoints. Accepts only a short-lived token
 * carrying the matching `scope` claim (issued during the login flow), and
 * attaches the subject to `req.mfaToken`.
 */
export const requireMfaToken = (scope: 'mfa_enroll' | 'mfa_challenge') =>
  (req: Request, _res: Response, next: NextFunction): void => {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader?.startsWith('Bearer ')) {
        throw AppError.unauthorized('Missing or invalid authorization header');
      }
      const token = authHeader.slice(7);

      let payload: { sub: string; email: string; scope?: string };
      try {
        payload = jwt.verify(token, config.jwt.secret, {
          algorithms: ['HS256'],
        }) as {
          sub: string;
          email: string;
          scope?: string;
        };
      } catch (err) {
        if (err instanceof jwt.TokenExpiredError) {
          throw new AppError('Token expired', 401, 'TOKEN_EXPIRED' as never);
        }
        throw AppError.unauthorized('Invalid token');
      }

      if (payload.scope !== scope) {
        throw AppError.unauthorized('Invalid token');
      }

      req.mfaToken = { id: payload.sub, email: payload.email };
      next();
    } catch (err) {
      next(err);
    }
  };

/**
 * Enrolment context: accepts EITHER a short-lived `mfa_enroll` token (forced
 * enrolment during login) OR a normal access token (a logged-in user choosing
 * to set up 2FA voluntarily during the grace period). Attaches `req.mfaToken`.
 */
export const requireEnrollmentContext = (
  req: Request,
  _res: Response,
  next: NextFunction,
): void => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      throw AppError.unauthorized('Missing or invalid authorization header');
    }
    const token = authHeader.slice(7);

    let payload: { sub: string; email: string; scope?: string };
    try {
      payload = jwt.verify(token, config.jwt.secret, {
        algorithms: ['HS256'],
      }) as {
        sub: string;
        email: string;
        scope?: string;
      };
    } catch (err) {
      if (err instanceof jwt.TokenExpiredError) {
        throw new AppError('Token expired', 401, 'TOKEN_EXPIRED' as never);
      }
      throw AppError.unauthorized('Invalid token');
    }

    // Allow only an access token (no scope) or the enrolment-scoped token.
    if (payload.scope && payload.scope !== 'mfa_enroll') {
      throw AppError.unauthorized('Invalid token');
    }

    req.mfaToken = { id: payload.sub, email: payload.email };
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

