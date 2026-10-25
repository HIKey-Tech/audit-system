// scripts/seed-notification-templates.ts
//
// Refresh the email / in-app notification templates on any environment
// (staging / live) WITHOUT running the full seed — no user, role, or
// system-config side effects, and it never re-hashes any password.
// Safe + idempotent: re-running just re-asserts each template's wording.
//
// Source of truth is prisma/seed.ts (NOTIFICATION_TEMPLATES), imported
// directly so this script can never drift from the seed.
//
// Run against the target DB (Prisma reads DATABASE_URL from your .env):
//   npm run seed:notification-templates
// Or override the target explicitly (PowerShell):
//   $env:DATABASE_URL="<staging-or-live-url>"; npm run seed:notification-templates

import { PrismaClient } from '@prisma/client';
import { NOTIFICATION_TEMPLATES } from '../prisma/seed';

const prisma = new PrismaClient();

async function main() {
  for (const tpl of NOTIFICATION_TEMPLATES) {
    const before = await prisma.notification_Template.findUnique({
      where: { event_key_channel: { event_key: tpl.eventKey, channel: tpl.channel } },
      select: { id: true },
    });

    await prisma.notification_Template.upsert({
      where: { event_key_channel: { event_key: tpl.eventKey, channel: tpl.channel } },
      create: {
        event_key: tpl.eventKey,
        channel: tpl.channel,
        name: tpl.name,
        subject: tpl.subject,
        body: tpl.body,
        description: tpl.description,
        is_active: true,
      },
      update: {
        name: tpl.name,
        subject: tpl.subject,
        body: tpl.body,
        description: tpl.description,
        is_active: true,
        deleted_at: null,
      },
    });

    const tag = before ? 'updated' : 'CREATED';
    console.log(`  [${tag}] ${tpl.eventKey.padEnd(36)} ${tpl.channel}`);
  }

  console.log(`\nNotification templates refreshed: ${NOTIFICATION_TEMPLATES.length}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
