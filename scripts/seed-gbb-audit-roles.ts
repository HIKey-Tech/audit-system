// scripts/seed-gbb-audit-roles.ts
//
// Creates / updates the five GBB Internal Audit roles and maps their permissions.
// The roles and their permissions live in src/modules/user/utility/gbb-audit-roles.ts.
//
// SAFE BY DEFAULT — with no flags this only READS the database and prints what it
// would do. Nothing is written until you pass:  --execute --confirm=GBB-ROLES
//
// What it will and will not touch:
//   • head_internal_audit, financial_auditor, compliance_auditor, dg  → CREATED (or, on a
//     re-run, re-asserted). If a role with one of those names already exists and was NOT
//     created by this script, it stops and tells you — it never overwrites someone else's role.
//   • The existing System Auditor role → its permissions are OVERRIDDEN with the new set and it is
//     RENAMED to system_auditor (people who hold it keep it). Refuses if system_auditor already exists.
//   • The `auditee` role → verified; any of the 8 permissions the system needs that are
//     missing are ADDED. Nothing is ever removed from it.
//   • super_admin and every other role → NEVER touched.
//   • Users and user→role assignments → NEVER touched (you attach emails yourself).
//   • system_config (escalation matrix) → only with --set-escalation-matrix.
//
// Usage (run from audit-system/, on the machine whose .env points at the target DB):
//   npx ts-node scripts/seed-gbb-audit-roles.ts                          # preview (read-only)
//   npx ts-node scripts/seed-gbb-audit-roles.ts --execute --confirm=GBB-ROLES
//   npx ts-node scripts/seed-gbb-audit-roles.ts --verify                 # AFTER attaching emails
//   npx ts-node scripts/seed-gbb-audit-roles.ts --print-map              # markdown table, no DB
// Options:
//   --system-auditor-role="<exact name>"   if more than one existing role looks like System Auditor
//   --set-escalation-matrix                also point escalations at head_internal_audit / dg
import { PrismaClient } from '@prisma/client';
import { PERMISSIONS, ROLES } from '../prisma/seed';
import {
  AUDITEE_REQUIRED_PERMISSIONS,
  GBB_ESCALATION_MATRIX,
  GBB_ROLES,
  GBB_ROLE_MARKER,
  GbbRoleKey,
  PlannerRoleState,
  checkTeamReadiness,
  normaliseRoleName,
  planGbbRoleChanges,
  toTeamMember,
} from '../src/modules/user/utility/gbb-audit-roles';

const args = process.argv.slice(2);
const flag = (name: string): boolean => args.includes(name);
const option = (name: string): string | undefined => {
  const hit = args.find((a) => a.startsWith(`${name}=`));
  return hit ? hit.slice(name.length + 1).replace(/^"|"$/g, '') : undefined;
};

const EXECUTE = flag('--execute');
const CONFIRMED = flag('--confirm=GBB-ROLES');
const CATALOGUE = new Map(PERMISSIONS.map((p) => [p.slug, p]));

const maskUrl = (url: string | undefined): string =>
  (url ?? '(DATABASE_URL not set)').replace(/((?:password|pwd)=)[^;]*/gi, '$1***').replace(/:\/\/([^:@/]+):[^@/]*@/, '://$1:***@');

const line = (s = ''): void => console.log(s);

// ── --print-map: no database needed ─────────────────────────────────────────
const printMap = (): void => {
  const cols = GBB_ROLES.map((r) => ({ key: r.key, title: r.title, set: new Set(r.permissions) }));
  line('# GBB Internal Audit — role → permission map');
  line();
  line('Generated from `src/modules/user/utility/gbb-audit-roles.ts` (do not edit by hand).');
  line();
  line('| Role (stored name) | Who | Permissions |');
  line('|---|---|---|');
  for (const r of GBB_ROLES) line(`| \`${r.name}\` | ${r.title} | ${r.permissions.length} |`);
  line();
  const everyoneHolds = new Set<string>();
  const byModule = new Map<string, string[]>();
  for (const p of PERMISSIONS) {
    if (!byModule.has(p.module)) byModule.set(p.module, []);
    byModule.get(p.module)!.push(p.slug);
    if (cols.some((c) => c.set.has(p.slug))) everyoneHolds.add(p.slug);
  }
  const header = ['Permission', 'What it does', ...cols.map((c) => c.title)];
  line(`| ${header.join(' | ')} |`);
  line(`|${header.map(() => '---').join('|')}|`);
  for (const [module, slugs] of byModule) {
    line(`| **${module}** |  |${cols.map(() => '').join('|')}|`);
    for (const slug of slugs) {
      const p = CATALOGUE.get(slug)!;
      line(`| \`${slug}\` | ${p.description} | ${cols.map((c) => (c.set.has(slug) ? '✓' : '')).join(' | ')} |`);
    }
  }
  line();
  line('## Held by none of these roles (super admin only)');
  line();
  for (const p of PERMISSIONS) if (!everyoneHolds.has(p.slug)) line(`- \`${p.slug}\` — ${p.description}`);
};

