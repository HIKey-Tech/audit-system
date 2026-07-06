/** Permission-based authorization gate (see audit.utility for rationale). */
export declare const assertHasPermission: (permissions: string[], required: string, message?: string) => void;
/**
 * Admin-configurable escalation matrix. Maps escalation tiers to the role names
 * whose holders are notified once an escalation passes the entity's own
 * assignees (lead auditor / engagement manager / current approver). Stored in
 * `system_config` under `escalation_matrix` and editable in Settings, mirroring
 * the approval matrix — so escalation targets are not hardcoded role names.
 */
export interface EscalationMatrix {
    auditEngagement: {
        level3: string[];
        beyond: string[];
    };
    workflowApproval: {
        level3: string[];
        level4: string[];
        otherwise: string[];
    };
}
export declare const DEFAULT_ESCALATION_MATRIX: EscalationMatrix;
export declare const getEscalationMatrix: () => Promise<EscalationMatrix>;
/**
 * Boot-time sanity check: warn when an escalation tier targets role names
 * that no active user holds (e.g. a deployment renamed/replaced the seeded
 * director/cae roles without updating `system_config.escalation_matrix`) —
 * escalations at that tier would notify nobody. Never throws.
 */
export declare const warnOnUnresolvableEscalationTargets: () => Promise<void>;
export declare const hoursAgo: (hours: number) => Date;
export declare const hasElapsed: (from: Date, hours: number, now?: Date) => boolean;
//# sourceMappingURL=workflow.utility.d.ts.map