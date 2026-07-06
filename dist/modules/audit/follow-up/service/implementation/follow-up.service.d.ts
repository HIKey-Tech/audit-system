import { IDocumentService } from '../../../../document/service/interface/document.service.interface';
import { ActorContext } from '../../../domain/entity/audit.entity';
import { ManagementResponseRequestDto, VerifyRemediationRequestDto } from '../../dto/request/follow-up.request.dto';
import { FollowUpResponseDto } from '../../dto/response/follow-up.response.dto';
import { IFollowUpService } from '../interface/follow-up.service.interface';
export declare class FollowUpService implements IFollowUpService {
    private readonly documentService?;
    constructor(documentService?: IDocumentService | undefined);
    createFollowUp(findingId: string): Promise<FollowUpResponseDto>;
    submitManagementResponse(findingId: string, dto: ManagementResponseRequestDto, actor: ActorContext): Promise<FollowUpResponseDto>;
    submitRemediationEvidence(findingId: string, evidenceId: string, actor: ActorContext): Promise<FollowUpResponseDto>;
    uploadRemediationEvidence(findingId: string, file: {
        originalName: string;
        mimeType: string;
        fileSize: number;
        buffer: Buffer;
    }, actor: ActorContext): Promise<FollowUpResponseDto>;
    verifyRemediation(findingId: string, dto: VerifyRemediationRequestDto, actor: ActorContext): Promise<FollowUpResponseDto>;
    /** Notify the owners of risks related to a just-verified finding that a reassessment may be due. */
    private _suggestRiskReassessment;
    getFollowUp(findingId: string, actor: ActorContext): Promise<FollowUpResponseDto>;
    listPendingFollowUps(engagementId: string, actor: ActorContext): Promise<FollowUpResponseDto[]>;
    private _getFinding;
    /** A finding may be acted on by its primary auditee or any co-responder. */
    private _assertResponder;
    /** Primary auditee plus co-responders, de-duplicated by user id. */
    private _responders;
    /**
     * Notify the engagement's lead auditor that an auditee has acted on a finding
     * (management response / remediation evidence). Post-commit and best-effort —
     * never throws into the caller.
     */
    private _notifyLeadAuditor;
}
//# sourceMappingURL=follow-up.service.d.ts.map