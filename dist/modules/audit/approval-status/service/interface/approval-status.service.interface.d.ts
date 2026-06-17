import { Prisma } from '@prisma/client';
export type AuditApprovalEntityType = 'audit_plan' | 'audit_working_paper' | 'audit_report' | 'audit_finding_closure';
export interface IApprovalStatusService {
    markApproved(tx: Prisma.TransactionClient, entityType: AuditApprovalEntityType, entityId: string, approverId: string, approvedAt: Date): Promise<void>;
    markRejected(tx: Prisma.TransactionClient, entityType: AuditApprovalEntityType, entityId: string, approverId: string, reason: string): Promise<void>;
}
//# sourceMappingURL=approval-status.service.interface.d.ts.map