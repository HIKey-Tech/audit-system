import { Prisma } from '@prisma/client';
import { PlanStatus, ReportStatus, WorkingPaperStatus } from '../../../domain/enum/audit.enum';
import {
  AuditApprovalEntityType,
  IApprovalStatusService,
} from '../interface/approval-status.service.interface';

export class ApprovalStatusService implements IApprovalStatusService {
  async markApproved(
    tx: Prisma.TransactionClient,
    entityType: AuditApprovalEntityType,
    entityId: string,
    approverId: string,
    approvedAt: Date,
  ): Promise<void> {
    if (entityType === 'audit_plan') {
      await tx.audit_Plan.update({
        where: { id: entityId },
        data: {
          status: PlanStatus.Approved,
          approved_by_id: approverId,
          approved_at: approvedAt,
          rejection_reason: null,
        },
      });
      return;
    }

    if (entityType === 'audit_working_paper') {
      await tx.audit_Working_Paper.update({
        where: { id: entityId },
        data: {
          status: WorkingPaperStatus.Approved,
          reviewed_by_id: approverId,
          rejection_reason: null,
        },
      });
      return;
    }

    await tx.audit_Report.update({
      where: { id: entityId },
      data: { status: ReportStatus.Approved },
    });
  }

  async markRejected(
    tx: Prisma.TransactionClient,
    entityType: AuditApprovalEntityType,
    entityId: string,
    approverId: string,
    reason: string,
  ): Promise<void> {
    if (entityType === 'audit_plan') {
      await tx.audit_Plan.update({
        where: { id: entityId },
        data: {
          status: PlanStatus.Rejected,
          approved_by_id: null,
          approved_at: null,
          rejection_reason: reason,
        },
      });
      return;
    }

    if (entityType === 'audit_working_paper') {
      await tx.audit_Working_Paper.update({
        where: { id: entityId },
        data: {
          status: WorkingPaperStatus.Rejected,
          reviewed_by_id: approverId,
          rejection_reason: reason,
        },
      });
      return;
    }

    await tx.audit_Report.update({
      where: { id: entityId },
      data: {
        status: ReportStatus.Rejected,
        rejection_reason: reason,
      },
    });
  }
}

export const approvalStatusService = new ApprovalStatusService();
