import { Prisma } from '@prisma/client';
import { PaginationMeta, PaginationQuery } from '../../../../../shared/types/api-response.type';
import { WorkflowActorContext } from '../../../domain/entity/workflow.entity';
import { WorkflowEntityType } from '../../../domain/enum/workflow.enum';
import { CreateApprovalRequestDto } from '../../dto/request/approval.request.dto';
import { ApprovalResponseDto, SignedApprovalDocumentDto } from '../../dto/response/approval.response.dto';
import { ResolvedApprovalChainDto } from '../../dto/response/approval-chain.response.dto';

/** Minimal actor shape needed to authorise an approval action by permission. */
export interface ApprovalActor {
  id: string;
  permissions: string[];
}

export interface IApprovalService {
  createApproval(
    dto: CreateApprovalRequestDto,
    submittedBy: WorkflowActorContext,
    tx?: Prisma.TransactionClient,
  ): Promise<ApprovalResponseDto>;
  queueApprovalRequiredNotification(approval: ApprovalResponseDto): void;
  approve(approvalId: string, actor: ApprovalActor, comment?: string): Promise<ApprovalResponseDto>;
  reject(approvalId: string, actor: ApprovalActor, reason: string): Promise<ApprovalResponseDto>;
  getApprovalById(approvalId: string, actor?: ApprovalActor): Promise<ApprovalResponseDto>;
  getApprovalByEntity(entityType: WorkflowEntityType, entityId: string, actor?: ApprovalActor): Promise<ApprovalResponseDto>;
  getPendingApprovalsForUser(
    actor: ApprovalActor,
    pagination: PaginationQuery,
  ): Promise<{ approvals: ApprovalResponseDto[]; meta: PaginationMeta }>;
  /** Approvals the user submitted or acted on that are no longer pending. */
  getApprovalHistoryForUser(
    actor: ApprovalActor,
    pagination: PaginationQuery,
  ): Promise<{ approvals: ApprovalResponseDto[]; meta: PaginationMeta }>;
  cancelApproval(approvalId: string, cancelledBy: WorkflowActorContext): Promise<ApprovalResponseDto>;
  listSignedDocuments(approvalId: string, actor?: ApprovalActor): Promise<SignedApprovalDocumentDto[]>;
  resolveChainForEntity(entityType: WorkflowEntityType, entityId: string, actor?: ApprovalActor): Promise<ResolvedApprovalChainDto>;
}
