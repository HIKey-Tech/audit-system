export declare const DASHBOARD_ADMIN_ROLES: readonly string[];
export declare const DASHBOARD_AUDITOR_ROLES: readonly string[];
export declare const AUDITEE_ROLE = "auditee";
export declare const hasAdminLevelRole: (roles: string[]) => boolean;
export declare const isRestrictedAuditor: (roles: string[]) => boolean;
export declare const isRestrictedAuditee: (roles: string[]) => boolean;
export declare const startOfCurrentYear: (now?: Date) => Date;
export declare const startOfCurrentMonth: (now?: Date) => Date;
export declare const startOfNextMonth: (now?: Date) => Date;
export declare const daysFromNow: (days: number, now?: Date) => Date;
export declare const daysBetween: (earlier: Date, later: Date) => number;
//# sourceMappingURL=dashboard.utility.d.ts.map