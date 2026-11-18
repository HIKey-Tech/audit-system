import fs from 'fs';
import path from 'path';
import { IAMS_SOD_RULES } from '../../system-audit/utility/analyzers/access-listing.analyzer';
import {
  AUDITEE_REQUIRED_PERMISSIONS,
  AUDITOR_CORE,
  GBB_ESCALATION_MATRIX,
  GBB_ROLES,
  GBB_ROLE_MARKER,
  GbbRoleKey,
  GbbRoleSpec,
  PlannerRoleState,
  TeamMember,
  checkTeamReadiness,
  normaliseRoleName,
  planGbbRoleChanges,
} from '../utility/gbb-audit-roles';

// The permission catalogue, read straight from the seed source so this test needs no DB/env.
const seedSource = fs.readFileSync(path.resolve(__dirname, '../../../../prisma/seed.ts'), 'utf8');
const CATALOGUE = new Set(
  // Descriptions may be single- or double-quoted (e.g. "Reset a user's two-factor…").
  [...seedSource.matchAll(/^  permission\('([^']+)',\s*(?:'[^']*'|"[^"]*"),\s*'[^']*'\)/gm)].map((m) => m[1]),
);

const role = (key: GbbRoleKey): GbbRoleSpec => GBB_ROLES.find((r) => r.key === key)!;
const perms = (key: GbbRoleKey): Set<string> => new Set(role(key).permissions);
const AUDITORS: GbbRoleKey[] = ['financial_auditor', 'compliance_auditor', 'system_auditor'];
const holders = (slug: string): GbbRoleKey[] => GBB_ROLES.filter((r) => r.permissions.includes(slug)).map((r) => r.key);

describe('GBB role definitions — basic integrity', () => {
  it('has exactly the five client roles', () => {
    expect(GBB_ROLES.map((r) => r.key).sort()).toEqual(
      ['compliance_auditor', 'dg', 'financial_auditor', 'head_internal_audit', 'system_auditor'],
    );
  });

  it('every permission exists in the catalogue (a typo would be silently dropped in the app)', () => {
    expect(CATALOGUE.size).toBeGreaterThan(100); // the regex found the catalogue
    for (const r of GBB_ROLES) {
      const unknown = r.permissions.filter((p) => !CATALOGUE.has(p));
      expect({ role: r.key, unknown }).toEqual({ role: r.key, unknown: [] });
    }
  });

  it('no role lists a permission twice, and none holds the wildcard', () => {
    for (const r of GBB_ROLES) {
      expect(new Set(r.permissions).size).toBe(r.permissions.length);
      expect(r.permissions).not.toContain('*');
    }
  });

  it('role names are unique and do not collide with the generic seeded roles', () => {
    const names = GBB_ROLES.map((r) => r.name.toLowerCase());
    expect(new Set(names).size).toBe(names.length);
    const generic = ['super_admin', 'audit_admin', 'audit_manager', 'audit_lead', 'auditor', 'auditee', 'director',
      'director_general', 'cae', 'audit_committee', 'viewer'];
    // system_auditor is the one deliberate override of a role the client already created.
    for (const r of GBB_ROLES.filter((x) => x.mode === 'create')) expect(generic).not.toContain(r.name);
    expect(role('system_auditor').mode).toBe('override');
  });

  it('the escalation matrix names roles that exist', () => {
    const names = new Set(GBB_ROLES.map((r) => r.name));
    const all = [
      ...GBB_ESCALATION_MATRIX.auditEngagement.level3, ...GBB_ESCALATION_MATRIX.auditEngagement.beyond,
      ...GBB_ESCALATION_MATRIX.workflowApproval.level3, ...GBB_ESCALATION_MATRIX.workflowApproval.level4,
      ...GBB_ESCALATION_MATRIX.workflowApproval.otherwise,
    ];
    for (const n of all) expect(names.has(n)).toBe(true);
  });
});

describe('report sign-off chain: manager → Head of IA → DG, three different people', () => {
  it('only the Head holds oversight and issue; only the DG holds final', () => {
    expect(holders('report:approve:oversight')).toEqual(['head_internal_audit']);
    expect(holders('report:issue')).toEqual(['head_internal_audit']);
    expect(holders('report:approve:final')).toEqual(['dg']);
  });

  it('no role holds both oversight and final (the boot-time sync would otherwise rewrite it)', () => {
    for (const r of GBB_ROLES) {
      expect(r.permissions.includes('report:approve:oversight') && r.permissions.includes('report:approve:final')).toBe(false);
    }
  });

  it('stays stable under the boot-time role sync (issue⇒oversight not final; oversight-without-issue/create⇒final)', () => {
    const head = perms('head_internal_audit');
    expect(head.has('report:issue') && head.has('report:approve:oversight') && !head.has('report:approve:final')).toBe(true);
    const dg = perms('dg');
    expect(dg.has('report:approve:final') && !dg.has('report:approve:oversight')).toBe(true);
    expect(['report:issue', 'report:create'].some((p) => dg.has(p))).toBe(false);
    for (const k of AUDITORS) {
      expect(['report:issue', 'report:approve:oversight', 'report:approve:final'].some((p) => perms(k).has(p))).toBe(false);
    }
  });

  it('every auditor can be the level-1 engagement manager AND a lead auditor', () => {
    for (const k of AUDITORS) {
      for (const p of ['working_paper:approve', 'report:approve', 'finding:close', 'working_paper:create']) {
        expect({ role: k, p, has: perms(k).has(p) }).toEqual({ role: k, p, has: true });
      }
    }
  });

  it('the Head and the DG can NEVER be picked as lead or manager (they would block their own level)', () => {
    for (const k of ['head_internal_audit', 'dg'] as GbbRoleKey[]) {
      for (const p of ['working_paper:create', 'working_paper:approve', 'report:approve', 'finding:close']) {
        expect(perms(k).has(p)).toBe(false);
      }
    }
  });

  it('everyone who approves holds the route-level approval permissions', () => {
    for (const k of [...AUDITORS, 'head_internal_audit', 'dg'] as GbbRoleKey[]) {
      for (const p of ['approval:read', 'approval:approve', 'approval:reject']) expect(perms(k).has(p)).toBe(true);
    }
  });
});

describe('planning: auditors draft, the Head approves, then the DG gives final approval', () => {
  it('plan:approve is the Head only and plan:approve:final the DG only, and neither can create plans', () => {
    expect(holders('plan:approve')).toEqual(['head_internal_audit']);
    expect(holders('plan:approve:final')).toEqual(['dg']);
    expect(perms('head_internal_audit').has('plan:create')).toBe(false);
    expect(perms('dg').has('plan:create')).toBe(false);
  });

  it('every auditor can draft, add to and submit a plan, and create the engagement from it', () => {
    for (const k of AUDITORS) {
      for (const p of ['plan:create', 'plan:update', 'plan:add_item', 'plan:submit', 'engagement:create', 'engagement:update']) {
        expect(perms(k).has(p)).toBe(true);
      }
      expect(perms(k).has('plan:approve:final')).toBe(false);
      expect(perms(k).has('plan:approve')).toBe(false); // keeps the UI treating them as field auditors
    }
  });

  it('the Head can also create and assign engagements (no missing button)', () => {
    for (const p of ['engagement:create', 'engagement:update', 'assignment:create', 'universe:create']) {
      expect(perms('head_internal_audit').has(p)).toBe(true);
    }
  });
});

describe('segregation of duties as the system’s own access review sees it', () => {
  const violated = (key: GbbRoleKey): string[] =>
    IAMS_SOD_RULES.filter((rule) => rule.sideA.some((p) => perms(key).has(p)) && rule.sideB.some((p) => perms(key).has(p))).map((r) => r.name);

  it('the Head of IA and the DG trip none of the rules', () => {
    expect(violated('head_internal_audit')).toEqual([]);
    expect(violated('dg')).toEqual([]);
  });

  it('auditors trip exactly the three create/approve pairs that rotating lead/manager requires — and nothing else', () => {
    for (const k of AUDITORS) {
      expect(violated(k).sort()).toEqual([
        'Generate and approve audit reports',
        'Prepare and approve working papers',
        'Raise and close findings',
      ]);
    }
  });
});

describe('what auditors must NOT be able to do', () => {
  const forbidden = [
    'plan:approve', 'plan:approve:final', 'plan:reject', 'report:issue', 'report:approve:oversight', 'report:approve:final',
    'approval:cancel', // cancels ANY pending approval, with no ownership check
    'settings:manage', 'report_template:manage',
    'user:create', 'user:update', 'user:delete', 'user:deactivate', 'user:admin',
    'role:create', 'role:update', 'role:delete', 'role:assign',
    'job:admin', 'notification_template:write', 'notification_template:delete', 'notification_queue:read',
    'document:delete', 'universe:delete', 'engagement:delete', 'risk:delete', 'asset:delete',
    'committee_pack:read', 'sectest:authorise', 'escalation_policy:update', 'request:admin',
  ];
  it.each(AUDITORS)('%s holds none of the high-level or destructive permissions', (k) => {
    expect(forbidden.filter((p) => perms(k).has(p))).toEqual([]);
  });

  it('nobody but a super admin gets platform administration', () => {
    const platform = ['user:create', 'user:delete', 'user:deactivate', 'user:admin', 'role:create', 'role:update',
      'role:delete', 'role:assign', 'job:admin', 'notification_template:write', 'notification_template:delete',
      'document:delete', 'auth:logout_all'];
    for (const r of GBB_ROLES) expect(platform.filter((p) => r.permissions.includes(p))).toEqual([]);
  });
});

describe('every auditor gets everything meant for an auditor (no "can’t click")', () => {
  it('all three auditor roles contain the whole shared core', () => {
    for (const k of AUDITORS) {
      expect(AUDITOR_CORE.filter((p) => !perms(k).has(p))).toEqual([]);
    }
  });

  it('visibility is department-wide: engagements, findings and the risk register', () => {
    for (const k of AUDITORS) {
      for (const p of ['engagement:read_all', 'finding:read_all', 'risk:read_all']) expect(perms(k).has(p)).toBe(true);
    }
  });

  it('domain extras go only where intended', () => {
    expect(holders('control:manage').sort()).toEqual(['compliance_auditor', 'head_internal_audit']);
    // (sectest:manage is deliberately System Auditor only — see the segregation test below.)
    for (const p of ['sysaudit:admin', 'sysdoc:manage', 'imoc:sync', 'imoc:rules', 'imoc:ingest', 'asset:admin', 'asset:import']) {
      expect(holders(p).sort()).toEqual(['head_internal_audit', 'system_auditor'].sort());
    }
    expect(perms('financial_auditor').size).toBe(AUDITOR_CORE.length);
  });

  it('a security test can be coordinated by an auditor and authorised by someone else', () => {
    expect(holders('sectest:manage')).toEqual(['system_auditor']);
    expect(holders('sectest:authorise').sort()).toEqual(['dg', 'head_internal_audit']);
  });

  it('every menu an auditor should see is unlocked', () => {
    const nav = ['dashboard:read', 'asset:read', 'universe:read', 'plan:read', 'engagement:read', 'finding:read', 'report:read',
      'risk:read', 'approval:read', 'assignment:read', 'request:read', 'document:read', 'integration:read', 'predictive:read',
      'sysaudit:read', 'sectest:read', 'sysdoc:read', 'user:read', 'log:read', 'escalation_policy:read', 'evidence:read',
      'checklist:read', 'working_paper:read', 'followup:read', 'control:read', 'notification:read'];
    for (const k of AUDITORS) expect(nav.filter((p) => !perms(k).has(p))).toEqual([]);
  });

  it('the Head sees every menu including settings, escalation policies, logs and the committee pack', () => {
    const nav = ['dashboard:read', 'asset:read', 'universe:read', 'plan:read', 'engagement:read', 'finding:read', 'report:read',
      'risk:read', 'approval:read', 'assignment:read', 'request:read', 'document:read', 'integration:read', 'predictive:read',
      'sysaudit:read', 'sectest:read', 'sysdoc:read', 'user:read', 'log:read', 'escalation_policy:read', 'settings:read',
      'committee_pack:read', 'job:read', 'log:summary'];
    expect(nav.filter((p) => !perms('head_internal_audit').has(p))).toEqual([]);
  });

  it('the DG can open any engagement and read everything a sign-off needs', () => {
    const need = ['engagement:read', 'engagement:read_all', 'finding:read', 'finding:read_all', 'report:read', 'report:export',
      'approval:read', 'approval:approve', 'approval:reject', 'dashboard:read', 'checklist:read', 'working_paper:read',
      'evidence:read', 'committee_pack:read', 'document:read'];
    expect(need.filter((p) => !perms('dg').has(p))).toEqual([]);
  });
});

describe('buttons never appear without the permission that backs them', () => {
  // The UI shows an action when the user holds the "create/update/…" permission; the backend
  // then also needs the matching read. Missing read ⇒ a button that opens to an error.
  const needsRead = (slug: string): string | null => {
    const [resource, action] = slug.split(':');
    const writes = ['create', 'update', 'delete', 'submit', 'approve', 'reject', 'close', 'assess', 'manage', 'admin',
      'write', 'upload', 'run', 'review', 'link', 'respond', 'verify', 'issue', 'sync', 'rules', 'ingest', 'capture',
      'attest', 'import', 'authorise', 'add_item', 'dispute', 'request', 'acknowledge', 'cancel', 'act', 'receive'];
    if (!writes.includes(action)) return null;
    const read = `${resource}:read`;
    return CATALOGUE.has(read) ? read : null;
  };

  it.each(GBB_ROLES.map((r) => r.key))('%s: every write permission comes with its read', (k) => {
    const missing = role(k).permissions
      .map((p) => [p, needsRead(p)] as const)
      .filter(([, read]) => read !== null && !perms(k).has(read!))
      .map(([p, read]) => `${p} needs ${read}`);
    expect(missing).toEqual([]);
  });

  it('anyone who can create plans can also run the whole planning chain the UI shows', () => {
    for (const k of GBB_ROLES.map((r) => r.key)) {
      if (!perms(k).has('plan:create')) continue;
      for (const p of ['plan:update', 'plan:add_item', 'plan:submit', 'engagement:create', 'universe:read']) {
        expect(perms(k).has(p)).toBe(true);
      }
    }
  });
});

describe('the auditee role cannot be hijacked by these roles', () => {
  it('no GBB role holds the follow-up response permissions that identify an auditee role', () => {
    // ensureAuditeeRoleAssigned() picks the first role with followup:respond + followup:evidence
    // and no working_paper:create. None of ours may ever match that profile.
    for (const r of GBB_ROLES) {
      expect(r.permissions).not.toContain('followup:respond');
      expect(r.permissions).not.toContain('followup:evidence');
    }
  });

  it('the permissions the auditee role must hold are real and sufficient for the documented auditee flow', () => {
    for (const p of AUDITEE_REQUIRED_PERMISSIONS) expect(CATALOGUE.has(p)).toBe(true);
    expect([...AUDITEE_REQUIRED_PERMISSIONS].sort()).toEqual([
      'document:read', 'document:write', 'engagement:read', 'evidence:upload',
      'finding:read', 'followup:evidence', 'followup:read', 'followup:respond',
    ]);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('planGbbRoleChanges', () => {
  const catalogue = CATALOGUE;
  const allSlugs = new Set([...catalogue]);
  const roleState = (over: Partial<PlannerRoleState> & { name: string }): PlannerRoleState => ({
    id: `id-${over.name}`, description: null, isSystem: false, permissionSlugs: [], holderCount: 0, ...over,
  });
  const fresh = (roles: PlannerRoleState[] = [], existing: ReadonlySet<string> = allSlugs) =>
    planGbbRoleChanges({ existingPermissionSlugs: existing, roles }, catalogue);

  it('on an empty server creates all five roles', () => {
    const plan = fresh();
    expect(plan.ok).toBe(true);
    expect(plan.roles.map((r) => r.action)).toEqual(['create', 'create', 'create', 'create', 'create']);
    expect(plan.roles.map((r) => r.spec.name).sort()).toEqual(
      ['compliance_auditor', 'dg', 'financial_auditor', 'head_internal_audit', 'system_auditor'],
    );
  });

  it('overrides the existing System Auditor (any spelling) and reports what it adds and removes', () => {
    for (const name of ['system_auditor', 'System Auditor', 'SYSTEM AUDITOR', 'systems_auditor']) {
      const existing = roleState({ name, permissionSlugs: ['engagement:read', 'finding:read', 'legacy:leftover'], holderCount: 2 });
      const plan = fresh([existing]);
      const sys = plan.roles.find((r) => r.spec.key === 'system_auditor')!;
      expect(sys.action).toBe('update');
      expect(sys.existing?.id).toBe(existing.id);
      expect(sys.remove).toEqual(['legacy:leftover']);
      expect(sys.add).toContain('sysaudit:admin');
      expect(sys.add).not.toContain('engagement:read'); // already held
      expect(plan.ok).toBe(true);
    }
  });

  it('refuses to guess when two roles both look like the System Auditor', () => {
    const plan = fresh([roleState({ name: 'system_auditor' }), roleState({ name: 'System Auditor' })]);
    expect(plan.ok).toBe(false);
    expect(plan.conflicts.join(' ')).toContain('--system-auditor-role');
    expect(plan.roles.find((r) => r.spec.key === 'system_auditor')).toBeUndefined();
  });

  it('--system-auditor-role picks which role to override, and fails clearly if the name is wrong', () => {
    const roles = [roleState({ name: 'system_auditor' }), roleState({ name: 'System Auditor' })];
    const exact = planGbbRoleChanges({ existingPermissionSlugs: allSlugs, roles }, catalogue, GBB_ROLES, { systemAuditorRoleName: 'system_auditor' });
    expect(exact.ok).toBe(true);
    expect(exact.roles.find((r) => r.spec.key === 'system_auditor')?.rename).toBeUndefined();
    const bad = planGbbRoleChanges({ existingPermissionSlugs: allSlugs, roles }, catalogue, GBB_ROLES, { systemAuditorRoleName: 'nope' });
    expect(bad.ok).toBe(false);
  });

  it('renames a differently spelled System Auditor to system_auditor, keeping its members', () => {
    for (const name of ['System Auditor', 'SYSTEM AUDITOR', 'systems_auditor', 'system auditor']) {
      const existing = roleState({ name, holderCount: 2 });
      const sys = fresh([existing]).roles.find((r) => r.spec.key === 'system_auditor')!;
      expect(sys.rename).toBe('system_auditor');
      expect(sys.existing?.id).toBe(existing.id);
      expect(sys.action).toBe('update');
    }
  });

  it('does not rename a role that already has the exact name, and a rename alone still counts as a change', () => {
    const exactName = roleState({ name: 'system_auditor', permissionSlugs: [...GBB_ROLES.find((r) => r.key === 'system_auditor')!.permissions] });
    const unchanged = fresh([exactName]).roles.find((r) => r.spec.key === 'system_auditor')!;
    expect(unchanged.rename).toBeUndefined();
    expect(unchanged.action).toBe('unchanged');
    const spaced = roleState({ name: 'System Auditor', permissionSlugs: [...GBB_ROLES.find((r) => r.key === 'system_auditor')!.permissions] });
    const renamedOnly = fresh([spaced]).roles.find((r) => r.spec.key === 'system_auditor')!;
    expect(renamedOnly.add).toEqual([]);
    expect(renamedOnly.remove).toEqual([]);
    expect(renamedOnly.action).toBe('update');
  });

  it('never touches a role it did not create, even on a name clash (case-insensitive)', () => {
    for (const name of ['dg', 'DG', 'financial_auditor']) {
      const plan = fresh([roleState({ name, description: 'somebody else’s role', permissionSlugs: ['x:y'] })]);
      expect(plan.ok).toBe(false);
      expect(plan.conflicts[0]).toContain('not created by this script');
      expect(plan.roles.some((r) => r.existing?.name === name)).toBe(false);
    }
  });

  it('is idempotent: a role it created earlier with the right permissions is left unchanged', () => {
    const roles = GBB_ROLES.filter((r) => r.mode === 'create').map((r) =>
      roleState({ name: r.name, description: `${GBB_ROLE_MARKER} ${r.description}`, permissionSlugs: [...r.permissions] }),
    );
    roles.push(roleState({ name: 'system_auditor', permissionSlugs: [...role('system_auditor').permissions] }));
    const plan = fresh(roles);
    expect(plan.ok).toBe(true);
    expect(plan.roles.map((r) => r.action)).toEqual(['unchanged', 'unchanged', 'unchanged', 'unchanged', 'unchanged']);
  });

  it('re-asserts one of its own roles if someone drifted its permissions', () => {
    const spec = role('dg');
    const drifted = roleState({
      name: 'dg', description: `${GBB_ROLE_MARKER} x`,
      permissionSlugs: [...spec.permissions.filter((p) => p !== 'report:approve:final'), 'user:delete'],
    });
    const dg = fresh([drifted]).roles.find((r) => r.spec.key === 'dg')!;
    expect(dg.action).toBe('update');
    expect(dg.add).toEqual(['report:approve:final']);
    expect(dg.remove).toEqual(['user:delete']);
  });

  it('never targets super_admin or any system role, however it is named', () => {
    const plan = fresh([
      roleState({ name: 'super_admin', isSystem: true }),
      roleState({ name: 'System Auditor', isSystem: true }),
    ]);
    expect(plan.ok).toBe(false);
    expect(plan.roles.every((r) => r.existing?.name !== 'super_admin')).toBe(true);
  });

  it('leaves every other role out of the plan entirely', () => {
    const others = ['super_admin', 'audit_manager', 'cae', 'director', 'director_general', 'auditee', 'viewer', 'auditor']
      .map((name) => roleState({ name, isSystem: name === 'super_admin' }));
    const plan = fresh(others);
    expect(plan.ok).toBe(true);
    expect(plan.roles.map((r) => r.existing?.name).filter(Boolean)).toEqual([]);
  });

  it('lists permissions the live database is missing so they can be created first', () => {
    const existing = new Set([...allSlugs].filter((s) => s !== 'committee_pack:read' && s !== 'imoc:rules'));
    const plan = fresh([], existing);
    expect(plan.permissionsToCreate).toEqual(['committee_pack:read', 'imoc:rules']);
  });

  it('flags a role that lists a permission outside the catalogue', () => {
    const bad: GbbRoleSpec = { ...role('dg'), name: 'dg2', permissions: ['report:approve:finale'] };
    const plan = planGbbRoleChanges({ existingPermissionSlugs: allSlugs, roles: [] }, catalogue, [bad]);
    expect(plan.ok).toBe(false);
  });

  it('normaliseRoleName handles spacing, case and punctuation', () => {
    expect(normaliseRoleName(' System  Auditor ')).toBe('system_auditor');
    expect(normaliseRoleName('SYSTEM-AUDITOR')).toBe('system_auditor');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('checkTeamReadiness (run after the emails are attached)', () => {
  const member = (email: string, keys: GbbRoleKey[], extra: string[] = [], isSuperAdmin = false): TeamMember => ({
    email, isSuperAdmin, roles: keys,
    permissions: new Set([...keys.flatMap((k) => [...role(k).permissions]), ...extra]),
  });
  // The client's actual team shape: 1 Head, 3 financial, 2 system, 1 compliance, + the DG.
  const team = (): TeamMember[] => [
    member('head', ['head_internal_audit']),
    member('fin1', ['financial_auditor']), member('fin2', ['financial_auditor']), member('fin3', ['financial_auditor']),
    member('sys1', ['system_auditor']), member('sys2', ['system_auditor']),
    member('comp', ['compliance_auditor']),
    member('dg', ['dg']),
  ];
  const errors = (m: TeamMember[]) => checkTeamReadiness(m).filter((f) => f.level === 'error').map((f) => f.message);

  it('the intended team passes with no errors and no warnings', () => {
    expect(checkTeamReadiness(team())).toEqual([]);
  });

  it('catches the Head still holding a generic manager-type role (would deadlock the oversight level)', () => {
    const t = team();
    t[0] = member('head', ['head_internal_audit'], ['working_paper:approve', 'report:approve', 'finding:close', 'working_paper:create']);
    expect(errors(t).join(' ')).toContain('head');
  });

  it('catches one person holding both oversight and final', () => {
    const t = team();
    t[7] = member('dg', ['dg'], ['report:approve:oversight']);
    expect(errors(t).join(' ')).toContain('both oversight and final');
  });

  it('catches an auditor who also holds a generic executive role', () => {
    const t = team();
    t[1] = member('fin1', ['financial_auditor'], ['plan:approve', 'report:issue']);
    expect(errors(t).join(' ')).toContain('fin1');
  });

  it('warns (not errors) while the DG has no account assigned yet', () => {
    const findings = checkTeamReadiness(team().filter((m) => m.email !== 'dg'));
    expect(findings.some((f) => f.level === 'error')).toBe(false);
    expect(findings.some((f) => f.level === 'warn' && f.message.includes('dg'))).toBe(true);
  });

  it('errors when there is no Head or too few people to staff an audit', () => {
    expect(errors(team().filter((m) => m.email !== 'head')).join(' ')).toContain('head_internal_audit');
    expect(errors([member('head', ['head_internal_audit']), member('fin1', ['financial_auditor'])]).join(' '))
      .toContain('engagement manager');
  });

  it('a super admin in the team is flagged but does not break anything', () => {
    const t = [...team(), member('dev', ['financial_auditor'], [], true)];
    expect(checkTeamReadiness(t).some((f) => f.level === 'warn' && f.message.includes('dev'))).toBe(true);
    expect(errors(t)).toEqual([]);
  });
});
