export type MfaScope = 'mfa_enroll' | 'mfa_challenge';
export interface ScopedTokenPayload {
    sub: string;
    email: string;
    scope: MfaScope;
}
export declare const generateScopedToken: (sub: string, email: string, scope: MfaScope, expiresIn: string) => string;
export declare const verifyScopedToken: (token: string, expectedScope: MfaScope) => {
    sub: string;
    email: string;
};
export declare const generateTotpSecret: () => string;
export declare const buildTotpUri: (email: string, secret: string) => string;
export declare const verifyTotp: (token: string, secret: string) => boolean;
export declare const encryptSecret: (plain: string) => string;
export declare const decryptSecret: (encoded: string) => string;
export declare const generateEmailOtp: () => string;
/** Produce N human-friendly single-use codes, e.g. "a1b2c-3d4e5". */
export declare const generateBackupCodes: (count: number) => string[];
/** Normalise for comparison: strip separators, lowercase. */
export declare const normaliseBackupCode: (code: string) => string;
//# sourceMappingURL=mfa.utility.d.ts.map