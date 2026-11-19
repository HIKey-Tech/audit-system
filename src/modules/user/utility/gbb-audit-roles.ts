// src/modules/user/utility/gbb-audit-roles.ts
//
// GBB Internal Audit — the five client roles and the exact permissions each holds.
//
// This is DATA plus pure helpers. It is the single source of truth for the
// seed script (scripts/seed-gbb-audit-roles.ts), the generated permission map
// (docs/GBB_ROLE_PERMISSION_MAP.md) and the invariant tests, so they cannot drift.
//
// WHY THESE SETS LOOK THE WAY THEY DO (each point is enforced by a test):
//
//  • The team is tiny (1 Head + 6 auditors + the DG), so any auditor can be the
//    LEAD on one audit and the ENGAGEMENT MANAGER on the next. Every auditor role
//    therefore carries the full lead AND manager capability set. Per-audit
//    segregation is enforced at run time (lead ≠ manager ≠ auditee, submitter
//    can't approve, one person can't sign two levels of a chain).
//
//  • A report needs THREE DIFFERENT signers: engagement manager (an auditor) →
//    Head of Internal Audit (`report:approve:oversight`, also issues) → DG
//    (`report:approve:final`, optional per report via `cae_only`). So the Head
//    and the DG must never be eligible to be lead/manager, and no one may hold
//    both oversight and final. A boot-time sync (syncLifecycleNotificationPermission)
//    also rewrites any role that holds `report:issue` / oversight, so the Head
//    holds issue+oversight (never final) and the DG holds final only.
//
//  • Planning: auditors DRAFT (create/submit) plans and engagements. A programme
//    then needs TWO signers in order: the Head of Internal Audit (`plan:approve`)
//    and the DG for final approval (`plan:approve:final`). Neither holds
//    `plan:create`, and the DG does not hold `plan:approve`, so the DG cannot sign
//    the Head's level and the order is enforced.
//
//  • Visibility: `*:read_all` is granted to every auditor. Without it the shared
//    risk register is empty for everyone but the risk's owner, an engagement
//    manager can't see findings on their own engagement, and the creator of an
//    engagement can't open it. With six auditors in one department this is correct.
// NOTE: this file has no imports on purpose — it is pure data + pure functions, so it
// cannot affect the running application. Only the seed script and the tests use it.

/** Prefix on the description of every role this script creates — it is how a re-run recognises its own roles. */
export const GBB_ROLE_MARKER = '[GBB-IA]';

export type GbbRoleKey =
  | 'head_internal_audit'
  | 'financial_auditor'
  | 'compliance_auditor'
  | 'system_auditor'
  | 'dg';

export interface GbbRoleSpec {
  key: GbbRoleKey;
  /** The role name stored in the DB (and used by the escalation matrix). */
  name: string;
  /** `create` makes a new role; `override` replaces the permissions of an existing one. */
  mode: 'create' | 'override';
  /** `override` only: names (any case/spacing) that identify the existing role. */
  legacyNames?: readonly string[];
  title: string;
  description: string;
  permissions: readonly string[];
}

const uniq = (...lists: ReadonlyArray<readonly string[]>): string[] => [...new Set(lists.flat())];

