import { prisma } from '../../../../../shared/prisma/prisma.client';
import { logger } from '../../../../../shared/utils/logger.util';
import { auditLogService } from '../../../../logging/service/implementation/audit-log.service';
import { EngagementStatus } from '../../../domain/enum/audit.enum';
import { canClose, canEnterReported, canEnterUnderReview } from './engagement-gates';

type ApprovalEntityType = 'audit_working_paper' | 'audit_finding_closure';

/** Compute the immediate forward target if its gates are met, else null. Forward-only. */
const nextForwardStatus = async (
  status: EngagementStatus,
  engagementId: string,
): Promise<EngagementStatus | null> => {
  if (status === EngagementStatus.InProgress && (await canEnterUnderReview(engagementId))) {
    return EngagementStatus.UnderReview;
  }
  if (status === EngagementStatus.UnderReview && (await canEnterReported(engagementId))) {
    return EngagementStatus.Reported;
  }
  if (status === EngagementStatus.Reported && (await canClose(engagementId))) {
    return EngagementStatus.Closed;
  }
  return null;
};

/**
 * Advance an engagement as far forward as its gates allow. Idempotent and safe to
 * call repeatedly. Never crosses the manual planned -> in_progress transition.
 * Mirrors the side effects of EngagementService.updateStatus for the transitions
 * it performs (actual_end_date + universe.last_audited_at on close).
 */
export const reconcileEngagementStatus = async (engagementId: string, actorId: string): Promise<void> => {
  // Bounded loop: at most 3 forward hops (in_progress -> under_review -> reported -> closed).
  for (let hop = 0; hop < 3; hop += 1) {
    const engagement = await prisma.audit_Engagement.findFirst({
      where: { id: engagementId, deleted_at: null },
      select: { id: true, status: true, universe_id: true },
    });
    if (!engagement) return;

    const target = await nextForwardStatus(engagement.status as EngagementStatus, engagementId);
    if (!target) return;

    await prisma.$transaction(async (tx) => {
      await tx.audit_Engagement.update({
        where: { id: engagementId },
        data: {
          status: target,
          ...(target === EngagementStatus.Closed && { actual_end_date: new Date() }),
        },
      });
      if (target === EngagementStatus.Closed) {
        await tx.audit_Universe.update({
          where: { id: engagement.universe_id },
          data: { last_audited_at: new Date() },
        });
      }
    });

    logger.info('Audit engagement auto-advanced', { engagementId, from: engagement.status, to: target, actorId });
    auditLogService.logAsync({
      userId: actorId,
      action: 'audit.engagement.status.auto_advance',
      module: 'audit',
      entityType: 'audit_engagement',
      entityId: engagementId,
      newValues: { status: target, from: engagement.status },
    });
  }
};

/** Resolve the engagement behind a just-approved working paper / finding closure, then reconcile. */
export const reconcileEngagementForApprovalEntity = async (
  entityType: ApprovalEntityType,
  entityId: string,
  actorId: string,
): Promise<void> => {
  let engagementId: string | null = null;
  if (entityType === 'audit_working_paper') {
    const wp = await prisma.audit_Working_Paper.findUnique({ where: { id: entityId }, select: { engagement_id: true } });
    engagementId = wp?.engagement_id ?? null;
  } else {
    const finding = await prisma.audit_Finding.findUnique({ where: { id: entityId }, select: { engagement_id: true } });
    engagementId = finding?.engagement_id ?? null;
  }
  if (engagementId) await reconcileEngagementStatus(engagementId, actorId);
};
