import { Prisma } from '@prisma/client';
import { AuditType, ChecklistResult, EngagementStatus, FindingStatus, PlanStatus, ReportStatus, WorkingPaperStatus } from '../domain/enum/audit.enum';
export declare const AUDIT_ADMIN_ROLES: readonly string[];
export declare const AUDIT_REVIEW_ROLES: readonly string[];
export declare const AUDIT_WORK_ROLES: readonly string[];
export declare const AUDITEE_ROLE = "auditee";
export declare const hasAuditeeRole: (roles: string[]) => boolean;
export declare const assertHasRole: (roles: string[], allowedRoles: readonly string[], message?: string) => void;
/**
 * Permission-based authorization gate. Prefer this over assertHasRole so that
 * roles remain fully customizable in Settings — a user is authorized by the
 * permissions their role(s) grant, never by a hardcoded role name. super_admin
 * is seeded with every permission slug, so it continues to pass.
 */
export declare const assertHasPermission: (permissions: string[], required: string, message?: string) => void;
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