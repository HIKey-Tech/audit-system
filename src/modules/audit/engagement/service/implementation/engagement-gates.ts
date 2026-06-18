import { prisma } from '../../../../../shared/prisma/prisma.client';
import { FindingStatus } from '../../../domain/enum/audit.enum';
import { getAuditLifecycleRules } from '../../../utility/audit-config.utility';

/** True when an in_progress engagement satisfies every gate to enter under_review. */
export const canEnterUnderReview = async (engagementId: string): Promise<boolean> => {
  const rules = await getAuditLifecycleRules();

  if (rules.requireAllChecklistsTestedBeforeUnderReview) {
    const [total, notTested] = await prisma.$transaction([
      prisma.audit_Checklist.count({ where: { engagement_id: engagementId } }),
      prisma.audit_Checklist.count({ where: { engagement_id: engagementId, result: 'not_tested' } }),
    ]);
    if (total === 0 || notTested > 0) return false;
  }

  if (rules.requireApprovedWorkingPaperBeforeUnderReview) {
    const [totalPapers, unapproved] = await prisma.$transaction([
      prisma.audit_Working_Paper.count({ where: { engagement_id: engagementId, deleted_at: null } }),
      prisma.audit_Working_Paper.count({ where: { engagement_id: engagementId, deleted_at: null, status: { not: 'approved' } } }),
    ]);
    if (totalPapers === 0 || unapproved > 0) return false;
  }

  return true;
};

/** True when an under_review engagement has an issued report (the deliberate human act). */
export const canEnterReported = async (engagementId: string): Promise<boolean> => {
  const rules = await getAuditLifecycleRules();
  if (!rules.requireReportIssuedBeforeReported) return true;
  const issued = await prisma.audit_Report.count({
    where: { engagement_id: engagementId, deleted_at: null, status: 'issued' },
  });
  return issued > 0;
};

/** True when a reported engagement has no findings left open/awaiting closure. */
export const canClose = async (engagementId: string): Promise<boolean> => {
  const rules = await getAuditLifecycleRules();
  if (!rules.requireClosedFindingsBeforeClose) return true;
  const open = await prisma.audit_Finding.count({
    where: { engagement_id: engagementId, deleted_at: null, status: { not: FindingStatus.Closed } },
  });
  return open === 0;
};
