'use client';

import { useMemo } from 'react';
import { useSession, type SessionUser } from '@/components/providers/AuthProvider';

// ─────────────────────────────────────────────────────────────
// Role constants
// ─────────────────────────────────────────────────────────────
export type AppRole =
  | 'super_admin'
  | 'audit_admin'
  | 'audit_manager'
  | 'audit_lead'
  | 'auditor'
  | 'director'
  | 'cae'
  | 'auditee'
  | 'viewer';

// ─────────────────────────────────────────────────────────────
// Permissions helper (pure functions — can be used outside React)
// ─────────────────────────────────────────────────────────────

/** Returns true if the user has the specific permission string (super_admin always passes). */
export const userHasPermission = (user: SessionUser | null, permission: string): boolean => {
  if (!user) return false;
  if (user.roles.includes('super_admin')) return true;
  return user.permissions.includes(permission);
};

/** Convenience: is this user an admin-level role? (super_admin, audit_admin, audit_manager, cae) */
export const isAdminLevel = (user: SessionUser | null): boolean =>
  userHasPermission(user, 'plan:approve') ||
  userHasPermission(user, 'settings:read') ||
  userHasPermission(user, 'user:admin');

/** Can this user manage the full audit programme (plans, universe, engagements creation)? */
export const canManageAuditProgramme = (user: SessionUser | null): boolean =>
  userHasPermission(user, 'engagement:create') ||
  userHasPermission(user, 'plan:create');

/** Is this user a fieldwork-level auditor? (audit_lead or auditor) */
export const isFieldAuditor = (user: SessionUser | null): boolean =>
  userHasPermission(user, 'working_paper:create') &&
  !userHasPermission(user, 'plan:approve');

/** Is this user an auditee? */
export const isAuditee = (user: SessionUser | null): boolean =>
  userHasPermission(user, 'followup:respond') &&
  !userHasPermission(user, 'working_paper:read');

/** Is this user a director? (read-only oversight) */
export const isDirector = (user: SessionUser | null): boolean =>
  userHasPermission(user, 'engagement:read_all') &&
  !userHasPermission(user, 'working_paper:create') &&
  !userHasPermission(user, 'report:issue') &&
  !userHasPermission(user, 'settings:read');

/** Is this user executive-level (director or cae)? */
export const isExecutive = (user: SessionUser | null): boolean =>
  userHasPermission(user, 'engagement:read_all') &&
  !userHasPermission(user, 'working_paper:create') &&
  !userHasPermission(user, 'plan:create');

// ─────────────────────────────────────────────────────────────
// Analytics scope
// ─────────────────────────────────────────────────────────────
// Mirrors the backend scoping in dashboard.utility.ts (isRestrictedAuditor /
// isRestrictedAuditee) so the page can tell the viewer WHICH data they are
// seeing. The server is still the source of truth — this only labels the view.
export type AnalyticsScopeKey = 'org' | 'engagements' | 'findings';

export interface AnalyticsScope {
  key: AnalyticsScopeKey;
  label: string;
  description: string;
}

export const getAnalyticsScope = (user: SessionUser | null): AnalyticsScope => {
  const can = (perm: string): boolean => userHasPermission(user, perm);
  const readAllEngagements = can('engagement:read_all');
  const readEngagements = can('engagement:read');
  const readAllFindings = can('finding:read_all');
  const respondFollowup = can('followup:respond');

  // Backend: isRestrictedAuditee
  const restrictedAuditee = !readAllFindings && (respondFollowup || !readEngagements);
  // Backend: isRestrictedAuditor
  const restrictedAuditor = !readAllEngagements && readEngagements;

  // Auditees (no engagement visibility) see only findings raised against them.
  if (restrictedAuditee && !readEngagements) {
    return {
      key: 'findings',
      label: 'Your findings',
      description: 'Scoped to findings raised against you. Risk metrics remain organization-wide.',
    };
  }
  // Field auditors see only the engagements they lead or are assigned to.
  if (restrictedAuditor) {
    return {
      key: 'engagements',
      label: 'Your engagements',
      description: 'Scoped to engagements you lead or are assigned to. Risk metrics remain organization-wide.',
    };
  }
  // Oversight roles see the whole programme.
  return {
    key: 'org',
    label: 'Organization-wide',
    description: 'Aggregated across all engagements, findings, and reports in the audit programme.',
  };
};

// ─────────────────────────────────────────────────────────────
// Navigation visibility rules
// ─────────────────────────────────────────────────────────────
export interface NavVisibility {
  dashboard: boolean;
  analytics: boolean;
  assets: boolean;
  auditUniverse: boolean;
  auditPlans: boolean;
  engagements: boolean;
  findings: boolean;
  reports: boolean;
  riskRegister: boolean;
  workflow: boolean;
  escalationPolicies: boolean;
  requests: boolean;
  documents: boolean;
  notifications: boolean;
  auditLogs: boolean;
  integrations: boolean;
  predictive: boolean;
  settings: boolean;
  users: boolean;
}

