/// <reference types="node" />
// prisma/seed.ts
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

// ─────────────────────────────────────────────────────────────
// Permissions  (module:action)
// ─────────────────────────────────────────────────────────────
const PERMISSIONS = [
  // user module
  { name: 'user:read', module: 'user', action: 'read', description: 'View users' },
  { name: 'user:write', module: 'user', action: 'write', description: 'Create / update users' },
  { name: 'user:delete', module: 'user', action: 'delete', description: 'Delete users' },
  { name: 'user:admin', module: 'user', action: 'admin', description: 'Manage roles & permissions' },

  // audit module
  { name: 'audit:read', module: 'audit', action: 'read', description: 'View audit plans & engagements' },
  { name: 'audit:write', module: 'audit', action: 'write', description: 'Create / update audit content' },
  { name: 'audit:delete', module: 'audit', action: 'delete', description: 'Delete audit content' },
  { name: 'audit:admin', module: 'audit', action: 'admin', description: 'Full audit administration' },

  // finding module (part of audit)
  { name: 'finding:read', module: 'audit', action: 'read', description: 'View findings' },
  { name: 'finding:write', module: 'audit', action: 'write', description: 'Create / update findings' },

  // document module
  { name: 'document:read', module: 'document', action: 'read', description: 'Download documents' },
  { name: 'document:write', module: 'document', action: 'write', description: 'Upload documents' },
  { name: 'document:delete', module: 'document', action: 'delete', description: 'Delete documents' },

  // messaging module
  { name: 'notification:read', module: 'messaging', action: 'read', description: 'View notifications' },

  // logging module
  { name: 'log:read', module: 'logging', action: 'read', description: 'View audit logs' },
  { name: 'log:admin', module: 'logging', action: 'admin', description: 'Manage log settings' },

  // background module
  { name: 'job:read', module: 'background', action: 'read', description: 'View scheduled jobs' },
  { name: 'job:admin', module: 'background', action: 'admin', description: 'Manage scheduled jobs' },

  // predictive module
  { name: 'predictive:read', module: 'predictive', action: 'read', description: 'View ML insights' },
  { name: 'predictive:admin', module: 'predictive', action: 'admin', description: 'Manage ML models' },
];

// ─────────────────────────────────────────────────────────────
// Roles + their permission sets
// ─────────────────────────────────────────────────────────────
const ROLES: Array<{
  name: string;
  description: string;
  isSystem: boolean;
  permissions: string[];
}> = [
    {
      name: 'super_admin',
      description: 'Full system access',
      isSystem: true,
      permissions: PERMISSIONS.map((p) => p.name),
    },
    {
      name: 'audit_admin',
      description: 'Full audit management, no system settings',
      isSystem: true,
      permissions: [
        'user:read', 'user:write',
        'audit:read', 'audit:write', 'audit:delete', 'audit:admin',
        'finding:read', 'finding:write',
        'document:read', 'document:write', 'document:delete',
        'notification:read',
        'log:read',
        'job:read',
        'predictive:read',
      ],
    },
    {
      name: 'audit_lead',
      description: 'Lead auditor — manages engagements and team',
      isSystem: true,
      permissions: [
        'user:read',
        'audit:read', 'audit:write',
        'finding:read', 'finding:write',
        'document:read', 'document:write',
        'notification:read',
        'log:read',
        'predictive:read',
      ],
    },
    {
      name: 'auditor',
      description: 'Standard auditor — works on assigned engagements',
      isSystem: true,
      permissions: [
        'audit:read', 'audit:write',
        'finding:read', 'finding:write',
        'document:read', 'document:write',
        'notification:read',
      ],
    },
    {
      name: 'auditee',
      description: 'Auditee — views relevant findings and responds',
      isSystem: true,
      permissions: [
        'audit:read',
        'finding:read',
        'document:read',
        'notification:read',
      ],
    },
    {
      name: 'viewer',
      description: 'Read-only access — default role on SSO provisioning',
      isSystem: true,
      permissions: [
        'audit:read',
        'finding:read',
        'document:read',
        'notification:read',
      ],
    },
  ];

// ─────────────────────────────────────────────────────────────
// Seed
// ─────────────────────────────────────────────────────────────
async function main(): Promise<void> {
  console.log('🌱  Seeding database...');

  // 1. Upsert permissions
  for (const perm of PERMISSIONS) {
    await prisma.permission.upsert({
      where: { name: perm.name },
      create: perm,
      update: { description: perm.description },
    });
  }
  console.log(`   ✓ ${PERMISSIONS.length} permissions seeded`);

  // 2. Upsert roles + role_permissions
  for (const roleData of ROLES) {
    const role = await prisma.role.upsert({
      where: { name: roleData.name },
      create: {
        name: roleData.name,
        description: roleData.description,
        is_system: roleData.isSystem,
      },
      update: { description: roleData.description },
    });

    // Clear existing assignments then re-apply (idempotent)
    await prisma.role_Permission.deleteMany({ where: { role_id: role.id } });

    const permissions = await prisma.permission.findMany({
      where: { name: { in: roleData.permissions } },
      select: { id: true },
    });

    await prisma.role_Permission.createMany({
      data: permissions.map((p: { id: string }) => ({ role_id: role.id, permission_id: p.id })),
    });
  }
  console.log(`   ✓ ${ROLES.length} roles seeded`);

  // 3. Seed super-admin user (only if it doesn't exist)
  const adminEmail = process.env.SEED_ADMIN_EMAIL ?? 'admin@example.com';
  const adminPassword = process.env.SEED_ADMIN_PASSWORD ?? 'Admin@123456!';

  const existingAdmin = await prisma.user.findUnique({
    where: { email: adminEmail },
  });

  if (!existingAdmin) {
    const superAdminRole = await prisma.role.findUniqueOrThrow({
      where: { name: 'super_admin' },
    });

    await prisma.user.create({
      data: {
        email: adminEmail,
        first_name: 'Super',
        last_name: 'Admin',
        display_name: 'Super Admin',
        password_hash: await bcrypt.hash(adminPassword, 12),
        email_verified: true,
        is_system_user: true,
        is_active: true,
        user_roles: {
          create: [{ role_id: superAdminRole.id }],
        },
      },
    });
    console.log(`   ✓ Super admin created: ${adminEmail}`);
  } else {
    console.log(`   – Super admin already exists: ${adminEmail}`);
  }

  console.log('✅  Seed complete');
}

main()
  .catch((err) => {
    console.error('Seed failed:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
