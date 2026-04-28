import { Prisma } from '@prisma/client';
import { AuditApprovalEntityType, IApprovalStatusService } from '../interface/approval-status.service.interface';
export declare class ApprovalStatusService implements IApprovalStatusService {
    markApproved(tx: Prisma.TransactionClient, entityType: AuditApprovalEntityType, entityId: string, approverId: string, approvedAt: Date): Promise<void>;
    markRejected(tx: Prisma.TransactionClient, entityType: AuditApprovalEntityType, entityId: string, approverId: string, reason: string): Promise<void>;
}
export declare const approvalStatusService: ApprovalStatusService;
//# sourceMappingURL=approval-status.service.d.ts.map