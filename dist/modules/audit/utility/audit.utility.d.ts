import { Prisma } from '@prisma/client';
import { AuditType, ChecklistResult, EngagementStatus, FindingStatus, PlanStatus, ReportStatus, WorkingPaperStatus } from '../domain/enum/audit.enum';
export declare const assertHasPermission: (permissions: string[], required: string, message?: string) => void;
/**
 * How a viewer is scoped when reading findings. Mirrors the dashboard's
 * isRestrictedAuditee/isRestrictedAuditor semantics so finding visibility and
 * dashboard metrics agree.
 *
 * - oversight (`finding:read_all`)         → every finding
 * - auditee (this helper)                  → only findings assigned to them
 * - field auditor (neither of the above)   → engagements they lead / are assigned to
 *
 * An auditee is identified by `followup:respond` (auditee-exclusive) OR a lack
 * of engagement visibility — NOT by the absence of `engagement:read` alone,
 * because the seeded `auditee` role does hold `engagement:read`.
 */
export declare const isFindingOversight: (permissions: string[]) => boolean;
export declare const isFindingAuditee: (permissions: string[]) => boolean;
export declare const assertTransition: <TStatus extends string>(current: TStatus, next: TStatus, transitions: Partial<Record<TStatus, readonly TStatus[]>>, entityName: string) => void;
export declare const toIso: (value: Date | null) => string | null;
export declare const decimalToNumber: (value: Prisma.Decimal | null) => number | null;
export declare const parseJson: (value: string | null) => unknown;
export declare const stringify: (value: unknown) => string;
export declare const buildReferenceNumber: (year: number, sequence: number) => string;
export declare const parseReferenceSequence: (referenceNumber: string, year: number) => number;
export declare const ENGAGEMENT_TRANSITIONS: Record<EngagementStatus, readonly EngagementStatus[]>;
export declare const FINDING_TRANSITIONS: Record<FindingStatus, readonly FindingStatus[]>;
export declare const PLAN_TRANSITIONS: Record<PlanStatus, readonly PlanStatus[]>;
export declare const WP_REVIEWABLE_STATUSES: readonly WorkingPaperStatus[];
export declare const REPORT_EDITABLE_STATUSES: readonly ReportStatus[];
export declare const CONTROL_SETS: Record<AuditType, Array<{
    controlReference: string;
    controlDescription: string;
    testProcedure: string;
}>>;
export declare const emptyChecklistProgress: () => Record<ChecklistResult, number>;
//# sourceMappingURL=audit.utility.d.ts.map