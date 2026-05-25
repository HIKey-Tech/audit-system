import { PrismaClient } from '@prisma/client';
import { writeFileSync } from 'fs';
import { join } from 'path';

const prisma = new PrismaClient();

async function main() {
  const users = await prisma.user.findMany({
    where: { deleted_at: null },
    include: {
      user_roles: { include: { role: true } },
    },
    orderBy: { created_at: 'asc' },
  });

  const lines: string[] = [];
  lines.push('# IAMS Users');
  lines.push('');
  lines.push(`Generated: ${new Date().toISOString()}`);
  lines.push(`Total active users: **${users.length}**`);
  lines.push('');
  lines.push('| # | Email | Name | Department | Job Title | Roles | Active | Super Admin | System User | Last Login | Created |');
  lines.push('|---|-------|------|------------|-----------|-------|--------|-------------|-------------|------------|---------|');

  users.forEach((u, i) => {
    const name = [u.first_name, u.last_name].filter(Boolean).join(' ') || u.display_name || '—';
    const roles = u.user_roles.map((ur) => ur.role.name).join(', ') || '—';
    const lastLogin = u.last_login_at ? u.last_login_at.toISOString() : '—';
    const created = u.created_at.toISOString();
    lines.push(
      `| ${i + 1} | ${u.email} | ${name} | ${u.department ?? '—'} | ${u.job_title ?? '—'} | ${roles} | ${u.is_active ? 'Yes' : 'No'} | ${u.is_super_admin ? 'Yes' : 'No'} | ${u.is_system_user ? 'Yes' : 'No'} | ${lastLogin} | ${created} |`,
    );
  });

  const outPath = join(process.cwd(), 'docs', 'USERS.md');
  writeFileSync(outPath, lines.join('\n') + '\n', 'utf-8');
  console.log(`Wrote ${users.length} users to ${outPath}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
