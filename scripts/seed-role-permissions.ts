// scripts/seed-role-permissions.ts
//
// Attach the canonical permission sets to the RBAC roles on any environment
// (staging / live) WITHOUT running the full seed — no user, template, or
// system-config side effects, and it never re-hashes the live super-admin
// password. Safe + idempotent: re-running just re-asserts each role's
// permission set.
//
// Source of truth is prisma/seed.ts (PERMISSIONS + ROLES), imported directly
// so this script can never drift from the seed.
// ponytail: reuses seed.ts's ROLES/PERMISSIONS instead of re-listing slugs.
//
// Run against the target DB (Prisma reads DATABASE_URL from your .env):
//   npm run seed:role-permissions
// Or override the target explicitly (PowerShell):
//   $env:DATABASE_URL="<staging-or-live-url>"; npm run seed:role-permissions

import { PrismaClient } from '@prisma/client';
import { PERMISSIONS, ROLES } from '../prisma/seed';

const prisma = new PrismaClient();

async function main() {
  // 1. Ensure every catalogue permission exists (create missing, refresh existing).
  //    Non-destructive: unlike the full seed, it does NOT delete permissions
  //    outside the catalogue.
  for (const perm of PERMISSIONS) {
    await prisma.permission.upsert({
      where: { slug: perm.slug },
      create: perm,
      update: {
        name: perm.name,
        module: perm.module,
        action: perm.action,
        description: perm.description,
      },
    });
  }
  console.log(`Permissions ensured: ${PERMISSIONS.length}`);

  // 2. For each canonical role, replace its permission set with the correct one.
  //    Roles are matched by name; a missing role is created so nothing is left
  //    unconfigured (its description is left untouched if it already exists).
  for (const roleData of ROLES) {
    const before = await prisma.role.findUnique({ where: { name: roleData.name } });

    const role = await prisma.role.upsert({
      where: { name: roleData.name },
      create: {
        name: roleData.name,
        description: roleData.description,
        is_system: roleData.isSystem,
      },
      update: {}, // don't overwrite an admin-edited description
    });

    const permissions = await prisma.permission.findMany({
      where: { slug: { in: roleData.permissions } },
      select: { id: true, slug: true },
    });

    if (permissions.length !== roleData.permissions.length) {
      const found = new Set(permissions.map((p) => p.slug));
      const missing = roleData.permissions.filter((s) => !found.has(s));
      throw new Error(
        `Role "${roleData.name}" references missing permissions: ${missing.join(', ')}`,
      );
    }

    // Atomic swap so the role is never left with a partial permission set.
    await prisma.$transaction([
      prisma.role_Permission.deleteMany({ where: { role_id: role.id } }),
      prisma.role_Permission.createMany({
        data: permissions.map((p) => ({ role_id: role.id, permission_id: p.id })),
      }),
    ]);

    const tag = before ? 'updated' : 'CREATED';
    console.log(`  [${tag}] ${roleData.name.padEnd(18)} → ${permissions.length} permissions`);
  }

  console.log('\nRole permissions attached. Roles are ready for testing.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
