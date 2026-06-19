import { PaginationMeta } from '../../../../../shared/types/api-response.type';
import { ActorContext } from '../../../domain/entity/audit.entity';
import { EvidenceQueryDto, EvidenceRepositoryQueryDto, UploadEvidenceDto } from '../../dto/request/evidence.request.dto';
import { EvidenceResponseDto, RepositoryEvidenceResponseDto } from '../../dto/response/evidence.response.dto';
export interface IEvidenceService {
    uploadEvidence(engagementId: string, file: UploadEvidenceDto, actor: ActorContext): Promise<EvidenceResponseDto>;
    linkToWorkingPaper(evidenceId: string, workingPaperId: string, actor: ActorContext): Promise<EvidenceResponseDto>;
    linkToFinding(evidenceId: string, findingId: string, actor: ActorContext): Promise<EvidenceResponseDto>;
    disputeEvidence(evidenceId: string, reason: string, actor: ActorContext): Promise<EvidenceResponseDto>;
    listEvidence(engagementId: string, query: EvidenceQueryDto, actor: ActorContext): Promise<EvidenceResponseDto[]>;
    listRepository(query: EvidenceRepositoryQueryDto, actor: ActorContext): Promise<{
        evidence: RepositoryEvidenceResponseDto[];
        meta: PaginationMeta;
    }>;
    getRepositoryEvidence(evidenceId: string, actor: ActorContext): Promise<RepositoryEvidenceResponseDto>;
    getDownloadUrl(evidenceId: string, actor: ActorContext): Promise<string>;
}
//# sourceMappingURL=evidence.service.interface.d.ts.map