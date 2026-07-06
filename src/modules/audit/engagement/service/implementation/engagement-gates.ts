import { prisma } from '../../../../../shared/prisma/prisma.client';
import { EngagementStatus, FindingStatus } from '../../../domain/enum/audit.enum';
import { getAuditLifecycleRules } from '../../../utility/audit-config.utility';

/** Result of a gate check: whether it passed, and — when it didn't — why, in
 * plain language the frontend can show next to the status badge. */
export interface GateResult {
  met: boolean;
  unmet: string[];
}

/** True when an in_progress engagement satisfies every gate to enter under_review. */
export const canEnterUnderReview = async (engagementId: string): Promise<GateResult> => {
  const rules = await getAuditLifecycleRules();
  const unmet: string[] = [];

  if (rules.requireAllChecklistsTestedBeforeUnderReview) {
    const [total, notTested] = await prisma.$transaction([
      prisma.audit_Checklist.count({ where: { engagement_id: engagementId } }),
      prisma.audit_Checklist.count({ where: { engagement_id: engagementId, result: 'not_tested' } }),
    ]);
    if (total === 0) {
      unmet.push('No checklist items have been created yet');
    } else if (notTested > 0) {
      unmet.push(`${notTested} of ${total} checklist item${total === 1 ? '' : 's'} not yet tested`);
    }
  }

  if (rules.requireApprovedWorkingPaperBeforeUnderReview) {
    const [totalPapers, unapproved] = await prisma.$transaction([
      prisma.audit_Working_Paper.count({ where: { engagement_id: engagementId, deleted_at: null } }),
      prisma.audit_Working_Paper.count({ where: { engagement_id: engagementId, deleted_at: null, status: { not: 'approved' } } }),
    ]);
    if (totalPapers === 0) {
      unmet.push('No working papers have been created yet');
    } else if (unapproved > 0) {
      unmet.push(`${unapproved} of ${totalPapers} working paper${totalPapers === 1 ? '' : 's'} not yet approved`);
    }
  }

  return { met: unmet.length === 0, unmet };
};

/** True when an under_review engagement has an issued report (the deliberate human act). */
export const canEnterReported = async (engagementId: string): Promise<GateResult> => {
  const rules = await getAuditLifecycleRules();
  if (!rules.requireReportIssuedBeforeReported) return { met: true, unmet: [] };
  const issued = await prisma.audit_Report.count({
    where: { engagement_id: engagementId, deleted_at: null, status: 'issued' },
  });
  if (issued > 0) return { met: true, unmet: [] };
  return { met: false, unmet: ['Report has not been issued yet'] };
};

/** True when a reported engagement has no findings left open/awaiting closure. */
export const canClose = async (engagementId: string): Promise<GateResult> => {
  const rules = await getAuditLifecycleRules();
  if (!rules.requireClosedFindingsBeforeClose) return { met: true, unmet: [] };
  const open = await prisma.audit_Finding.count({
    where: { engagement_id: engagementId, deleted_at: null, status: { not: FindingStatus.Closed } },
  });
  if (open === 0) return { met: true, unmet: [] };
  return { met: false, unmet: [`${open} finding${open === 1 ? '' : 's'} not yet closed`] };
};

/** Resolve which gate applies to the engagement's current status and return its
 * result, for surfacing "why hasn't this advanced" in the UI. Returns null for
 * statuses with no forward gate (planned, closed). */
export const getEngagementGateStatus = async (
  engagementId: string,
  status: string,
): Promise<GateResult | null> => {
  if (status === EngagementStatus.InProgress) return canEnterUnderReview(engagementId);
  if (status === EngagementStatus.UnderReview) return canEnterReported(engagementId);
  if (status === EngagementStatus.Reported) return canClose(engagementId);
  return null;
};
