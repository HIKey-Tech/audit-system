export declare const LIFECYCLE_NOTIFY_PERMISSION = "engagement:notify_lifecycle";
/**
 * Ensures the `engagement:notify_lifecycle` permission, report sign-off permissions,
 * and audit taxonomy are synchronized in the database using permission-based rules
 * rather than hardcoded role names.
 */
export declare const syncLifecycleNotificationPermission: () => Promise<void>;
/**
 * Notifies holders of `engagement:notify_lifecycle` (Head of Internal Audit / oversight),
 * the engagement audit team, and (on start/close) the auditee whenever an engagement
 * starts, moves from one stage to another, or closes.
 */
export declare const notifyEngagementLifecycleChange: (engagementId: string, previousStatus: string | null, newStatus: string, actorId?: string) => Promise<void>;
//# sourceMappingURL=lifecycle-notify.utility.d.ts.map