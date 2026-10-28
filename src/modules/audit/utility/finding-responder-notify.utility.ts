import { prisma } from '../../../shared/prisma/prisma.client';
import { logger } from '../../../shared/utils/logger.util';
import { notificationQueueService } from '../../messaging/service/implementation/notification-queue.service';

export type FindingNotifyStage = 'draft' | 'issued';

/**
 * Tell every responder (primary auditee + co-responders) about the findings assigned to them on
 * an engagement, one notification per person.
 *
 * - `draft`: fieldwork is complete (Quality Assurance). Findings are visible and the management
 *   response is requested *before* the report is issued, so it can go into the report.
 * - `issued`: the report has been issued.
 *
 * Best-effort: never throws into the caller.
 */
export const notifyFindingResponders = async (
  engagementId: string,
  engagementReference: string,
  stage: FindingNotifyStage,
): Promise<void> => {
  try {
    const userSelect = { id: true, email: true };
    const findings = await prisma.audit_Finding.findMany({
      where: { engagement_id: engagementId, deleted_at: null },
      select: {
        id: true,
        title: true,
        due_date: true,
        auditee: { select: userSelect },
        responders: { select: { user: { select: userSelect } } },
      },
    });

    const byUser = new Map<string, { email: string; findings: Array<{ id: string; title: string; dueDate: string }> }>();
    for (const finding of findings) {
      const users = [finding.auditee, ...finding.responders.map((r) => r.user)];
      for (const user of users) {
        const entry = byUser.get(user.id) ?? { email: user.email, findings: [] };
        if (!entry.findings.some((f) => f.id === finding.id)) {
          entry.findings.push({ id: finding.id, title: finding.title, dueDate: finding.due_date.toISOString().slice(0, 10) });
        }
        byUser.set(user.id, entry);
      }
    }

    const title = stage === 'draft' ? 'Findings awaiting your response' : 'Audit findings assigned';
    const subject = stage === 'draft'
      ? `Findings awaiting your response: ${engagementReference}`
      : `Audit findings assigned: ${engagementReference}`;

    for (const [userId, entry] of byUser) {
      const single = entry.findings.length === 1 ? entry.findings[0] : null;
      const action = stage === 'draft'
        ? 'Please submit your management response before the audit report is issued.'
        : 'Please review them and submit your management responses.';
      const body = single
        ? `Finding "${single.title}" (${engagementReference}) has been assigned to you. Due ${single.dueDate}. ${stage === 'draft' ? action : ''}`.trim()
        : `${entry.findings.length} findings from audit ${engagementReference} have been assigned to you. ${action}`;

      await notificationQueueService.enqueueSafe('in_app', {
        userId,
        title,
        body,
        type: 'warning',
        referenceType: single ? 'audit_finding' : 'audit_engagement',
        referenceId: single ? single.id : engagementId,
      });
      if (entry.email) {
        await notificationQueueService.enqueueSafe('email', { to: entry.email, subject, text: body });
      }
    }
  } catch (err) {
    logger.warn('Finding responder notification failed', { engagementId, stage, err });
  }
};