// ─────────────────────────────────────────────────────────────────────────────
// Auditor core — identical for the Financial, Compliance and System auditors.
// ─────────────────────────────────────────────────────────────────────────────
export const AUDITOR_CORE: readonly string[] = [
  // Planning (draft; the Head approves)
  'universe:read', 'universe:create', 'universe:update',
  'plan:read', 'plan:create', 'plan:update', 'plan:add_item', 'plan:submit',
  // Engagements — create/assign/run. An auditor sees only the audits they are part of (lead, manager, team, or the one
  // they created); only the Head of Internal Audit (and the DG) read every engagement and are told about every one.
  'engagement:read', 'engagement:create', 'engagement:update',
  'checklist:read', 'checklist:create', 'checklist:update',
  // Working papers — author AND review (lead one audit, manage the next)
  'working_paper:read', 'working_paper:create', 'working_paper:update', 'working_paper:submit',
  'working_paper:approve', 'working_paper:reject',
  // Evidence
  'evidence:read', 'evidence:upload', 'evidence:dispute', 'evidence:request',
  // Findings & follow-up
  'finding:read', 'finding:read_all', 'finding:create', 'finding:update', 'finding:close', 'finding:export',
  'followup:read', 'followup:verify',
  // Reports — author, submit, and level-1 (engagement manager) approval. NOT issue / oversight / final.
  'report:read', 'report:create', 'report:update', 'report:submit', 'report:approve', 'report:reject', 'report:export',
  // Control Library (every auditor adds Acts, frameworks and controls for their audits) & risk register (shared)
  'control:read', 'control:manage',
  'risk:read', 'risk:read_all', 'risk:create', 'risk:update', 'risk:assess', 'risk:export',
  'risk_category:read', 'risk_category:write',
  'risk_monitoring:read',
  // Assets (every auditor maintains the registry), integrations, analytics
  'asset:read', 'asset:create', 'asset:update', 'asset:import', 'asset:link', 'asset:attest', 'asset:export',
  'integration:read',
  'imoc:read', 'imoc:link', 'imoc:capture', 'imoc:export',
  'projectplus:read', 'projectplus:link',
  'predictive:read',
  // System-audit toolkit — everyone can read/run/review; admin & manage are System Auditor only
  'sysaudit:read', 'sysaudit:run', 'sysaudit:review',
  'sectest:read',
  'sysdoc:read',
  // Workflow — act on approvals (as manager), assign staff, escalations, requests
  'approval:read', 'approval:approve', 'approval:reject',
  'assignment:read', 'assignment:create', 'assignment:delete',
  'escalation:read', 'escalation:acknowledge', 'escalation_policy:read',
  'request:create', 'request:read', 'request:receive', 'request:act',
  // Directory, documents, home, notifications, audit trail
  'user:read', 'user:directory', 'role:read', 'permission:read',
  'document:read', 'document:write', 'document_template:read',
  'dashboard:read',
  'notification:read', 'notification:update',
  'log:read', 'log:export',
];

/** System Auditor only: baselines, security-test coordination, system documentation, IMOC operations, asset registry administration. */
const SYSTEM_AUDITOR_EXTRA: readonly string[] = [
  'sysaudit:admin',
  'sectest:manage',
  'sysdoc:manage',
  'imoc:sync', 'imoc:rules', 'imoc:ingest',
  'asset:admin',
];

/** Compliance Auditor: nothing beyond the shared core (the Control Library is maintained by every auditor). */
const COMPLIANCE_AUDITOR_EXTRA: readonly string[] = [];

// ─────────────────────────────────────────────────────────────────────────────
// Head of Internal Audit — the overseer of the whole system: approvals, oversight, issue, configuration and full
// user and role administration. He holds every permission in the catalogue EXCEPT the ones listed in
// HEAD_NOT_HELD below, each excluded for a concrete reason:
//   • the "maker" half of something he approves (programmes, reports, working papers, finding closure), so a
//     programme or report he wrote could not be approved by anyone else; and
//   • working_paper:create / the manager approval set, which would make him eligible to be named lead auditor or
//     engagement manager (a manager cannot also sign the oversight level);
//   • the auditee-only response actions.
// The interface hides those buttons for him; every other button he can see is one he is allowed to use.
// ─────────────────────────────────────────────────────────────────────────────
const HEAD_INTERNAL_AUDIT: readonly string[] = [
  'universe:read', 'universe:create', 'universe:update', 'universe:delete',
  'plan:read', 'plan:approve', 'plan:reject',
  'engagement:read', 'engagement:read_all', 'engagement:create', 'engagement:update', 'engagement:delete',
  'engagement:notify_lifecycle',
  'checklist:read',
  'working_paper:read',
  'evidence:read', 'evidence:dispute',
  'finding:read', 'finding:read_all', 'finding:update', 'finding:export',
  'followup:read',
  'report:read', 'report:export', 'report:reject', 'report:issue', 'report:approve:oversight',
  'control:read', 'control:manage',
  'risk:read', 'risk:read_all', 'risk:create', 'risk:update', 'risk:assess', 'risk:delete', 'risk:export',
  'risk_category:read', 'risk_category:write', 'risk_category:delete',
  'risk_monitoring:read',
  'asset:read', 'asset:create', 'asset:update', 'asset:delete', 'asset:admin', 'asset:import', 'asset:link', 'asset:export',
  'integration:read',
  'imoc:read', 'imoc:link', 'imoc:capture', 'imoc:sync', 'imoc:rules', 'imoc:ingest', 'imoc:export',
  'projectplus:read', 'projectplus:link',
  'predictive:read',
  'sysaudit:read', 'sysaudit:review', 'sysaudit:admin',
  'sectest:read', 'sectest:authorise',
  'sysdoc:read', 'sysdoc:manage',
  'approval:read', 'approval:approve', 'approval:reject', 'approval:cancel',
  'assignment:read', 'assignment:create', 'assignment:delete',
  'escalation:read', 'escalation:acknowledge', 'escalation_policy:read', 'escalation_policy:update',
  'request:create', 'request:read', 'request:receive', 'request:act', 'request:admin',
  'user:read', 'user:directory', 'user:update', 'role:read', 'permission:read',
  'document:read', 'document:write', 'document_template:read',
  'dashboard:read', 'committee_pack:read',
  'notification:read', 'notification:update', 'notification_template:read',
  'log:read', 'log:summary', 'log:export',
  'job:read',
  'settings:read', 'settings:manage', 'report_template:manage',
  // Full user and role administration (assign or change a person's role, create, deactivate, reset 2FA)
  'user:create', 'user:deactivate', 'user:delete', 'user:reset_2fa', 'user:admin',
  'role:create', 'role:update', 'role:delete', 'role:assign',
  // Administration of templates, notifications, background jobs and documents
  'document_template:write', 'document_template:delete',
  'notification_template:write', 'notification_template:delete', 'notification_queue:read',
  'job:admin', 'document:delete',
  // Fieldwork he may step into or direct without conflicting with an approval he gives
  'checklist:create', 'checklist:update',
  'evidence:request', 'evidence:upload',
  'finding:create', 'followup:verify',
  'asset:attest',
  'auth:logout', 'auth:logout_all',
];

