/** True when an in_progress engagement satisfies every gate to enter under_review. */
export declare const canEnterUnderReview: (engagementId: string) => Promise<boolean>;
/** True when an under_review engagement has an issued report (the deliberate human act). */
export declare const canEnterReported: (engagementId: string) => Promise<boolean>;
/** True when a reported engagement has no findings left open/awaiting closure. */
export declare const canClose: (engagementId: string) => Promise<boolean>;
//# sourceMappingURL=engagement-gates.d.ts.map