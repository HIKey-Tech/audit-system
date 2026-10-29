/**
 * Ensures every user assigned as an auditee on an engagement or as a responder
 * on a finding holds the `auditee` role in `user_roles` (additive — existing roles
 * are preserved). This guarantees they automatically hold `followup:respond`,
 * `followup:evidence`, and `evidence:upload` permissions without manual admin
 * role assignment.
 */
export declare const ensureAuditeeRoleAssigned: (userIds: (string | null | undefined)[], assignedById?: string) => Promise<void>;
//# sourceMappingURL=auditee-role.utility.d.ts.map