import {
  LayoutDashboard,
  BarChart3,
  Globe,
  ClipboardList,
  Briefcase,
  Inbox,
  AlertOctagon,
  AlertTriangle,
  FileText,
  Archive,
  ShieldAlert,
  CheckSquare,
  FolderOpen,
  Bell,
  ScrollText,
  Settings,
  SlidersHorizontal,
  Users,
  Send,
  Server,
  LayoutGrid,
  Library,
  CircleHelp,
  FlaskConical,
  Plug,
  Sparkles,
  type LucideIcon,
} from 'lucide-react';

import { AUDIT_DOMAINS } from '@/lib/audit-domains';
import type { NavVisibility } from '@/lib/hooks/usePermissions';

export interface NavLink {
  type: 'link';
  label: string;
  href: string;
  icon: LucideIcon;
  badgeKey?: 'notifications';
  comingSoon?: boolean;
  matchPrefix?: string;
  /** Key into NavVisibility — if set the item is hidden when the value is false. */
  visKey?: keyof NavVisibility;
  description?: string;
}

export interface NavGroup {
  type: 'group';
  label: string;
  icon: LucideIcon;
  description?: string;
  /** Groups opened by default — the daily path, so nothing needs a click to find. */
  defaultOpen?: boolean;
  children: NavLink[];
}

export type NavItem = NavLink | NavGroup;

