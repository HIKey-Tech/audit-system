import { ActorContext } from '../../../domain/entity/audit.entity';
import { EvidenceQueryDto, UploadEvidenceDto } from '../../dto/request/evidence.request.dto';
import { EvidenceResponseDto } from '../../dto/response/evidence.response.dto';
export interface IEvidenceService {
    uploadEvidence(engagementId: string, file: UploadEvidenceDto, actor: ActorContext): Promise<EvidenceResponseDto>;
    linkToWorkingPaper(evidenceId: string, workingPaperId: string, actor: ActorContext): Promise<EvidenceResponseDto>;
    linkToFinding(evidenceId: string, findingId: string, actor: ActorContext): Promise<EvidenceResponseDto>;
    disputeEvidence(evidenceId: string, reason: string, actor: ActorContext): Promise<EvidenceResponseDto>;
    listEvidence(engagementId: string, query: EvidenceQueryDto): Promise<EvidenceResponseDto[]>;
}
//# sourceMappingURL=evidence.service.interface.d.ts.map