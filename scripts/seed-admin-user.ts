// scripts/seed-admin-user.ts
//
// Creates or updates the developer/admin super-admin user
// (davidaiyewumi1@gmail.com) with the full super_admin role and local password.
// Safe & idempotent: can be run on staging, production, or dev at any time.

import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

const ADMIN_EMAIL = 'davidaiyewumi1@gmail.com';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'Wole@123456!';
const FIRST_NAME = 'Wole';
const LAST_NAME = 'Aiyewumi';
const DISPLAY_NAME = 'Wole Aiyewumi';

async function main() {
  console.log(`Seeding super admin user: ${ADMIN_EMAIL}...`);

  const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 12);

  // 1. Ensure the super_admin role exists
  let superAdminRole = await prisma.role.findUnique({
    where: { name: 'super_admin' },
  });

  if (!superAdminRole) {
    superAdminRole = await prisma.role.create({
      data: {
        name: 'super_admin',
        description: 'Full system access and administration',
        is_system_role: true,
      },
    });
    console.log('Created super_admin role');
  }

  // 2. Upsert the user
  const user = await prisma.user.upsert({
    where: { email: ADMIN_EMAIL },
    create: {
      email: ADMIN_EMAIL,
      first_name: FIRST_NAME,
      last_name: LAST_NAME,
      display_name: DISPLAY_NAME,
      password_hash: passwordHash,
      department: 'Internal Audit',
      jobTitle: 'System Administrator',
      email_verified: true,
      is_system_user: true,
      is_super_admin: true,
      is_active: true,
    },
    update: {
      first_name: FIRST_NAME,
      last_name: LAST_NAME,
      display_name: DISPLAY_NAME,
      password_hash: passwordHash,
      department: 'Internal Audit',
      jobTitle: 'System Administrator',
      email_verified: true,
      is_system_user: true,
      is_super_admin: true,
      is_active: true,
      deleted_at: null,
    },
  });

  // 3. Assign the super_admin role
  const existingRole = await prisma.user_Role.findFirst({
    where: { user_id: user.id, role_id: superAdminRole.id },
  });

  if (!existingRole) {
    await prisma.user_Role.create({
      data: {
        user_id: user.id,
        role_id: superAdminRole.id,
      },
    });
  }

  console.log(`\n✅ Super admin user successfully configured!`);
  console.log(`   Email:    ${ADMIN_EMAIL}`);
  console.log(`   Password: ${ADMIN_PASSWORD}`);
  console.log(`   Role:     super_admin (Highest level permissions)\n`);
}

main()
  .catch((e) => {
    console.error('Error seeding admin user:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
