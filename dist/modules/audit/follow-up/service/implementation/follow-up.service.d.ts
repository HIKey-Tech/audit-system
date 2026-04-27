import { ActorContext } from '../../../domain/entity/audit.entity';
import { ManagementResponseRequestDto, VerifyRemediationRequestDto } from '../../dto/request/follow-up.request.dto';
import { FollowUpResponseDto } from '../../dto/response/follow-up.response.dto';
import { IFollowUpService } from '../interface/follow-up.service.interface';
export declare class FollowUpService implements IFollowUpService {
    createFollowUp(findingId: string): Promise<FollowUpResponseDto>;
    submitManagementResponse(findingId: string, dto: ManagementResponseRequestDto, actor: ActorContext): Promise<FollowUpResponseDto>;
    submitRemediationEvidence(findingId: string, evidenceId: string, actor: ActorContext): Promise<FollowUpResponseDto>;
    verifyRemediation(findingId: string, dto: VerifyRemediationRequestDto, actor: ActorContext): Promise<FollowUpResponseDto>;
    getFollowUp(findingId: string): Promise<FollowUpResponseDto>;
    listPendingFollowUps(engagementId: string): Promise<FollowUpResponseDto[]>;
    private _getFinding;
}
//# sourceMappingURL=follow-up.service.d.ts.map