export const NAV: NavItem[] = [
  { type: 'link', label: 'Home', href: '/dashboard', icon: LayoutDashboard, visKey: 'dashboard', description: 'Your personalized overview and to-dos.' },

  {
    type: 'group',
    label: 'Workflow',
    icon: CheckSquare,
    description: 'Approvals, assignments, escalations, and auditee requests.',
    defaultOpen: true,
    children: [
      // Each is its own route under /workflow; all are sub-features of the backend workflow module.
      { type: 'link', label: 'Audit Approvals', href: '/workflow/approvals', icon: Inbox, matchPrefix: '/workflow/approvals', visKey: 'workflow', description: 'Approve audit records — plans, engagements, and reports — awaiting your sign-off.' },
      { type: 'link', label: 'Assignments', href: '/workflow/assignments', icon: Users, matchPrefix: '/workflow/assignments', visKey: 'workflow', description: 'Staff assigned to engagements.' },
      { type: 'link', label: 'Escalations', href: '/workflow/escalations', icon: AlertOctagon, matchPrefix: '/workflow/escalations', visKey: 'workflow', description: 'Overdue items that have been escalated.' },
      { type: 'link', label: 'Requests', href: '/requests', icon: Send, matchPrefix: '/requests', visKey: 'requests', description: 'Ad-hoc approval & sign-off requests you send to or receive from colleagues.' },
      { type: 'link', label: 'Escalation Policies', href: '/workflow/policies', icon: SlidersHorizontal, matchPrefix: '/workflow/policies', visKey: 'escalationPolicies', description: 'Configure wait times before escalation per audit type.' },
    ],
  },

  {
    type: 'group',
    label: 'Audit Lifecycle',
    icon: Briefcase,
    description: 'The end-to-end flow: universe → plans → engagements → findings → reports.',
    defaultOpen: true,
    children: [
      // Ordered to follow the audit lifecycle: scope the universe → plan → execute
      // engagements → raise findings → issue reports.
      { type: 'link', label: 'Audit Universe', href: '/audit/universe', icon: Globe, matchPrefix: '/audit/universe', visKey: 'auditUniverse', description: 'Registry of auditable entities and their risk scores.' },
      { type: 'link', label: 'Audit Plans', href: '/audit/plans', icon: ClipboardList, matchPrefix: '/audit/plans', visKey: 'auditPlans', description: 'Annual risk-based audit plans and their approval status.' },
      { type: 'link', label: 'Engagements', href: '/audit/engagements', icon: Briefcase, matchPrefix: '/audit/engagements', visKey: 'engagements', description: 'Active and past audit engagements you can run end to end.' },
      { type: 'link', label: 'Sampling', href: '/audit/sampling', icon: FlaskConical, matchPrefix: '/audit/sampling', visKey: 'engagements', description: 'Draw a defensible, reproducible sample from a population CSV, stored as engagement evidence.' },
      { type: 'link', label: 'Findings', href: '/audit/findings', icon: AlertTriangle, matchPrefix: '/audit/findings', visKey: 'findings', description: 'Issues raised across audits, with severity and remediation status.' },
      { type: 'link', label: 'Reports', href: '/audit/reports', icon: FileText, matchPrefix: '/audit/reports', visKey: 'reports', description: 'Issued and in-progress audit reports.' },
      { type: 'link', label: 'Control Library', href: '/audit/compliance', icon: Library, matchPrefix: '/audit/compliance', visKey: 'engagements', description: 'Control library and per-framework coverage (ISO, PCI DSS, NIST, COBIT, NDPR).' },
      { type: 'link', label: 'Evidence Repository', href: '/audit/repository', icon: Archive, matchPrefix: '/audit/repository', visKey: 'engagements', description: 'Central, searchable store of all audit records, supporting documents, and evidence.' },
    ],
  },

  {
    type: 'group',
    label: 'Audit Modules',
    icon: LayoutGrid,
    description: 'Dedicated workspaces for IT, Financial, Systems, and Compliance audits — the same engagements as Audit Lifecycle, scoped to one audit type.',
    children: AUDIT_DOMAINS.map((d): NavLink => ({
      type: 'link',
      label: d.label,
      href: d.href,
      icon: d.icon,
      matchPrefix: d.href,
      visKey: 'engagements',
      description: `${d.focus} — ${d.framework}.`,
    })),
  },

  { type: 'link', label: 'Notifications', href: '/notifications', icon: Bell, badgeKey: 'notifications', visKey: 'notifications', description: 'System and workflow alerts addressed to you.' },
  { type: 'link', label: 'Risk Register', href: '/risk', icon: ShieldAlert, matchPrefix: '/risk', visKey: 'riskRegister', description: 'Enterprise risks with likelihood × impact scoring.' },
  { type: 'link', label: 'How IAMS works', href: '/help', icon: CircleHelp, matchPrefix: '/help', description: 'The audit lifecycle explained — who does what, and where.' },

  // Registries, admin, and system surfaces — out of the auditor's daily path.
  {
    type: 'group',
    label: 'System',
    icon: Settings,
    description: 'Registries, analytics, logs, and administration.',
    children: [
      { type: 'link', label: 'Assets', href: '/assets', icon: Server, matchPrefix: '/assets', visKey: 'assets', description: 'Asset registry with ownership, classification, attestations, and audit links.' },
      { type: 'link', label: 'Documents', href: '/documents', icon: FolderOpen, matchPrefix: '/documents', visKey: 'documents', description: 'Files and evidence attached to audit records.' },
      { type: 'link', label: 'Analytics', href: '/analytics', icon: BarChart3, matchPrefix: '/analytics', visKey: 'analytics', description: 'Dashboards and metrics on the audit programme.' },
      { type: 'link', label: 'Audit Logs', href: '/logs', icon: ScrollText, matchPrefix: '/logs', visKey: 'auditLogs', description: 'Tamper-evident trail of every action in the system.' },
      { type: 'link', label: 'Users', href: '/users', icon: Users, matchPrefix: '/users', visKey: 'users', description: 'User accounts, roles, and permissions.' },
      { type: 'link', label: 'Integrations', href: '/integrations', icon: Plug, matchPrefix: '/integrations', visKey: 'integrations', comingSoon: true, description: 'Read-only links to Dynafin, IMOC, Active Directory, and Project Plus.' },
      { type: 'link', label: 'Predictive', href: '/predictive', icon: Sparkles, matchPrefix: '/predictive', visKey: 'predictive', comingSoon: true, description: 'Risk forecasting and anomaly detection over the audit warehouse.' },
      { type: 'link', label: 'Settings', href: '/settings', icon: Settings, matchPrefix: '/settings', visKey: 'settings', description: 'Templates, roles, and system configuration.' },
    ],
  },
];

/** Flattened links, for the command palette and title lookup. */
export const NAV_LINKS: NavLink[] = NAV.flatMap((item) =>
  item.type === 'group' ? item.children : [item],
);

/** Groups expanded on a first visit, before the user has a stored preference. */
export const DEFAULT_OPEN_GROUPS: string[] = NAV.filter(
  (item): item is NavGroup => item.type === 'group' && Boolean(item.defaultOpen),
).map((g) => g.label);

/** Routes that are reachable but deliberately absent from the sidebar. */
const EXTRA_TITLES: Record<string, string> = {
  '/profile': 'Profile',
};

/**
 * Page title for a pathname, resolved from the nav config so it can never drift
 * from the sidebar. Longest matching prefix wins, so detail routes inherit their
 * section's title.
 */
export const titleForPath = (pathname: string | null | undefined): string => {
  if (!pathname) return '';
  const extra = Object.keys(EXTRA_TITLES).find(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );
  if (extra) return EXTRA_TITLES[extra];

  const match = NAV_LINKS.filter((l) => {
    const prefix = l.matchPrefix ?? l.href;
    return pathname === prefix || pathname.startsWith(`${prefix}/`);
  }).sort((a, b) => (b.matchPrefix ?? b.href).length - (a.matchPrefix ?? a.href).length)[0];
  return match?.label ?? '';
};
