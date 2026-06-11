import { MfaMethod } from '../../dto/request/auth.request.dto';
import { MfaSetupResponseDto } from '../../dto/response/user.response.dto';
export interface IMfaService {
    /**
     * Begin enrolment for a chosen method. For TOTP, returns the secret + QR
     * payload; for email, dispatches a one-time code. Does NOT enable 2FA yet.
     */
    setup(userId: string, email: string, method: MfaMethod): Promise<MfaSetupResponseDto>;
    /**
     * Verify the enrolment code, enable 2FA, and return freshly generated
     * single-use backup codes (shown to the user exactly once).
     */
    completeEnrollment(userId: string, method: MfaMethod, code: string): Promise<string[]>;
    /** Dispatch a login email OTP (used when the enrolled method is 'email'). */
    startEmailChallenge(userId: string, email: string): Promise<void>;
    /** Verify a login code (TOTP, email OTP, or a backup code). Throws on failure. */
    verifyChallenge(userId: string, code: string): Promise<void>;
    /** Regenerate backup codes for an authenticated user, invalidating the old set. */
    regenerateBackupCodes(userId: string): Promise<string[]>;
    /** Super-admin lockout escape hatch: disable a user's 2FA so they re-enrol. */
    adminReset(targetUserId: string, actorId: string): Promise<void>;
}
//# sourceMappingURL=mfa.service.interface.d.ts.map