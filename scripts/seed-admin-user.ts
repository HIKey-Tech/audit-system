/// <reference types="node" />
// scripts/seed-admin-user.ts
//
// Creates or updates the developer/admin super-admin user and a secondary
// reviewer account (davidaiyewumi1+reviewer@gmail.com) for end-to-end workflow testing.
// Safe & idempotent: can be run on staging, production, or dev at any time.

import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

interface UserSeedConfig {
  email: string;
  firstName: string;
  lastName: string;
  displayName: string;
  jobTitle: string;
  department: string;
  password: string;
  roles: string[];
  isSuperAdmin: boolean;
}

const USERS_TO_SEED: UserSeedConfig[] = [
  {
    email: 'davidaiyewumi1@gmail.com',
    firstName: 'Wole',
    lastName: 'Aiyewumi',
    displayName: 'Wole Aiyewumi',
    jobTitle: 'System Administrator',
    department: 'Internal Audit',
    password: 'Wole@123456!',
    roles: ['super_admin'],
    isSuperAdmin: true,
  },
  {
    email: 'davidaiyewumi1+reviewer@gmail.com',
    firstName: 'Reviewer',
    lastName: 'Wole',
    displayName: 'Reviewer Wole',
    jobTitle: 'Audit Manager',
    department: 'Internal Audit',
    password: 'Wole@123456!',
    roles: ['audit_manager', 'lead_auditor'],
    isSuperAdmin: false,
  },
];

async function main() {
  console.log(`Starting user provisioning for workflow testing...\n`);

  for (const cfg of USERS_TO_SEED) {
    const passwordHash = await bcrypt.hash(cfg.password, 12);

    // 1. Ensure required roles exist
    for (const roleName of cfg.roles) {
      const existingRole = await prisma.role.findUnique({ where: { name: roleName } });
      if (!existingRole) {
        await prisma.role.create({
          data: {
            name: roleName,
            description: `${roleName} role`,
            is_system: true,
          },
        });
      }
    }

    // 2. Upsert the user
    const user = await prisma.user.upsert({
      where: { email: cfg.email },
      create: {
        email: cfg.email,
        first_name: cfg.firstName,
        last_name: cfg.lastName,
        display_name: cfg.displayName,
        password_hash: passwordHash,
        department: cfg.department,
        job_title: cfg.jobTitle,
        email_verified: true,
        is_system_user: true,
        is_super_admin: cfg.isSuperAdmin,
        is_active: true,
      },
      update: {
        first_name: cfg.firstName,
        last_name: cfg.lastName,
        display_name: cfg.displayName,
        password_hash: passwordHash,
        department: cfg.department,
        job_title: cfg.jobTitle,
        email_verified: true,
        is_system_user: true,
        is_super_admin: cfg.isSuperAdmin,
        is_active: true,
        deleted_at: null,
      },
    });

    // 3. Attach roles
    const roles = await prisma.role.findMany({
      where: { name: { in: cfg.roles } },
      select: { id: true, name: true },
    });

    await prisma.user_Role.deleteMany({ where: { user_id: user.id } });
    await prisma.user_Role.createMany({
      data: roles.map((r) => ({ user_id: user.id, role_id: r.id })),
    });

    console.log(`✅ Configured: ${cfg.email}`);
    console.log(`   Name:     ${cfg.displayName}`);
    console.log(`   Password: ${cfg.password}`);
    console.log(`   Roles:    ${roles.map((r) => r.name).join(', ')}\n`);
  }

  console.log(`Workflow test users ready! Both addresses deliver to your Gmail inbox.`);
}

main()
  .catch((e) => {
    console.error('Error seeding test users:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
