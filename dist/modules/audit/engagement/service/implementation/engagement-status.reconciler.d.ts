type ApprovalEntityType = 'audit_working_paper' | 'audit_finding_closure';
/**
 * Advance an engagement as far forward as its gates allow. Idempotent and safe to
 * call repeatedly. Never crosses the manual planned -> in_progress transition.
 * Mirrors the side effects of EngagementService.updateStatus for the transitions
 * it performs (actual_end_date + universe.last_audited_at on close).
 */
export declare const reconcileEngagementStatus: (engagementId: string, actorId: string) => Promise<void>;
/** Resolve the engagement behind a just-approved working paper / finding closure, then reconcile. */
export declare const reconcileEngagementForApprovalEntity: (entityType: ApprovalEntityType, entityId: string, actorId: string) => Promise<void>;
export {};
//# sourceMappingURL=engagement-status.reconciler.d.ts.map