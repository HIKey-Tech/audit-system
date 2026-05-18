'use client';

import { useMemo } from 'react';
import { useSession, type SessionUser } from '@/components/providers/AuthProvider';

// ─────────────────────────────────────────────────────────────
// Role constants
// ─────────────────────────────────────────────────────────────
export type AppRole =
  | 'super_admin'
  | 'audit_admin'
  | 'audit_lead'
  | 'auditor'
  | 'director'
  | 'cae'
  | 'auditee'
  | 'viewer';

// ─────────────────────────────────────────────────────────────
// Permissions helper (pure functions — can be used outside React)
// ─────────────────────────────────────────────────────────────

/** Returns true if the user holds the exact role. */
export const userHasRole = (user: SessionUser | null, role: AppRole): boolean => {
  if (!user) return false;
  return user.roles.includes(role);
};

/** Returns true if the user holds ANY of the listed roles. */
export const userHasAnyRole = (user: SessionUser | null, roles: AppRole[]): boolean => {
  if (!user) return false;
  return roles.some((r) => user.roles.includes(r));
};

/** Returns true if the user has the specific permission string (super_admin always passes). */
export const userHasPermission = (user: SessionUser | null, permission: string): boolean => {
  if (!user) return false;
  if (user.roles.includes('super_admin')) return true;
  return user.permissions.includes(permission);
};

/** Convenience: is this user an admin-level role? (super_admin, audit_admin, cae) */
export const isAdminLevel = (user: SessionUser | null): boolean =>
  userHasAnyRole(user, ['super_admin', 'audit_admin', 'cae']);

/** Can this user manage the full audit programme (plans, universe, engagements creation)? */
export const canManageAuditProgramme = (user: SessionUser | null): boolean =>
  userHasAnyRole(user, ['super_admin', 'audit_admin']);

/** Is this user a fieldwork-level auditor? (audit_lead or auditor) */
export const isFieldAuditor = (user: SessionUser | null): boolean =>
  userHasAnyRole(user, ['audit_lead', 'auditor']);

/** Is this user an auditee? */
export const isAuditee = (user: SessionUser | null): boolean =>
  userHasRole(user, 'auditee');

/** Is this user a director? (read-only oversight) */
export const isDirector = (user: SessionUser | null): boolean =>
  userHasRole(user, 'director');

/** Is this user executive-level (director or cae)? */
export const isExecutive = (user: SessionUser | null): boolean =>
  userHasAnyRole(user, ['director', 'cae']);

// ─────────────────────────────────────────────────────────────
// Navigation visibility rules
// ─────────────────────────────────────────────────────────────
export interface NavVisibility {
  dashboard: boolean;
  auditUniverse: boolean;
  auditPlans: boolean;
  engagements: boolean;
  findings: boolean;
  reports: boolean;
  riskRegister: boolean;
  workflow: boolean;
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
      auditUniverse: false,
      auditPlans: false,
      engagements: false,
      findings: false,
      reports: false,
      riskRegister: false,
      workflow: false,
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
    auditUniverse: userHasPermission(user, 'universe:read'),
    auditPlans: userHasPermission(user, 'plan:read'),
    engagements: userHasPermission(user, 'engagement:read'),
    findings: userHasPermission(user, 'finding:read'),
    reports: userHasPermission(user, 'report:read'),
    riskRegister: userHasPermission(user, 'risk:read'),
    workflow: userHasPermission(user, 'approval:read') || userHasPermission(user, 'assignment:read'),
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

  const admin = canManageAuditProgramme(user);
  const exec = isExecutive(user);
  const caeRole = userHasRole(user, 'cae');
  const auditeeRole = isAuditee(user);
  const field = isFieldAuditor(user);

  return {
    // Org-wide stat cards: admin, exec, cae
    statCards: admin || exec || caeRole,

    // Recent activity: everyone (filtered)
    recentActivity: !auditeeRole,

    // Findings by severity: admin, exec, cae, field auditors
    findingsBySeverity: admin || exec || caeRole || field,

    // My Work: field auditors, auditors, and auditees — NOT director/exec overview
    myWork: field || auditeeRole,

    // Top risks: admin, exec, cae, audit_lead
    topRisks: admin || exec || caeRole || userHasRole(user, 'audit_lead'),

    // Escalations: admin, exec, cae
    escalations: admin || exec || caeRole,
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

      // Role checks
      hasRole: (role: AppRole) => userHasRole(session, role),
      hasAnyRole: (roles: AppRole[]) => userHasAnyRole(session, roles),
      hasPermission: (perm: string) => userHasPermission(session, perm),

      // Convenience booleans
      isSuperAdmin: session.roles.includes('super_admin'),
      isAuditAdmin: session.roles.includes('audit_admin'),
      isAdminLevel: isAdminLevel(session),
      canManageAuditProgramme: canManageAuditProgramme(session),
      isFieldAuditor: isFieldAuditor(session),
      isAuditLead: session.roles.includes('audit_lead'),
      isAuditor: session.roles.includes('auditor'),
      isAuditee: isAuditee(session),
      isDirector: isDirector(session),
      isExecutive: isExecutive(session),
      isCae: session.roles.includes('cae'),

      // Computed visibility maps
      nav: getNavVisibility(session),
      dashboard: getDashboardVisibility(session),

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
      canReadUsers: userHasPermission(session, 'user:read'),
    }),
    [session],
  );
};
