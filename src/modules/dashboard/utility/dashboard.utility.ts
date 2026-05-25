// True when the user must be scoped to engagements they lead.
// Having engagement:read_all overrides the scoping.
export const isRestrictedAuditor = (permissions: string[]): boolean =>
  !permissions.includes('engagement:read_all') && permissions.includes('engagement:read');

// True when the user must be scoped to findings against them.
// Having finding:read_all overrides the scoping.
export const isRestrictedAuditee = (permissions: string[]): boolean =>
  !permissions.includes('finding:read_all') && (permissions.includes('followup:respond') || !permissions.includes('engagement:read'));

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
