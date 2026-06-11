import { Request, Response, NextFunction } from 'express';
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
export declare const authenticate: (req: Request, _res: Response, next: NextFunction) => Promise<void>;
/**
 * Guards the intermediate MFA endpoints. Accepts only a short-lived token
 * carrying the matching `scope` claim (issued during the login flow), and
 * attaches the subject to `req.mfaToken`.
 */
export declare const requireMfaToken: (scope: "mfa_enroll" | "mfa_challenge") => (req: Request, _res: Response, next: NextFunction) => void;
/**
 * Enrolment context: accepts EITHER a short-lived `mfa_enroll` token (forced
 * enrolment during login) OR a normal access token (a logged-in user choosing
 * to set up 2FA voluntarily during the grace period). Attaches `req.mfaToken`.
 */
export declare const requireEnrollmentContext: (req: Request, _res: Response, next: NextFunction) => void;
export declare const requirePermission: (...requiredPermissions: string[]) => (req: Request, _res: Response, next: NextFunction) => void;
export declare const requireRole: (...requiredRoles: string[]) => (req: Request, _res: Response, next: NextFunction) => void;
//# sourceMappingURL=auth.middleware.d.ts.map