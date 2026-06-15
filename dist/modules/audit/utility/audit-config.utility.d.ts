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
}
export declare const DEFAULT_APPROVAL_MATRIX: ApprovalMatrix;
/**
 * Reads the GBB-configurable approval matrix from system_config. Admins edit this
 * in Settings to control who signs off on plans, working papers, and reports — the
 * approval engine resolves each level to a permission holder (or the engagement
 * manager), never to a hardcoded role.
 */
export declare const getApprovalMatrix: () => Promise<ApprovalMatrix>;
//# sourceMappingURL=audit-config.utility.d.ts.map