/**
 * The only permissions in the catalogue the Head of Internal Audit does not hold, and why (see the note above).
 * The tests check that he holds everything else, so a permission added to the system later cannot silently
 * leave him unable to use a new screen.
 */
export const HEAD_NOT_HELD: readonly string[] = [
  'plan:create', 'plan:add_item', 'plan:update', 'plan:submit',
  'report:create', 'report:update', 'report:submit', 'report:approve',
  'working_paper:create', 'working_paper:update', 'working_paper:submit', 'working_paper:approve', 'working_paper:reject',
  'finding:close',
  'followup:respond', 'followup:evidence',
  // He authorises security tests and reviews analyses; coordinating or running them is the maker side.
  'sectest:manage', 'sysaudit:run',
  // The final approval level of a programme and of a report is the DG's; the Head signs the oversight level, and
  // no one may sign two levels of the same chain.
  'plan:approve:final', 'report:approve:final',
];

// ─────────────────────────────────────────────────────────────────────────────
// Director General — final sign-off on the reports routed to them and on audit
// programmes (after the Head). Final ONLY (never oversight). The DG never does an audit and is not told about
// audits as they happen: the one thing they get is the notice that a report (or programme) needs their approval.
// They open an engagement only through that approval, so they hold neither engagement:read_all nor the lifecycle notices.
// ─────────────────────────────────────────────────────────────────────────────
const DG: readonly string[] = [
  'report:read', 'report:export', 'report:approve:final',
  'approval:read', 'approval:approve', 'approval:reject',
  'plan:read', 'plan:approve:final', 'plan:reject',
  'universe:read',
  'engagement:read',
  'checklist:read', 'working_paper:read', 'evidence:read', 'assignment:read',
  'finding:read', 'finding:export',
  'followup:read',
  'committee_pack:read',
  'risk:read', 'risk:read_all', 'risk:export', 'risk_monitoring:read',
  'asset:read', 'asset:export',
  'integration:read', 'predictive:read',
  'sysaudit:read', 'sysdoc:read', 'sectest:read', 'sectest:authorise',
  'request:create', 'request:read', 'request:receive', 'request:act',
  'escalation:read', 'escalation:acknowledge',
  'dashboard:read',
  'document:read',
  'user:directory',
  // Read-wide, so no page the DG opens shows an access error
  'control:read', 'risk_category:read', 'imoc:read', 'imoc:export', 'projectplus:read',
  'user:read', 'role:read', 'permission:read', 'document_template:read', 'escalation_policy:read',
  'notification:read', 'notification:update',
  'log:read', 'log:export',
];

