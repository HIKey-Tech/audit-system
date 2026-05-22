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
//# sourceMappingURL=audit-config.utility.d.ts.map