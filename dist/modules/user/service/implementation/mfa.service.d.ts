import { INotificationQueueService } from '../../../messaging/service/interface/notification-queue.service.interface';
import { IMfaService } from '../interface/mfa.service.interface';
import { MfaMethod } from '../../dto/request/auth.request.dto';
import { MfaSetupResponseDto } from '../../dto/response/user.response.dto';
export declare class MfaService implements IMfaService {
    private readonly notificationQueue;
    constructor(notificationQueue: INotificationQueueService);
    setup(userId: string, email: string, method: MfaMethod): Promise<MfaSetupResponseDto>;
    completeEnrollment(userId: string, method: MfaMethod, code: string): Promise<string[]>;
    startEmailChallenge(userId: string, email: string): Promise<void>;
    verifyChallenge(userId: string, code: string): Promise<void>;
    regenerateBackupCodes(userId: string): Promise<string[]>;
    adminReset(targetUserId: string, actorId: string): Promise<void>;
    private _replaceBackupCodes;
    private _tryConsumeBackupCode;
    private _issueEmailOtp;
    /** Strict consume (enrolment): throws with a clear message on failure. */
    private _consumeEmailOtp;
    private _tryConsumeEmailOtp;
    private _emailOtpTtlMs;
}
//# sourceMappingURL=mfa.service.d.ts.map