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
export declare const generateTemporaryPassword: (length?: number) => string;
export declare const hashPassword: (password: string) => Promise<string>;
export declare const comparePassword: (password: string, hash: string) => Promise<boolean>;
export declare const hashToken: (token: string) => string;
export declare const generatePasswordResetToken: () => {
    raw: string;
    hash: string;
    expiresAt: Date;
};
export declare const buildTokenPair: (accessToken: string, refreshToken: string) => TokenPair;
//# sourceMappingURL=token.utility.d.ts.map