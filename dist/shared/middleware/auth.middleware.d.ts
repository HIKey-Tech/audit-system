import { Request, Response, NextFunction } from 'express';
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
export declare const authenticate: (req: Request, _res: Response, next: NextFunction) => Promise<void>;
export declare const requirePermission: (...requiredPermissions: string[]) => (req: Request, _res: Response, next: NextFunction) => void;
export declare const requireRole: (...requiredRoles: string[]) => (req: Request, _res: Response, next: NextFunction) => void;
//# sourceMappingURL=auth.middleware.d.ts.map