import { AuditType } from '../domain/enum/audit.enum';
export interface AuditLifecycleRules {
    requireAllChecklistsTestedBeforeUnderReview: boolean;
    requireApprovedWorkingPaperBeforeUnderReview: boolean;
    requireReportIssuedBeforeReported: boolean;
    requireClosedFindingsBeforeClose: boolean;
}
export interface AuditSlaRules {
    defaultEngagementSlaDays: number;
    defaultFindingDueDays: number;
    highRiskFindingDueDays: number;
    criticalFindingDueDays: number;
}
export interface ChecklistTemplateControl {
    controlReference: string;
    controlDescription: string;
    testProcedure: string;
}
export type ChecklistTemplateConfig = Partial<Record<AuditType, ChecklistTemplateControl[]>>;
export declare const DEFAULT_AUDIT_LIFECYCLE_RULES: AuditLifecycleRules;
export declare const DEFAULT_AUDIT_SLA_RULES: AuditSlaRules;
export declare const DEFAULT_CHECKLIST_TEMPLATE_CONFIG: ChecklistTemplateConfig;
export declare const getAuditLifecycleRules: () => Promise<AuditLifecycleRules>;
export declare const getAuditSlaRules: () => Promise<AuditSlaRules>;
export declare const getChecklistTemplateControls: (auditType: AuditType) => Promise<ChecklistTemplateControl[]>;
/**
 * Authoritative control source for populating an engagement's checklist.
 *
 * Prefers the structured compliance_controls library (active controls for the
 * audit type); falls back to the legacy checklist_templates JSON / built-in
 * CONTROL_SETS when the library has no controls for that type. Callers still
 * snapshot the returned text onto the checklist row, so a populated engagement
 * is unaffected by later edits to the library.
 */
export declare const getEngagementControls: (auditType: AuditType) => Promise<ChecklistTemplateControl[]>;
export declare const CHECKLIST_TEMPLATE_CONFIG_KEY = "checklist_templates";
/**
 * Full per-audit-type checklist template config: saved overrides for each audit
 * type, falling back to the built-in CONTROL_SETS where nothing is configured.
 */
export declare const getChecklistTemplateConfig: () => Promise<Record<AuditType, ChecklistTemplateControl[]>>;
/** Validates and persists (upserts) the full checklist template config. */
export declare const setChecklistTemplateConfig: (config: ChecklistTemplateConfig, actorId: string) => Promise<Record<AuditType, ChecklistTemplateControl[]>>;
/**
 * Sentinel chain entry: resolve this level to the entity's assigned engagement
 * manager (a specific person) rather than to a permission holder.
 */
export declare const ENGAGEMENT_MANAGER_APPROVER = "engagement_manager";
export interface ApprovalMatrix {
    /**
     * Ordered approver chain per entity type. Each level is either the
     * ENGAGEMENT_MANAGER_APPROVER sentinel (resolved to the entity's engagement
     * manager) or a permission slug (resolved to an active holder of that
     * permission). Approvers are never resolved by role name — roles matter only
     * insofar as an admin grants these permissions to them.
     */
    auditPlan: string[];
    workingPaper: string[];
    auditReport: string[];
    findingClosure: string[];
}
export declare const DEFAULT_APPROVAL_MATRIX: ApprovalMatrix;
/**
 * Reads the GBB-configurable approval matrix from system_config. Admins edit this
 * in Settings to control who signs off on plans, working papers, and reports — the
 * approval engine resolves each level to a permission holder (or the engagement
 * manager), never to a hardcoded role.
 */
export declare const getApprovalMatrix: () => Promise<ApprovalMatrix>;
/**
 * Relative importance of each signal in the audit-planning priority score.
 * Values are relative weights (any scale — they are normalized by their sum),
 * editable by admins in Settings so GBB defines what "priority" means.
 */
export interface PlanningPriorityWeights {
    riskScore: number;
    openFindings: number;
    overdueForAudit: number;
    neverAudited: number;
    timeSinceLastAudit: number;
}
export declare const DEFAULT_PLANNING_PRIORITY_WEIGHTS: PlanningPriorityWeights;
export declare const getPlanningPriorityWeights: () => Promise<PlanningPriorityWeights>;
/**
 * Serialize a per-engagement checklist control set for storage on the engagement.
 * Returns null when there is nothing to store (so populate falls back to the
 * global per-audit-type template).
 */
export declare const serializeChecklistControls: (controls: ChecklistTemplateControl[] | undefined | null) => string | null;
/**
 * Parse a per-engagement checklist control snapshot stored on the engagement.
 * Returns null when absent or invalid, signalling callers to fall back to the
 * global per-audit-type template.
 */
export declare const parseChecklistTemplateSnapshot: (value: string | null | undefined) => ChecklistTemplateControl[] | null;
//# sourceMappingURL=audit-config.utility.d.ts.map