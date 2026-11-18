/**
 * Which permission opens each area of the application. One list, used by the menu (to hide what a person cannot use)
 * and by the page guard (to say so plainly if they type the address anyway), so the two can never disagree and a
 * person never lands on a page full of access errors.
 *
 * The longest matching prefix wins. A route with no entry is open to every signed-in user.
 */
export interface RouteRule {
  prefix: string;
  /** Any one of these opens the page. */
  anyOf: string[];
  /** What to call the area in the "no access" message. */
  label: string;
}

export const ROUTE_RULES: RouteRule[] = [
  { prefix: '/audit/universe', anyOf: ['universe:read'], label: 'the Audit Universe' },
  { prefix: '/audit/plans', anyOf: ['plan:read'], label: 'Audit Programmes' },
  { prefix: '/audit/engagements', anyOf: ['engagement:read'], label: 'Engagements' },
  { prefix: '/audit/sampling', anyOf: ['evidence:request'], label: 'Sampling' },
  { prefix: '/audit/findings', anyOf: ['finding:read'], label: 'Findings' },
  { prefix: '/audit/reports', anyOf: ['report:read'], label: 'Reviews' },
  { prefix: '/audit/periodic-reports', anyOf: ['report:read'], label: 'Periodic Reports' },
  { prefix: '/audit/compliance', anyOf: ['control:read'], label: 'the Control Library' },
  { prefix: '/audit/repository', anyOf: ['working_paper:read'], label: 'the Evidence Repository' },
  { prefix: '/audit/domains', anyOf: ['checklist:read'], label: 'the Audit Modules' },
  { prefix: '/assets', anyOf: ['asset:read'], label: 'Assets' },
  { prefix: '/risk', anyOf: ['risk:read'], label: 'the Risk Register' },
  { prefix: '/analytics', anyOf: ['dashboard:read'], label: 'Analytics' },
  { prefix: '/predictive', anyOf: ['predictive:read'], label: 'Audit Intelligence' },
  { prefix: '/integrations', anyOf: ['integration:read'], label: 'Integrations' },
  { prefix: '/logs', anyOf: ['log:read'], label: 'Audit Logs' },
  { prefix: '/users', anyOf: ['user:read'], label: 'Users' },
  { prefix: '/documents', anyOf: ['document:read'], label: 'Documents' },
  { prefix: '/requests', anyOf: ['request:read'], label: 'Requests' },
  { prefix: '/workflow/approvals', anyOf: ['approval:read'], label: 'Review/Approval' },
  { prefix: '/workflow/assignments', anyOf: ['assignment:read'], label: 'Assignments' },
  { prefix: '/workflow/escalations', anyOf: ['escalation:read'], label: 'Escalations' },
  { prefix: '/workflow/policies', anyOf: ['escalation_policy:read'], label: 'Escalation Policies' },
  { prefix: '/system-audit/events', anyOf: ['log:read'], label: 'Event monitoring' },
  { prefix: '/system-audit/security-tests', anyOf: ['sectest:read'], label: 'Security testing' },
  { prefix: '/system-audit/documentation', anyOf: ['sysdoc:read'], label: 'System documentation' },
  { prefix: '/system-audit/analytics', anyOf: ['sysaudit:read'], label: 'Data analytics' },
  { prefix: '/system-audit/access-reviews', anyOf: ['sysaudit:read'], label: 'Access reviews' },
  { prefix: '/system-audit/monitoring', anyOf: ['sysaudit:read'], label: 'Continuous monitoring' },
  { prefix: '/system-audit', anyOf: ['sysaudit:read', 'sectest:read', 'sysdoc:read'], label: 'the System Audit toolkit' },
];

/** The rule that applies to a path, or null when the path is open to everyone signed in. */
export const ruleForPath = (pathname: string): RouteRule | null => {
  let best: RouteRule | null = null;
  for (const rule of ROUTE_RULES) {
    const hit = pathname === rule.prefix || pathname.startsWith(`${rule.prefix}/`);
    if (hit && (!best || rule.prefix.length > best.prefix.length)) best = rule;
  }
  return best;
};
