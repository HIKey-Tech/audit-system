/** Result of a gate check: whether it passed, and — when it didn't — why, in
 * plain language the frontend can show next to the status badge. */
export interface GateResult {
    met: boolean;
    unmet: string[];
}
/** True when an in_progress engagement satisfies every gate to enter under_review. */
export declare const canEnterUnderReview: (engagementId: string) => Promise<GateResult>;
/** True when an under_review engagement has an issued report (the deliberate human act). */
export declare const canEnterReported: (engagementId: string) => Promise<GateResult>;
/** True when a reported engagement has no findings left open/awaiting closure. */
export declare const canClose: (engagementId: string) => Promise<GateResult>;
/** Resolve which gate applies to the engagement's current status and return its
 * result, for surfacing "why hasn't this advanced" in the UI. Returns null for
 * statuses with no forward gate (planned, closed). */
export declare const getEngagementGateStatus: (engagementId: string, status: string) => Promise<GateResult | null>;
//# sourceMappingURL=engagement-gates.d.ts.map