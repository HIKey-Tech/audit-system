import { Prisma } from '@prisma/client';
import { PaginationMeta, PaginationQuery } from '../../../../../shared/types/api-response.type';
import { IApprovalStatusService } from '../../../../audit/approval-status/service/interface/approval-status.service.interface';
import { WorkflowActorContext } from '../../../domain/entity/workflow.entity';
import { WorkflowEntityType } from '../../../domain/enum/workflow.enum';
import { CreateApprovalRequestDto } from '../../dto/request/approval.request.dto';
import { ApprovalResponseDto, SignedApprovalDocumentDto } from '../../dto/response/approval.response.dto';
import { ResolvedApprovalChainDto } from '../../dto/response/approval-chain.response.dto';
import { ApprovalActor, IApprovalService } from '../interface/approval.service.interface';
export declare class ApprovalService implements IApprovalService {
    private readonly approvalStatusService;
    constructor(approvalStatusService?: IApprovalStatusService);
    createApproval(dto: CreateApprovalRequestDto, submittedBy: WorkflowActorContext, tx?: Prisma.TransactionClient): Promise<ApprovalResponseDto>;
    queueApprovalRequiredNotification(approval: ApprovalResponseDto): void;
    private _queueApprovalCreatedAsync;
    private _queueApprovalApprovedAsync;
    private _queueApprovalRejectedAsync;
    approve(approvalId: string, actor: ApprovalActor, comment?: string): Promise<ApprovalResponseDto>;
    reject(approvalId: string, actor: ApprovalActor, reason: string): Promise<ApprovalResponseDto>;
    getApprovalById(approvalId: string, actor?: ApprovalActor): Promise<ApprovalResponseDto>;
    getApprovalByEntity(entityType: WorkflowEntityType, entityId: string, actor?: ApprovalActor): Promise<ApprovalResponseDto>;
    getPendingApprovalsForUser(actor: ApprovalActor, pagination: PaginationQuery): Promise<{
        approvals: ApprovalResponseDto[];
        meta: PaginationMeta;
    }>;
    getApprovalHistoryForUser(actor: ApprovalActor, pagination: PaginationQuery): Promise<{
        approvals: ApprovalResponseDto[];
        meta: PaginationMeta;
    }>;
    listSignedDocuments(approvalId: string, actor?: ApprovalActor): Promise<SignedApprovalDocumentDto[]>;
    cancelApproval(approvalId: string, cancelledBy: WorkflowActorContext): Promise<ApprovalResponseDto>;
    resolveChainForEntity(entityType: WorkflowEntityType, entityId: string, actor: ApprovalActor): Promise<ResolvedApprovalChainDto>;
    private _resolveApproverChain;
    private _chainForEntity;
    private _resolveEngagementManager;
    private _hasActiveUserWithPermission;
    /** All active users who currently hold a permission — the pool that can act on a pool level. */
    private _stepRecipientIds;
    private _activeHolderWhere;
    /** All active users who currently hold a permission, resolved to display-ready briefs. */
    private _activeHoldersBrief;
    private _getPendingApproval;
    private _getActionableStep;
    private _assertCanViewApproval;
    private _assertCanViewApprovalEntity;
    private _notifyUser;
    private _queueNotification;
    private _resolveEntityReference;
    private _resolveActorName;
}
export declare const workflowApprovalService: ApprovalService;
//# sourceMappingURL=approval.service.d.ts.map