export const getNavVisibility = (user: SessionUser | null): NavVisibility => {
  if (!user) {
    return {
      dashboard: false,
      analytics: false,
      assets: false,
      auditUniverse: false,
      auditPlans: false,
      engagements: false,
      findings: false,
      reports: false,
      riskRegister: false,
      workflow: false,
      escalationPolicies: false,
      requests: false,
      documents: false,
      notifications: false,
      auditLogs: false,
      integrations: false,
      predictive: false,
      settings: false,
      users: false,
    };
  }

  return {
    dashboard: true,
    analytics: userHasPermission(user, 'dashboard:read'),
    assets: userHasPermission(user, 'asset:read'),
    auditUniverse: userHasPermission(user, 'universe:read'),
    auditPlans: userHasPermission(user, 'plan:read'),
    engagements: userHasPermission(user, 'engagement:read'),
    findings: userHasPermission(user, 'finding:read'),
    reports: userHasPermission(user, 'report:read'),
    riskRegister: userHasPermission(user, 'risk:read'),
    workflow: userHasPermission(user, 'approval:read') || userHasPermission(user, 'assignment:read'),
    escalationPolicies: userHasPermission(user, 'escalation_policy:read'),
    requests: userHasPermission(user, 'request:read'),
    documents: userHasPermission(user, 'document:read'),
    notifications: true,
    auditLogs: userHasPermission(user, 'log:read'),
    integrations: userHasPermission(user, 'integration:read'),
    predictive: userHasPermission(user, 'predictive:read'),
    settings: userHasPermission(user, 'settings:read'),
    users: userHasPermission(user, 'user:read'),
  };
};

// ─────────────────────────────────────────────────────────────
// Dashboard section visibility
// ─────────────────────────────────────────────────────────────
export interface DashboardVisibility {
  statCards: boolean;
  recentActivity: boolean;
  findingsBySeverity: boolean;
  myWork: boolean;
  topRisks: boolean;
  escalations: boolean;
}

export const getDashboardVisibility = (user: SessionUser | null): DashboardVisibility => {
  if (!user) {
    return { statCards: false, recentActivity: false, findingsBySeverity: false, myWork: false, topRisks: false, escalations: false };
  }

  // Permission-driven so the dashboard adapts to whatever roles GBB defines.
  const can = (perm: string): boolean => userHasPermission(user, perm);
  // "Oversight" = anyone who reviews/approves work or monitors risk programme-wide.
  const oversight = can('approval:read') || can('risk_monitoring:read');

  return {
    // Org-wide programme stat cards: oversight roles.
    statCards: oversight,

    // Recent activity feed: oversight roles or anyone who can read the audit log.
    recentActivity: oversight || can('log:read'),

    // Findings by severity: anyone who can read findings (data is scoped server-side).
    findingsBySeverity: can('finding:read'),

    // My Work: everyone lands on their own work first.
    myWork: true,

    // Top risks: risk monitors.
    topRisks: can('risk_monitoring:read'),

    // Escalations: anyone who can see escalations.
    escalations: can('escalation:read'),
  };
};

// ─────────────────────────────────────────────────────────────
// React hook (wraps the session)
// ─────────────────────────────────────────────────────────────
export const usePermissions = () => {
  const session = useSession();

  return useMemo(
    () => ({
      user: session,

      // Permission check (super_admin always passes)
      hasPermission: (perm: string) => userHasPermission(session, perm),

      // Convenience booleans — all permission-derived (super_admin is the one
      // sanctioned system-role bootstrap).
      isSuperAdmin: session.roles.includes('super_admin'),
      isAdminLevel: isAdminLevel(session),
      canManageAuditProgramme: canManageAuditProgramme(session),
      isFieldAuditor: isFieldAuditor(session),
      isAuditee: isAuditee(session),
      isDirector: isDirector(session),
      isExecutive: isExecutive(session),

      // Computed visibility maps
      nav: getNavVisibility(session),
      dashboard: getDashboardVisibility(session),
      analyticsScope: getAnalyticsScope(session),

      // Can this user create/edit audit content?
      canWriteAudit:
        userHasPermission(session, 'engagement:create')
        || userHasPermission(session, 'engagement:update')
        || userHasPermission(session, 'plan:create')
        || userHasPermission(session, 'working_paper:create'),
      canDeleteAudit:
        userHasPermission(session, 'engagement:delete')
        || userHasPermission(session, 'plan:add_item')
        || userHasPermission(session, 'universe:delete'),
      canWriteFindings:
        userHasPermission(session, 'finding:create')
        || userHasPermission(session, 'finding:update')
        || userHasPermission(session, 'finding:close'),
      canWriteDocuments: userHasPermission(session, 'document:write'),
      canManageUsers:
        userHasPermission(session, 'user:create')
        || userHasPermission(session, 'user:update')
        || userHasPermission(session, 'user:admin'),
      canDeactivateUsers: userHasPermission(session, 'user:deactivate'),
      canDeleteUsers: userHasPermission(session, 'user:delete'),
      canReadUsers: userHasPermission(session, 'user:read'),
      canReadAssets: userHasPermission(session, 'asset:read'),
      canCreateAssets: userHasPermission(session, 'asset:create'),
      canUpdateAssets: userHasPermission(session, 'asset:update'),
      canDeleteAssets: userHasPermission(session, 'asset:delete'),
      canAdminAssets: userHasPermission(session, 'asset:admin'),
      canAttestAssets: userHasPermission(session, 'asset:attest'),
      canLinkAssets: userHasPermission(session, 'asset:link'),
      canExportAssets: userHasPermission(session, 'asset:export'),
    }),
    [session],
  );
};