export const GBB_ROLES: readonly GbbRoleSpec[] = [
  {
    key: 'head_internal_audit',
    name: 'head_internal_audit',
    mode: 'create',
    title: 'Head, Internal Audit',
    description:
      'Head of Internal Audit — approves audit programmes, level-2 oversight sign-off and issues audit reports, oversight of every engagement, risk, assets and configuration, and full user and role administration. Not assignable as lead or engagement manager.',
    permissions: uniq(HEAD_INTERNAL_AUDIT),
  },
  {
    key: 'financial_auditor',
    name: 'financial_auditor',
    mode: 'create',
    title: 'Financial Auditor',
    description:
      'Financial auditor — plans, runs fieldwork, raises findings and drafts reports; can lead an audit or act as its engagement manager.',
    permissions: uniq(AUDITOR_CORE),
  },
  {
    key: 'compliance_auditor',
    name: 'compliance_auditor',
    mode: 'create',
    title: 'Compliance Auditor',
    description:
      'Compliance auditor — everything a financial auditor can do, plus ownership of the compliance frameworks and control library.',
    permissions: uniq(AUDITOR_CORE, COMPLIANCE_AUDITOR_EXTRA),
  },
  {
    key: 'system_auditor',
    name: 'system_auditor',
    mode: 'override',
    legacyNames: ['system_auditor', 'systems_auditor', 'system auditor'],
    title: 'System Auditor',
    description:
      'System/IT auditor — everything a financial auditor can do, plus system-audit baselines, security-test coordination, system documentation, IMOC operations and asset registry upkeep.',
    permissions: uniq(AUDITOR_CORE, SYSTEM_AUDITOR_EXTRA),
  },
  {
    key: 'dg',
    name: 'dg',
    mode: 'create',
    title: 'Director General',
    description:
      'Director General — final sign-off on audit reports routed to them, read-wide oversight, back-up plan approval and security-test authorisation.',
    permissions: uniq(DG),
  },
];

