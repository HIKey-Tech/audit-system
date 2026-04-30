import { Prisma } from '@prisma/client';
import { PaginationMeta, PaginationQuery } from '../../../../../shared/types/api-response.type';
import { WorkflowActorContext } from '../../../domain/entity/workflow.entity';
import { WorkflowEntityType } from '../../../domain/enum/workflow.enum';
import { CreateApprovalRequestDto } from '../../dto/request/approval.request.dto';
import { ApprovalResponseDto } from '../../dto/response/approval.response.dto';
export interface IApprovalService {
    createApproval(dto: CreateApprovalRequestDto, submittedBy: WorkflowActorContext, tx?: Prisma.TransactionClient): Promise<ApprovalResponseDto>;
    queueApprovalRequiredNotification(approval: ApprovalResponseDto): void;
    approve(approvalId: string, approverId: string, comment?: string): Promise<ApprovalResponseDto>;
    reject(approvalId: string, approverId: string, reason: string): Promise<ApprovalResponseDto>;
    getApprovalById(approvalId: string): Promise<ApprovalResponseDto>;
    getApprovalByEntity(entityType: WorkflowEntityType, entityId: string): Promise<ApprovalResponseDto>;
    getPendingApprovalsForUser(userId: string, pagination: PaginationQuery): Promise<{
        approvals: ApprovalResponseDto[];
        meta: PaginationMeta;
    }>;
    cancelApproval(approvalId: string, cancelledBy: WorkflowActorContext): Promise<ApprovalResponseDto>;
}
//# sourceMappingURL=approval.service.interface.d.ts.map