export type PredictiveSeverity = 'low' | 'medium' | 'high' | 'critical';
export interface PredictiveRationaleFactor {
    code: string;
    label: string;
    value: string;
    weight: number;
}
export interface EngagementRiskInput {
    status: string;
    plannedStartDate: Date;
    actualStartDate: Date | null;
    slaDeadline: Date;
    checklistTotal: number;
    checklistTested: number;
    workingPaperTotal: number;
    workingPaperApproved: number;
    openEvidenceRequests: number;
    plannedHours: number | null;
    actualHours: number;
}
export interface FindingRiskInput {
    status: string;
    severity: string;
    dueDate: Date;
    hasManagementResponse: boolean;
    hasRemediationEvidence: boolean;
}
export interface EvidenceRequestRiskInput {
    dueDate: Date | null;
    status: string;
}
export interface RuleRiskResult {
    score: number;
    severity: PredictiveSeverity;
    rationale: PredictiveRationaleFactor[];
}
export declare const severityForScore: (score: number) => PredictiveSeverity;
/**
 * Produces an explainable delivery-risk score from live workflow state. It is
 * intentionally a rules score rather than an asserted statistical probability;
 * the later model can be evaluated against the snapshots/outcomes it creates.
 */
export declare const scoreEngagementDeliveryRisk: (input: EngagementRiskInput, now: Date) => RuleRiskResult;
export declare const scoreFindingRemediationRisk: (input: FindingRiskInput, now: Date) => RuleRiskResult;
export declare const scoreEvidenceRequestDelayRisk: (input: EvidenceRequestRiskInput, now: Date) => RuleRiskResult;
//# sourceMappingURL=predictive.utility.d.ts.map