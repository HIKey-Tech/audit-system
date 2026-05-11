import { JwtPayload } from '../../../shared/middleware/auth.middleware';
import { TokenPair } from '../domain/entity/token.entity';
export declare const generateAccessToken: (payload: {
    sub: string;
    email: string;
    displayName: string;
    roles: string[];
    permissions: string[];
    isSuperAdmin: boolean;
}) => string;
export declare const generateRefreshToken: () => {
    raw: string;
    hash: string;
    expiresAt: Date;
};
export declare const hashPassword: (password: string) => Promise<string>;
export declare const comparePassword: (password: string, hash: string) => Promise<boolean>;
export declare const hashToken: (token: string) => string;
export declare const buildTokenPair: (accessToken: string, refreshToken: string) => TokenPair;
export declare const verifyRefreshToken: (token: string) => JwtPayload;
//# sourceMappingURL=token.utility.d.ts.map