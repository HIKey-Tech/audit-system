export interface RiskActorContext {
    id: string;
    roles: string[];
    permissions: string[];
}
export interface RiskScoreTrendPoint {
    assessmentId: string;
    likelihood: number;
    impact: number;
    score: number;
    assessedAt: string;
}
export interface RiskBandSummary {
    low: number;
    medium: number;
    high: number;
    critical: number;
}
export interface RiskStatusSummary {
    open: number;
    mitigated: number;
    accepted: number;
    closed: number;
}
//# sourceMappingURL=risk.entity.d.ts.map