import { IDocumentService } from '../../../../document/service/interface/document.service.interface';
import { ActorContext } from '../../../domain/entity/audit.entity';
import { CreateEvidenceRequestDto } from '../../dto/request/evidence-request.request.dto';
import { EvidenceRequestResponseDto } from '../../dto/response/evidence-request.response.dto';
import { IEvidenceRequestService, RespondFileDto } from '../interface/evidence-request.service.interface';
export declare class EvidenceRequestService implements IEvidenceRequestService {
    private readonly documentService;
    constructor(documentService: IDocumentService);
    createRequest(engagementId: string, dto: CreateEvidenceRequestDto, actor: ActorContext): Promise<EvidenceRequestResponseDto>;
    listForEngagement(engagementId: string, actor: ActorContext): Promise<EvidenceRequestResponseDto[]>;
    listMine(actor: ActorContext): Promise<EvidenceRequestResponseDto[]>;
    respond(requestId: string, file: RespondFileDto, actor: ActorContext): Promise<EvidenceRequestResponseDto>;
    accept(requestId: string, actor: ActorContext): Promise<EvidenceRequestResponseDto>;
    returnRequest(requestId: string, reason: string, actor: ActorContext): Promise<EvidenceRequestResponseDto>;
    cancelRequest(requestId: string, actor: ActorContext): Promise<void>;
    private _getRequest;
    private _getOpenEngagement;
    /** in-app + email; queue-backed so a notification hiccup never fails the request. */
    private _notify;
}
//# sourceMappingURL=evidence-request.service.d.ts.map