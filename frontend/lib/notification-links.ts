/**
 * Where a notification takes you when clicked. Shared by the notifications page
 * and the header dropdown so both land on the same record.
 */
const REFERENCE_HREF: Record<string, (id?: string | null) => string> = {
  // Workflow Requests & Approvals
  workflow_request: (id) => (id ? `/requests/${id}` : '/requests'),
  request: (id) => (id ? `/requests/${id}` : '/requests'),
  workflow_approval: () => '/workflow/approvals',
  approval: () => '/workflow/approvals',
  workflow_assignment: () => '/workflow/assignments',
  assignment: () => '/workflow/assignments',
  workflow_escalation: () => '/workflow/escalations',
  escalation: () => '/workflow/escalations',

  // Audit Lifecycle
  audit_engagement: (id) => (id ? `/audit/engagements/${id}` : '/audit/engagements'),
  engagement: (id) => (id ? `/audit/engagements/${id}` : '/audit/engagements'),
  audit_finding: (id) => (id ? `/audit/findings/${id}` : '/audit/findings'),
  finding: (id) => (id ? `/audit/findings/${id}` : '/audit/findings'),
  audit_plan: (id) => (id ? `/audit/plans/${id}` : '/audit/plans'),
  plan: (id) => (id ? `/audit/plans/${id}` : '/audit/plans'),
  audit_report: () => '/audit/reports',
  report: () => '/audit/reports',
  audit_evidence_request: (id) =>
    id ? `/audit/engagements/${id}?tab=requests` : '/audit/engagements',
  evidence_request: (id) =>
    id ? `/audit/engagements/${id}?tab=requests` : '/audit/engagements',
  audit_working_paper: (id) =>
    id ? `/audit/engagements/${id}?tab=working-papers` : '/audit/engagements',
  working_paper: (id) =>
    id ? `/audit/engagements/${id}?tab=working-papers` : '/audit/engagements',
  audit_universe: () => '/audit/universe',
  universe: () => '/audit/universe',

  // Risk, System, and Profiles
  risk_register: (id) => (id ? `/risk/${id}` : '/risk'),
  risk: (id) => (id ? `/risk/${id}` : '/risk'),
  system_audit_run: (id) =>
    id ? `/system-audit/analytics/${id}` : '/system-audit/analytics',
  system_audit: (id) =>
    id ? `/system-audit/analytics/${id}` : '/system-audit',
  user: () => '/profile',
  document: () => '/documents',
};

export const notificationHref = (
  referenceType?: string | null,
  referenceId?: string | null,
  context?: string | { title?: string | null; body?: string | null } | null,
): string => {
  const normType = referenceType?.trim().toLowerCase();
  if (normType && REFERENCE_HREF[normType]) {
    return REFERENCE_HREF[normType](referenceId);
  }

  // Fallback keyword detection from title and body
  const title = typeof context === 'string' ? context : context?.title ?? '';
  const body = typeof context === 'object' && context ? context.body ?? '' : '';
  const text = `${normType ?? ''} ${title} ${body}`.toLowerCase();

  if (text.includes('request') || text.includes('memo')) {
    return referenceId ? `/requests/${referenceId}` : '/requests';
  }
  if (text.includes('approval') || text.includes('sign-off') || text.includes('approve') || text.includes('review')) {
    return '/workflow/approvals';
  }
  if (text.includes('assignment') || text.includes('assigned')) {
    return '/workflow/assignments';
  }
  if (text.includes('escalat')) {
    return '/workflow/escalations';
  }
  if (text.includes('finding') || text.includes('remediation')) {
    return referenceId ? `/audit/findings/${referenceId}` : '/audit/findings';
  }
  if (text.includes('evidence')) {
    return referenceId ? `/audit/engagements/${referenceId}?tab=requests` : '/audit/engagements';
  }
  if (text.includes('engagement') || text.includes('fieldwork')) {
    return referenceId ? `/audit/engagements/${referenceId}` : '/audit/engagements';
  }
  if (text.includes('plan') || text.includes('programme')) {
    return referenceId ? `/audit/plans/${referenceId}` : '/audit/plans';
  }
  if (text.includes('report')) {
    return '/audit/reports';
  }
  if (text.includes('risk')) {
    return referenceId ? `/risk/${referenceId}` : '/risk';
  }
  if (text.includes('system') || text.includes('security') || text.includes('audit run')) {
    return referenceId ? `/system-audit/analytics/${referenceId}` : '/system-audit';
  }
  if (text.includes('login') || text.includes('password') || text.includes('profile')) {
    return '/profile';
  }

  // Default fallback to notifications list
  return '/notifications';
};
