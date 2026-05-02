// Roles whose holder always sees data across the entire organisation.
export const DASHBOARD_ADMIN_ROLES: readonly string[] = [
  'super_admin',
  'audit_admin',
  'director',
  'cae',
];

export const DASHBOARD_AUDITOR_ROLES: readonly string[] = [
  'audit_lead',
  'auditor',
];

export const AUDITEE_ROLE = 'auditee';

export const hasAdminLevelRole = (roles: string[]): boolean =>
  roles.some((role) => DASHBOARD_ADMIN_ROLES.includes(role));

// True when the user must be scoped to engagements they lead.
// Admin-level roles always override the scoping.
export const isRestrictedAuditor = (roles: string[]): boolean =>
  !hasAdminLevelRole(roles)
  && roles.some((role) => DASHBOARD_AUDITOR_ROLES.includes(role));

// True when the user must be scoped to findings against them.
// Admin-level roles always override the scoping.
export const isRestrictedAuditee = (roles: string[]): boolean =>
  !hasAdminLevelRole(roles) && roles.includes(AUDITEE_ROLE);

export const startOfCurrentYear = (now: Date = new Date()): Date =>
  new Date(now.getFullYear(), 0, 1);

export const startOfCurrentMonth = (now: Date = new Date()): Date =>
  new Date(now.getFullYear(), now.getMonth(), 1);

export const startOfNextMonth = (now: Date = new Date()): Date =>
  new Date(now.getFullYear(), now.getMonth() + 1, 1);

export const daysFromNow = (days: number, now: Date = new Date()): Date => {
  const result = new Date(now);
  result.setDate(result.getDate() + days);
  return result;
};

export const daysBetween = (earlier: Date, later: Date): number => {
  const ms = later.getTime() - earlier.getTime();
  return Math.floor(ms / (1000 * 60 * 60 * 24));
};