// ── database helpers ────────────────────────────────────────────────────────
const loadState = async (prisma: PrismaClient) => {
  const [permissions, roles] = await Promise.all([
    prisma.permission.findMany({ select: { slug: true } }),
    prisma.role.findMany({
      include: {
        role_permissions: { include: { permission: { select: { slug: true } } } },
        _count: { select: { user_roles: true } },
      },
    }),
  ]);
  const state: { existingPermissionSlugs: Set<string>; roles: PlannerRoleState[] } = {
    existingPermissionSlugs: new Set(permissions.map((p) => p.slug)),
    roles: roles.map((r) => ({
      id: r.id,
      name: r.name,
      description: r.description,
      isSystem: r.is_system,
      permissionSlugs: r.role_permissions.map((rp) => rp.permission.slug),
      holderCount: r._count.user_roles,
    })),
  };
  return state;
};

/** Roles that auto-assignment could mistake for the auditee role (it picks the first match by permission profile). */
const auditeeProfileMatches = (roles: readonly PlannerRoleState[]): PlannerRoleState[] =>
  roles.filter((r) => {
    const s = new Set(r.permissionSlugs);
    return s.has('followup:respond') && s.has('followup:evidence') && !s.has('working_paper:create') && !s.has('*');
  });

const run = async (): Promise<number> => {
  const prisma = new PrismaClient();
  try {
    line(`Target database: ${maskUrl(process.env.DATABASE_URL)}`);
    line(EXECUTE ? 'Mode: EXECUTE (will write)' : 'Mode: PREVIEW (read-only — nothing will be written)');
    line();

    const state = await loadState(prisma);
    const plan = planGbbRoleChanges(state, new Set(CATALOGUE.keys()), GBB_ROLES, {
      systemAuditorRoleName: option('--system-auditor-role'),
    });

    // --verify ---------------------------------------------------------------
    if (flag('--verify')) return await verify(prisma, state, plan);

    // Preview ----------------------------------------------------------------
    if (plan.permissionsToCreate.length > 0) {
      line(`Permissions missing from this database (will be created first): ${plan.permissionsToCreate.join(', ')}`);
      line();
    }
    for (const p of plan.roles) {
      const tag = p.action === 'create' ? 'CREATE  ' : p.action === 'update' ? 'UPDATE  ' : 'NO CHANGE';
      const target = p.existing ? `"${p.existing.name}"` : `"${p.spec.name}"`;
      const holders = p.existing ? `, ${p.existing.holderCount} user(s) currently hold it` : '';
      line(`  [${tag}] ${target.padEnd(24)} ${p.spec.permissions.length} permissions` +
        (p.action === 'update' ? `  (+${p.add.length} / -${p.remove.length})` : '') + holders);
      if (p.spec.mode === 'override' && p.existing) line(`            ↳ overriding the existing System Auditor role (matched by name "${p.existing.name}")`);
      if (p.rename) line(`            ↳ will be RENAMED to "${p.rename}" (its members keep the role)`);
      if (p.remove.length > 0) line(`            ↳ will REMOVE: ${p.remove.join(', ')}`);
    }

    // Auditee check ----------------------------------------------------------
    const auditee = state.roles.find((r) => r.name.toLowerCase() === 'auditee');
    let auditeeMissing: string[] = [];
    line();
    if (!auditee) {
      line('  [AUDITEE ] No role named "auditee" found — it will be created with the standard auditee permissions.');
    } else {
      const have = new Set(auditee.permissionSlugs);
      auditeeMissing = AUDITEE_REQUIRED_PERMISSIONS.filter((s) => !have.has(s));
      line(auditeeMissing.length === 0
        ? `  [AUDITEE ] "${auditee.name}" already has all ${AUDITEE_REQUIRED_PERMISSIONS.length} required permissions — no change.`
        : `  [AUDITEE ] "${auditee.name}" is missing: ${auditeeMissing.join(', ')} — these will be ADDED (nothing removed).`);
    }
    const profileMatches = auditeeProfileMatches(state.roles);
    if (profileMatches.length > 1) {
      line(`  [WARNING ] ${profileMatches.length} roles look like an auditee role (${profileMatches.map((r) => r.name).join(', ')}). ` +
        'The system auto-assigns whichever it finds first, so new auditees may get the wrong one.');
    }
    const viewer = state.roles.find((r) => r.name.toLowerCase() === 'viewer');
    line(viewer
      ? `  [VIEWER  ] "${viewer.name}" exists (${viewer.holderCount} holders) — not modified.`
      : '  [VIEWER  ] No "viewer" role found. SSO falls back to it for every new staff account; check LDAP_DEFAULT_ROLE / SSO_DEFAULT_ROLE.');

    // Escalation matrix ------------------------------------------------------
    const escRow = await prisma.system_Config.findUnique({ where: { key: 'escalation_matrix' }, select: { value: true } });
    line();
    line(`  Escalation matrix currently: ${escRow?.value ? escRow.value.replace(/\s+/g, ' ') : '(not set — built-in defaults: director / cae / audit_manager)'}`);
    line(`  Desired for these roles:     ${JSON.stringify(GBB_ESCALATION_MATRIX)}`);
    line(flag('--set-escalation-matrix')
      ? '  → will be updated (--set-escalation-matrix given).'
      : '  → left as is. Add --set-escalation-matrix to point escalations at the Head of IA and DG.');

    if (!plan.ok) {
      line();
      line('STOPPED — fix these first (nothing was written):');
      for (const c of plan.conflicts) line(`  ✗ ${c}`);
      return 1;
    }

    if (!EXECUTE) {
      line();
      line('Preview only. To apply:  npx ts-node scripts/seed-gbb-audit-roles.ts --execute --confirm=GBB-ROLES');
      return 0;
    }
    if (!CONFIRMED) {
      line();
      line('Refusing to write: add --confirm=GBB-ROLES (and check the target database above is the right one).');
      return 1;
    }

    // Execute ----------------------------------------------------------------
    await prisma.$transaction(async (tx) => {
      const allSlugs = new Set<string>([...plan.roles.flatMap((p) => [...p.spec.permissions]), ...AUDITEE_REQUIRED_PERMISSIONS]);
      for (const slug of [...allSlugs].filter((s) => !state.existingPermissionSlugs.has(s))) {
        const p = CATALOGUE.get(slug);
        if (!p) throw new Error(`Permission "${slug}" is not in the catalogue.`);
        await tx.permission.upsert({ where: { slug }, create: p, update: {} });
      }
      const rows = await tx.permission.findMany({ where: { slug: { in: [...allSlugs] } }, select: { id: true, slug: true } });
      const idBySlug = new Map(rows.map((r) => [r.slug, r.id]));
      const need = (slug: string): string => {
        const id = idBySlug.get(slug);
        if (!id) throw new Error(`Permission "${slug}" is missing from the database.`);
        return id;
      };

      for (const p of plan.roles) {
        if (p.action === 'unchanged') continue;
        let roleId = p.existing?.id;
        if (!roleId) {
          const created = await tx.role.create({
            data: { name: p.spec.name, description: `${GBB_ROLE_MARKER} ${p.spec.description}`, is_system: false },
          });
          roleId = created.id;
        } else if (p.spec.mode === 'override') {
          const data: { name?: string; description?: string } = {};
          if (p.rename) data.name = p.rename;
          if (!(p.existing?.description ?? '').trim()) data.description = p.spec.description;
          if (Object.keys(data).length > 0) await tx.role.update({ where: { id: roleId }, data });
        }
        if (p.remove.length > 0) {
          await tx.role_Permission.deleteMany({ where: { role_id: roleId, permission: { slug: { in: p.remove } } } });
        }
        if (p.add.length > 0) {
          await tx.role_Permission.createMany({ data: p.add.map((slug) => ({ role_id: roleId!, permission_id: need(slug) })) });
        }
      }

      // Auditee: additive only.
      let auditeeId = auditee?.id;
      if (!auditeeId) {
        const seeded = ROLES.find((r) => r.name === 'auditee');
        const created = await tx.role.create({
          data: { name: 'auditee', description: seeded?.description ?? 'Auditee who views findings and submits follow-up responses', is_system: false },
        });
        auditeeId = created.id;
        for (const slug of seeded?.permissions ?? AUDITEE_REQUIRED_PERMISSIONS) {
          const id = idBySlug.get(slug) ?? (await tx.permission.findUnique({ where: { slug }, select: { id: true } }))?.id;
          if (id) await tx.role_Permission.create({ data: { role_id: auditeeId, permission_id: id } });
        }
      } else if (auditeeMissing.length > 0) {
        await tx.role_Permission.createMany({ data: auditeeMissing.map((slug) => ({ role_id: auditeeId!, permission_id: need(slug) })) });
      }

      if (flag('--set-escalation-matrix')) {
        await tx.system_Config.upsert({
          where: { key: 'escalation_matrix' },
          create: {
            key: 'escalation_matrix',
            value: JSON.stringify(GBB_ESCALATION_MATRIX, null, 2),
            description: 'Role names notified when an engagement or approval escalates past its assignees.',
            is_public: false,
          },
          update: { value: JSON.stringify(GBB_ESCALATION_MATRIX, null, 2) },
        });
      }
    }, { timeout: 120_000, maxWait: 30_000 });

    line();
    line('Done. Next:');
    line('  1. In the app, attach each person to ONE of these roles (and remove any other audit role such as audit_manager, cae, director, auditor).');
    line('  2. Run  npx ts-node scripts/seed-gbb-audit-roles.ts --verify  to confirm the team can staff and sign off an audit.');
    line('  3. Tell people to sign out and in (or wait ~15 minutes) so their new permissions load.');
    return 0;
  } finally {
    await prisma.$disconnect();
  }
};

