/**
 * Maps the page the user is on to the most relevant Help Centre article id
 * (ids come from the manual chapters — see manual/export-help.js).
 * First matching prefix wins, so list the most specific routes first.
 */
const ROUTES: Array<[prefix: string, articleId: string]> = [
  ['/dashboard', 'home'],
  ['/notifications', 'notif'],
  ['/profile', 'profile'],
  ['/help/center', 'help'],
  ['/help', 'help'],

  ['/audit/universe', 'universe-list'],
  ['/audit/plans', 'prog'],
  ['/audit/engagements', 'eng-overview'],
  ['/audit/sampling', 'sampling'],
  ['/audit/findings', 'findings-register'],
  ['/audit/reports', 'reviews-list'],
  ['/audit/periodic-reports', 'periodic'],
  ['/audit/compliance', 'library'],
  ['/audit/repository', 'repository'],
  ['/audit/domains', 'domains'],

  ['/workflow/approvals', 'approvals-where'],
  ['/workflow/assignments', 'assignments'],
  ['/workflow/escalations', 'escalations'],
  ['/workflow/policies', 'escal-policies'],
  ['/requests', 'requests'],

  ['/system-audit/analytics', 'sys-analytics'],
  ['/system-audit/access-reviews', 'sys-access'],
  ['/system-audit/events', 'events'],
  ['/system-audit/monitoring', 'sys-monitor'],
  ['/system-audit/security-tests', 'sys-sectest'],
  ['/system-audit/documentation', 'sys-docs'],
  ['/system-audit', 'sysaudit'],

  ['/risk', 'risk'],
  ['/assets', 'assets'],
  ['/documents', 'ch-documents'],
  ['/analytics', 'ch-analytics'],
  ['/predictive', 'predictive'],
  ['/logs', 'logs'],
  ['/users', 'users'],
  ['/integrations', 'integrations'],
  ['/settings', 'settings'],
];

/** Engagement page tabs (?tab=) → article. */
const ENGAGEMENT_TABS: Record<string, string> = {
  checklists: 'checklists',
  'working-papers': 'wp',
  evidence: 'evidence',
  requests: 'evreq',
  findings: 'eng-findings',
  report: 'review-flow',
  'follow-up': 'followup-tab',
  assets: 'eng-assets',
  imoc: 'eng-imoc',
  'system-audit': 'eng-sys',
};

/** Settings tabs (?tab=) → article. */
const SETTINGS_TABS: Record<string, string> = {
  roles: 'settings',
  'wp-templates': 'set-wp',
  'report-templates': 'set-review',
  'checklist-templates': 'set-checklists',
  customization: 'cust',
  directory: 'set-directory',
  config: 'set-config',
};

export const helpArticleForPath = (pathname: string | null | undefined, tab?: string | null): string => {
  const p = pathname ?? '';
  if (/^\/audit\/engagements\/[^/]+/.test(p) && tab && ENGAGEMENT_TABS[tab]) return ENGAGEMENT_TABS[tab];
  if (p.startsWith('/settings') && tab && SETTINGS_TABS[tab]) return SETTINGS_TABS[tab];
  if (/^\/audit\/findings\/[^/]+/.test(p)) return 'finding-detail';
  if (/^\/audit\/plans\/[^/]+/.test(p)) return 'prog-addplan';
  if (/^\/audit\/universe\/[^/]+/.test(p)) return 'universe-detail';
  if (/^\/risk\/[^/]+/.test(p)) return 'risk-detail';
  if (/^\/assets\/[^/]+/.test(p)) return 'asset-detail';
  if (/^\/requests\/[^/]+/.test(p)) return 'requests';
  if (/^\/system-audit\/analytics\/[^/]+/.test(p)) return 'sys-result';
  if (/^\/system-audit\/security-tests\/[^/]+/.test(p)) return 'sys-test-detail';
  const hit = ROUTES.find(([prefix]) => p === prefix || p.startsWith(`${prefix}/`));
  return hit ? hit[1] : 'ch-start';
};
