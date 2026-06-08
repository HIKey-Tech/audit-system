import { PaginationMeta } from '../../../../../shared/types/api-response.type';
import { IDocumentService } from '../../../../document/service/interface/document.service.interface';
import { WorkflowActorContext } from '../../../domain/entity/workflow.entity';
import { ApproveRequestDto, CommentRequestDto, CreateRequestDto, RejectRequestDto, RequestInboxQueryDto, RequestListQueryDto, SignRequestDto } from '../../dto/request/request.request.dto';
import { RequestAttachmentDto, RequestResponseDto, SignatureVerificationDto } from '../../dto/response/request.response.dto';
import { IRequestService, RequestAttachmentCandidate, UploadRequestAttachmentInput } from '../interface/request.service.interface';
export declare class RequestService implements IRequestService {
    private readonly documentService;
    constructor(documentService?: IDocumentService);
    createRequest(dto: CreateRequestDto, actor: WorkflowActorContext): Promise<RequestResponseDto>;
    addAttachment(requestId: string, file: UploadRequestAttachmentInput, actor: WorkflowActorContext): Promise<RequestAttachmentDto>;
    approve(requestId: string, actor: WorkflowActorContext, dto: ApproveRequestDto): Promise<RequestResponseDto>;
    sign(requestId: string, actor: WorkflowActorContext, dto: SignRequestDto): Promise<RequestResponseDto>;
    reject(requestId: string, actor: WorkflowActorContext, dto: RejectRequestDto): Promise<RequestResponseDto>;
    comment(requestId: string, actor: WorkflowActorContext, dto: CommentRequestDto): Promise<RequestResponseDto>;
    cancel(requestId: string, actor: WorkflowActorContext): Promise<RequestResponseDto>;
    getById(requestId: string, actor: WorkflowActorContext): Promise<RequestResponseDto>;
    list(query: RequestListQueryDto, actor: WorkflowActorContext): Promise<{
        requests: RequestResponseDto[];
        meta: PaginationMeta;
    }>;
    inbox(query: RequestInboxQueryDto, actor: WorkflowActorContext): Promise<{
        requests: RequestResponseDto[];
        meta: PaginationMeta;
    }>;
    getCandidates(actor: WorkflowActorContext): Promise<RequestAttachmentCandidate[]>;
    verifySignatures(requestId: string, actor: WorkflowActorContext): Promise<SignatureVerificationDto[]>;
    private _advance;
    private _buildSignature;
    private _buildAttachmentManifest;
    private _toDetail;
    private _loadRequest;
    private _loadActionableRequest;
    private _assertCurrentRecipient;
    private _assertCanView;
    private _assertAffirmation;
    private _eligibleRecipientWhere;
    private _assertRecipientsEligible;
    private _nextReferenceNumber;
    private _actorName;
    private _notifyRequestEvent;
    private _queueNotification;
    private _notifyUser;
}
export declare const workflowRequestService: RequestService;
//# sourceMappingURL=request.service.d.ts.map