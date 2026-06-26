/**
 * Invalidate every access token issued to this user up to now. The user's
 * refresh token(s) must be handled separately (revoke for a hard logout, or keep
 * for a silent permission refresh — the next refresh mints a token that passes).
 */
export declare const revokeUserSessions: (userId: string) => Promise<void>;
/** Update the cached liveness snapshot (e.g. on activate/deactivate). */
export declare const setUserActiveSnapshot: (userId: string, isActive: boolean) => Promise<void>;
/**
 * Reject the request if the user has been deactivated/deleted or the token was
 * issued before a revocation watermark. Throws `AppError.unauthorized` on
 * failure; returns normally otherwise.
 */
export declare const assertSessionValid: (userId: string, tokenIatSeconds: number | undefined) => Promise<void>;
//# sourceMappingURL=session-guard.d.ts.map