/**
 * Where a notification takes you when clicked. Shared by the notifications page
 * and the header dropdown so both land on the same record.
 */
const REFERENCE_HREF: Record<string, (id: string) => string> = {
  audit_engagement: (id) => `/audit/engagements/${id}`,
  audit_finding: (id) => `/audit/findings/${id}`,
  audit_plan: (id) => `/audit/plans/${id}`,
  // Legacy audit_report rows carry the *report* id, which has no page of its
  // own — land on the reports register. New report notifications reference the
  // engagement directly.
  audit_report: () => `/audit/reports`,
  risk_register: (id) => `/risk/${id}`,
  workflow_approval: () => `/workflow/approvals`,
};

export const notificationHref = (
  referenceType: string | null | undefined,
  referenceId: string | null | undefined,
): string | null => {
  if (!referenceType) return null;
  const build = REFERENCE_HREF[referenceType];
  if (!build) return null;
  // Builders that ignore the id (reports, approvals) still resolve without one.
  if (!referenceId && build.length > 0) return null;
  return build(referenceId ?? '');
};
