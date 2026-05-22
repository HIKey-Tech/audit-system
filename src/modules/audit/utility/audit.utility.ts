import { Prisma } from '@prisma/client';
import { AppError } from '../../../shared/errors/app.error';
import {
  AuditType,
  ChecklistResult,
  EngagementStatus,
  FindingStatus,
  PlanStatus,
  ReportStatus,
  WorkingPaperStatus,
} from '../domain/enum/audit.enum';

export const AUDIT_ADMIN_ROLES: readonly string[] = ['super_admin', 'audit_admin', 'audit_manager', 'cae'];
export const AUDIT_REVIEW_ROLES: readonly string[] = ['super_admin', 'audit_admin', 'audit_manager', 'audit_lead'];
export const AUDIT_WORK_ROLES: readonly string[] = ['super_admin', 'audit_admin', 'audit_manager', 'audit_lead', 'auditor'];
export const AUDITEE_ROLE = 'auditee';

export const hasAuditeeRole = (roles: string[]): boolean =>
  roles.includes(AUDITEE_ROLE);

export const assertHasRole = (
  roles: string[],
  allowedRoles: readonly string[],
  message = 'Insufficient role for this audit action',
): void => {
  if (!roles.some((role) => allowedRoles.includes(role))) {
    throw AppError.forbidden(message);
  }
};

export const assertTransition = <TStatus extends string>(
  current: TStatus,
  next: TStatus,
  transitions: Partial<Record<TStatus, readonly TStatus[]>>,
  entityName: string,
): void => {
  if (!transitions[current]?.includes(next)) {
    throw AppError.badRequest(`Invalid ${entityName} status transition from '${current}' to '${next}'`);
  }
};

export const toIso = (value: Date | null): string | null =>
  value ? value.toISOString() : null;

export const decimalToNumber = (value: Prisma.Decimal | null): number | null =>
  value === null ? null : Number(value.toString());

export const parseJson = (value: string | null): unknown =>
  value ? JSON.parse(value) : null;

export const stringify = (value: unknown): string =>
  typeof value === 'string' ? value : JSON.stringify(value, null, 2);

export const buildReferenceNumber = (year: number, sequence: number): string =>
  `AUD-${year}-${String(sequence).padStart(3, '0')}`;

export const parseReferenceSequence = (referenceNumber: string, year: number): number => {
  const prefix = `AUD-${year}-`;
  if (!referenceNumber.startsWith(prefix)) return 0;
  const value = Number(referenceNumber.slice(prefix.length));
  return Number.isInteger(value) ? value : 0;
};

export const ENGAGEMENT_TRANSITIONS: Record<EngagementStatus, readonly EngagementStatus[]> = {
  [EngagementStatus.Planned]: [EngagementStatus.InProgress],
  [EngagementStatus.InProgress]: [EngagementStatus.UnderReview],
  [EngagementStatus.UnderReview]: [EngagementStatus.Reported],
  [EngagementStatus.Reported]: [EngagementStatus.Closed],
  [EngagementStatus.Closed]: [],
};

export const FINDING_TRANSITIONS: Record<FindingStatus, readonly FindingStatus[]> = {
  [FindingStatus.Open]: [FindingStatus.ManagementResponseReceived],
  [FindingStatus.ManagementResponseReceived]: [FindingStatus.InRemediation],
  [FindingStatus.InRemediation]: [FindingStatus.Verified],
  [FindingStatus.Verified]: [FindingStatus.Closed],
  [FindingStatus.Closed]: [],
};

export const PLAN_TRANSITIONS: Record<PlanStatus, readonly PlanStatus[]> = {
  [PlanStatus.Draft]: [PlanStatus.Submitted],
  [PlanStatus.Submitted]: [PlanStatus.Approved, PlanStatus.Rejected],
  [PlanStatus.Approved]: [],
  [PlanStatus.Rejected]: [],
};

export const WP_REVIEWABLE_STATUSES: readonly WorkingPaperStatus[] = [
  WorkingPaperStatus.Draft,
  WorkingPaperStatus.Rejected,
] as const;

export const REPORT_EDITABLE_STATUSES: readonly ReportStatus[] = [
  ReportStatus.Draft,
  ReportStatus.Rejected,
] as const;

export const CONTROL_SETS: Record<AuditType, Array<{
  controlReference: string;
  controlDescription: string;
  testProcedure: string;
}>> = {
  [AuditType.It]: [
    {
      controlReference: 'ISO27001-A.5.15',
      controlDescription: 'Access control rules are established and enforced for information assets.',
      testProcedure: 'Inspect access control policy, review user access listings, and sample approval evidence.',
    },
    {
      controlReference: 'ISO27001-A.8.16',
      controlDescription: 'Monitoring activities detect anomalous events in systems and networks.',
      testProcedure: 'Review monitoring coverage, alert handling records, and sample incident escalation evidence.',
    },
    {
      controlReference: 'ISO27001-A.8.13',
      controlDescription: 'Information and system backups are maintained and tested.',
      testProcedure: 'Inspect backup schedules, restoration test records, and exception handling logs.',
    },
  ],
  [AuditType.Financial]: [
    {
      controlReference: 'FIN-AP-001',
      controlDescription: 'Payment approvals are segregated from payment preparation.',
      testProcedure: 'Sample payment transactions and verify maker-checker evidence against approval limits.',
    },
    {
      controlReference: 'FIN-REC-001',
      controlDescription: 'Bank and ledger reconciliations are prepared and independently reviewed.',
      testProcedure: 'Inspect monthly reconciliations, reconciling items, and reviewer sign-off evidence.',
    },
    {
      controlReference: 'FIN-FA-001',
      controlDescription: 'Fixed assets are recorded, tagged, and periodically verified.',
      testProcedure: 'Trace sampled assets to the register and verify physical existence and ownership.',
    },
  ],
  [AuditType.Compliance]: [
    {
      controlReference: 'NDPR-PRIV-001',
      controlDescription: 'Personal data processing has a lawful basis and documented privacy notices.',
      testProcedure: 'Review processing register, privacy notices, and sampled consent or lawful-basis evidence.',
    },
    {
      controlReference: 'ISO9001-9.2',
      controlDescription: 'Internal audits are planned and conducted against quality management requirements.',
      testProcedure: 'Inspect audit schedules, audit records, nonconformities, and corrective action follow-up.',
    },
    {
      controlReference: 'ISO22301-8.4',
      controlDescription: 'Business continuity procedures are tested and maintained.',
      testProcedure: 'Review BCP test records, issues raised, and management sign-off.',
    },
  ],
  [AuditType.Systems]: [
    {
      controlReference: 'SYS-INF-001',
      controlDescription: 'Infrastructure configuration baselines are defined and monitored.',
      testProcedure: 'Compare sampled server or network configurations against approved baselines.',
    },
    {
      controlReference: 'SYS-CHG-001',
      controlDescription: 'Production changes are approved, tested, and traceable.',
      testProcedure: 'Sample production changes and verify approval, test evidence, and rollback plans.',
    },
    {
      controlReference: 'SYS-DR-001',
      controlDescription: 'Disaster recovery capability aligns with approved recovery objectives.',
      testProcedure: 'Inspect DR plans, RTO/RPO mapping, and recent DR test evidence.',
    },
  ],
};

export const emptyChecklistProgress = (): Record<ChecklistResult, number> => ({
  [ChecklistResult.Passed]: 0,
  [ChecklistResult.Failed]: 0,
  [ChecklistResult.NotApplicable]: 0,
  [ChecklistResult.NotTested]: 0,
});