/** Escalation recipients are resolved by role NAME, so they must name the roles above. */
export const GBB_ESCALATION_MATRIX = {
  auditEngagement: { level3: ['head_internal_audit'], beyond: ['dg'] },
  workflowApproval: { level3: ['head_internal_audit'], level4: ['dg'], otherwise: ['head_internal_audit'] },
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// Pure planner — decides what the seed script would do, with no database access.
// ─────────────────────────────────────────────────────────────────────────────
export const normaliseRoleName = (name: string): string =>
  name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');

export interface PlannerRoleState {
  id: string;
  name: string;
  description: string | null;
  isSystem: boolean;
  permissionSlugs: readonly string[];
  holderCount: number;
}

export interface PlannerState {
  /** Slugs that already exist in the live `permissions` table. */
  existingPermissionSlugs: ReadonlySet<string>;
  roles: readonly PlannerRoleState[];
}

export interface PlannedRole {
  spec: GbbRoleSpec;
  action: 'create' | 'update' | 'unchanged';
  existing?: PlannerRoleState;
  /** Override only: the existing role is renamed to this exact name (e.g. "System Auditor" → "system_auditor"). */
  rename?: string;
  add: string[];
  remove: string[];
}

export interface GbbPlan {
  ok: boolean;
  conflicts: string[];
  roles: PlannedRole[];
  /** Catalogue permissions the live DB is missing and the script must create first. */
  permissionsToCreate: string[];
}

export interface PlanOptions {
  /** Exact name of the existing System Auditor role, when auto-detection is ambiguous. */
  systemAuditorRoleName?: string;
}

export const planGbbRoleChanges = (
  state: PlannerState,
  catalogueSlugs: ReadonlySet<string>,
  specs: readonly GbbRoleSpec[] = GBB_ROLES,
  options: PlanOptions = {},
): GbbPlan => {
  const conflicts: string[] = [];
  const planned: PlannedRole[] = [];
  const toCreate = new Set<string>();
  const claimed = new Set<string>(); // role ids already assigned to a spec

  for (const spec of specs) {
    const unknown = spec.permissions.filter((slug) => !catalogueSlugs.has(slug));
    if (unknown.length > 0) {
      conflicts.push(`"${spec.name}" lists permissions that are not in the permission catalogue: ${unknown.join(', ')}`);
      continue;
    }
    for (const slug of spec.permissions) {
      if (!state.existingPermissionSlugs.has(slug)) toCreate.add(slug);
    }

    let existing: PlannerRoleState | undefined;

    if (spec.mode === 'override') {
      const wanted = options.systemAuditorRoleName?.trim().toLowerCase();
      const legacy = new Set((spec.legacyNames ?? [spec.name]).map(normaliseRoleName));
      const candidates = state.roles.filter((r) =>
        wanted ? r.name.toLowerCase() === wanted : legacy.has(normaliseRoleName(r.name)),
      );
      if (wanted && candidates.length === 0) {
        conflicts.push(`No role named "${options.systemAuditorRoleName}" exists, so it cannot be overridden.`);
        continue;
      }
      if (candidates.length > 1) {
        conflicts.push(
          `More than one role looks like the System Auditor (${candidates.map((c) => `"${c.name}"`).join(', ')}). ` +
            'Re-run with --system-auditor-role="<exact name>" to say which one to override.',
        );
        continue;
      }
      existing = candidates[0];
      if (existing && (existing.isSystem || normaliseRoleName(existing.name) === 'super_admin')) {
        conflicts.push(`"${existing.name}" is a system role and will not be overridden.`);
        continue;
      }
    } else {
      existing = state.roles.find((r) => r.name.toLowerCase() === spec.name.toLowerCase());
      if (existing && !(existing.description ?? '').startsWith(GBB_ROLE_MARKER)) {
        conflicts.push(
          `A role named "${existing.name}" already exists and was not created by this script, so it will not be touched. ` +
            `Rename it first, or choose a different name for the new "${spec.title}" role.`,
        );
        continue;
      }
    }

    if (existing && claimed.has(existing.id)) {
      conflicts.push(`"${existing.name}" matches more than one of the roles being set up.`);
      continue;
    }
    if (existing) claimed.add(existing.id);

    // The override keeps the role's members but gives it the standard snake_case name.
    let rename: string | undefined;
    if (existing && spec.mode === 'override' && existing.name !== spec.name) {
      const clash = state.roles.find((r) => r.id !== existing!.id && r.name.toLowerCase() === spec.name.toLowerCase());
      if (clash) {
        conflicts.push(
          `"${existing.name}" would be renamed to "${spec.name}", but a different role named "${clash.name}" already exists. ` +
            'Resolve the duplicate first.',
        );
        continue;
      }
      rename = spec.name;
    }

    if (!existing) {
      planned.push({ spec, action: 'create', add: [...spec.permissions], remove: [] });
      continue;
    }

    const have = new Set(existing.permissionSlugs);
    const want = new Set(spec.permissions);
    const add = [...want].filter((s) => !have.has(s));
    const remove = [...have].filter((s) => !want.has(s));
    planned.push({
      spec,
      existing,
      rename,
      action: add.length === 0 && remove.length === 0 && !rename ? 'unchanged' : 'update',
      add,
      remove,
    });
  }

  return { ok: conflicts.length === 0, conflicts, roles: planned, permissionsToCreate: [...toCreate].sort() };
};

// ─────────────────────────────────────────────────────────────────────────────
// Team readiness — run AFTER emails are attached to roles. Pure; the script feeds it live data.
// ─────────────────────────────────────────────────────────────────────────────
export interface TeamMember {
  email: string;
  isSuperAdmin: boolean;
  /** Names of every active role the person holds (GBB roles and any others). */
  roles: readonly string[];
  /** Union of the permissions of every active role. */
  permissions: ReadonlySet<string>;
}

export interface ReadinessFinding {
  level: 'error' | 'warn';
  message: string;
}

const MANAGER_PERMS = ['working_paper:approve', 'report:approve', 'finding:close'] as const;
const LEAD_PERMS = ['working_paper:create'] as const;
const holdsAll = (m: TeamMember, perms: readonly string[]): boolean => perms.every((p) => m.permissions.has(p));

export const checkTeamReadiness = (members: readonly TeamMember[]): ReadinessFinding[] => {
  const out: ReadinessFinding[] = [];
  const err = (message: string): void => { out.push({ level: 'error', message }); };
  const warn = (message: string): void => { out.push({ level: 'warn', message }); };

  const withRole = (key: GbbRoleKey): TeamMember[] => members.filter((m) => m.roles.includes(key));
  const heads = withRole('head_internal_audit');
  const dgs = withRole('dg');
  const auditors = [
    ...withRole('financial_auditor'),
    ...withRole('compliance_auditor'),
    ...withRole('system_auditor'),
  ];

  if (heads.length === 0) err('Nobody holds head_internal_audit — reports cannot be issued and plans cannot be approved.');
  if (heads.length > 1) warn(`${heads.length} people hold head_internal_audit; expected exactly one.`);
  if (dgs.length === 0) warn('Nobody holds dg — reports routed to the DG (cae_and_dg) will stall at the final level. Use "cae_only" until the DG account is assigned.');

  for (const h of heads) {
    const conflicts = [...MANAGER_PERMS, ...LEAD_PERMS, 'plan:create', 'report:create'].filter((p) => h.permissions.has(p));
    if (conflicts.length > 0) {
      err(
        `${h.email} (Head of Internal Audit) also holds ${conflicts.join(', ')} — most likely from another role. ` +
          'They could be picked as lead/manager and then be unable to sign the oversight level. Remove the extra role.',
      );
    }
    if (h.permissions.has('report:approve:final')) {
      err(`${h.email} holds BOTH oversight and final report sign-off. Remove the extra role.`);
    }
  }
  for (const d of dgs) {
    const conflicts = [...MANAGER_PERMS, ...LEAD_PERMS, 'report:approve:oversight', 'report:issue', 'report:create'].filter((p) =>
      d.permissions.has(p),
    );
    if (conflicts.length > 0) {
      err(`${d.email} (DG) also holds ${conflicts.join(', ')} — most likely from another role. Remove the extra role.`);
    }
  }
  for (const a of auditors) {
    const leaked = ['plan:approve', 'plan:approve:final', 'report:issue', 'report:approve:oversight', 'report:approve:final', 'settings:manage'].filter((p) =>
      a.permissions.has(p),
    );
    if (leaked.length > 0) {
      err(`${a.email} (auditor) also holds ${leaked.join(', ')} — most likely from a generic role such as cae/audit_manager/director. Remove it.`);
    }
  }
  for (const m of members) {
    if (m.permissions.has('report:approve:oversight') && m.permissions.has('report:approve:final')) {
      err(`${m.email} holds both oversight and final report sign-off; one person can only sign one level.`);
    }
    if (m.isSuperAdmin) {
      warn(`${m.email} is a super admin, so they can never be lead auditor or engagement manager.`);
    }
  }

  const managers = members.filter((m) => !m.isSuperAdmin && holdsAll(m, MANAGER_PERMS));
  const leads = members.filter((m) => !m.isSuperAdmin && holdsAll(m, LEAD_PERMS));
  if (managers.length < 2) err(`Only ${managers.length} person(s) can be an engagement manager; at least 2 are needed (a manager's own submissions need a second approver).`);
  if (leads.length < 2) err(`Only ${leads.length} person(s) can be a lead auditor; at least 2 are needed.`);
  if (new Set([...managers, ...leads].map((m) => m.email)).size < 3) {
    err('Fewer than 3 people can staff an audit (lead + manager + supporting auditor).');
  }

  const holders = (perm: string): TeamMember[] => members.filter((m) => m.permissions.has(perm));
  if (holders('report:approve:oversight').length === 0) err('No active user holds report:approve:oversight — every report would stall at level 2.');
  if (holders('report:issue').length === 0) err('No active user holds report:issue — approved reports could never be issued.');
  if (holders('plan:approve').length === 0) err('No active user holds plan:approve — every programme would stall at level 1 (Head of Internal Audit).');
  if (holders('plan:approve:final').length === 0) warn('No active user holds plan:approve:final yet — programmes will stall at the final (DG) level until the DG has an account.');
  return out;
};

/**
 * Helper for the seed script to turn a DB user into a TeamMember. `key` is set
 * for the five GBB roles (including an overridden System Auditor whose live name
 * may differ, e.g. "System Auditor"); other roles are identified by their name.
 */
export const toTeamMember = (u: {
  email: string;
  isSuperAdmin: boolean;
  roles: ReadonlyArray<{ name: string; key?: GbbRoleKey; permissionSlugs: readonly string[] }>;
}): TeamMember => ({
  email: u.email,
  isSuperAdmin: u.isSuperAdmin,
  roles: u.roles.map((r) => r.key ?? r.name),
  permissions: new Set(u.roles.flatMap((r) => r.permissionSlugs)),
});

/**
 * Permissions the `auditee` role must hold for auditees to see their engagement,
 * respond to findings and upload evidence. Mirrors ensureAuditeeRolePermissions()
 * in audit/utility/auditee-role.utility.ts. The seed script only ever ADDS these
 * to the auditee role if one is missing — it never removes anything from it.
 */
export const AUDITEE_REQUIRED_PERMISSIONS: readonly string[] = [
  // See their audit and respond to it
  'engagement:read',
  'finding:read',
  'followup:read',
  'followup:respond',
  'followup:evidence',
  'evidence:upload',
  'document:read',
  'document:write',
  // Open their pages without access errors: the home page, the notification bell and the Requests page
  'dashboard:read',
  'notification:read',
  'notification:update',
  'request:read',
  'request:create',
  'request:receive',
  'request:act',
];
