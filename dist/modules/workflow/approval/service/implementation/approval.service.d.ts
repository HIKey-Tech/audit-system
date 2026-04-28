import { PaginationMeta, PaginationQuery } from '../../../../../shared/types/api-response.type';
import { IApprovalStatusService } from '../../../../audit/approval-status/service/interface/approval-status.service.interface';
import { WorkflowActorContext } from '../../../domain/entity/workflow.entity';
import { WorkflowEntityType } from '../../../domain/enum/workflow.enum';
import { CreateApprovalRequestDto } from '../../dto/request/approval.request.dto';
import { ApprovalResponseDto } from '../../dto/response/approval.response.dto';
import { IApprovalService } from '../interface/approval.service.interface';
export declare class ApprovalService implements IApprovalService {
    private readonly approvalStatusService;
    constructor(approvalStatusService?: IApprovalStatusService);
    createApproval(dto: CreateApprovalRequestDto, submittedBy: WorkflowActorContext): Promise<ApprovalResponseDto>;
    approve(approvalId: string, approverId: string, comment?: string): Promise<ApprovalResponseDto>;
    reject(approvalId: string, approverId: string, reason: string): Promise<ApprovalResponseDto>;
    getApprovalById(approvalId: string): Promise<ApprovalResponseDto>;
    getApprovalByEntity(entityType: WorkflowEntityType, entityId: string): Promise<ApprovalResponseDto>;
    getPendingApprovalsForUser(userId: string, pagination: PaginationQuery): Promise<{
        approvals: ApprovalResponseDto[];
        meta: PaginationMeta;
    }>;
    cancelApproval(approvalId: string, cancelledBy: WorkflowActorContext): Promise<ApprovalResponseDto>;
    private _resolveApproverChain;
    private _getFirstActiveUserByRole;
    private _getPendingApproval;
    private _getCurrentStepForApprover;
    private _notifyUser;
}
export declare const workflowApprovalService: ApprovalService;
//# sourceMappingURL=approval.service.d.ts.map