const verify = async (
  prisma: PrismaClient,
  state: Awaited<ReturnType<typeof loadState>>,
  plan: ReturnType<typeof planGbbRoleChanges>,
): Promise<number> => {
  const keyByRoleId = new Map<string, GbbRoleKey>();
  for (const p of plan.roles) {
    const role = p.existing ?? state.roles.find((r) => normaliseRoleName(r.name) === normaliseRoleName(p.spec.name));
    if (role) keyByRoleId.set(role.id, p.spec.key);
  }
  if (keyByRoleId.size === 0) {
    line('None of the GBB roles exist yet — run the preview/execute step first.');
    return 1;
  }
  const now = new Date();
  const users = await prisma.user.findMany({
    where: { deleted_at: null, is_active: true, user_roles: { some: { role_id: { in: [...keyByRoleId.keys()] } } } },
    include: { user_roles: { include: { role: { include: { role_permissions: { include: { permission: { select: { slug: true } } } } } } } } },
  });
  const members = users.map((u) =>
    toTeamMember({
      email: u.email,
      isSuperAdmin: u.is_super_admin,
      roles: u.user_roles
        .filter((ur) => ur.expires_at === null || ur.expires_at > now)
        .map((ur) => ({
          name: ur.role.name,
          key: keyByRoleId.get(ur.role.id),
          permissionSlugs: ur.role.role_permissions.map((rp) => rp.permission.slug),
        })),
    }),
  );

  line(`People currently holding a GBB audit role: ${members.length}`);
  for (const m of members) line(`  • ${m.email.padEnd(46)} ${m.roles.join(', ')}`);
  line();
  const findings = checkTeamReadiness(members);
  if (findings.length === 0) {
    line('✓ All checks passed — the team can staff, approve and issue an audit.');
    return 0;
  }
  for (const f of findings) line(`  ${f.level === 'error' ? '✗ ERROR' : '! WARN '} ${f.message}`);
  return findings.some((f) => f.level === 'error') ? 1 : 0;
};

const main = async (): Promise<void> => {
  if (flag('--print-map')) {
    printMap();
    return;
  }
  process.exitCode = await run();
};

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
