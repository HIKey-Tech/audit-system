export interface IPasswordResetService {
    /**
     * Initiate a password reset for an active local account. Throws when the
     * email is unknown, inactive, or SSO-only so the frontend can show a clear
     * recovery error.
     */
    requestReset(email: string, ipAddress?: string): Promise<void>;
    /**
     * Complete a password reset using the single-use token from the email.
     * Sets the new password and revokes all active refresh tokens.
     */
    resetPassword(token: string, newPassword: string, ipAddress?: string): Promise<void>;
}
//# sourceMappingURL=password-reset.service.interface.d.ts.map