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
export interface ApprovalMatrix {
    /** Ordered list of role names whose holders approve each level, per entity type. */
    auditPlan: string[];
    workingPaper: string[];
    auditReport: string[];
}
export declare const DEFAULT_APPROVAL_MATRIX: ApprovalMatrix;
/**
 * Reads the GBB-configurable approval matrix from system_config. Admins edit this
 * in Settings to control who signs off on plans, working papers, and reports — the
 * approval engine resolves these role names to users instead of hardcoding them.
 */
export declare const getApprovalMatrix: () => Promise<ApprovalMatrix>;
//# sourceMappingURL=audit-config.utility.d.ts.map