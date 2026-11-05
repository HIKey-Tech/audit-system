/**
 * Wipes UAT / test data so the system starts clean, while keeping users and
 * the configuration the application needs to run.
 *
 *   Dry run (default, deletes nothing):
 *     npx ts-node prisma/reset-test-data.ts
 *   Execute:
 *     npx ts-node prisma/reset-test-data.ts --execute --confirm=RESET
 *
 * KEPT   users, roles, permissions, role/user links, AD group mappings, 2FA
 *        backup codes, signatures, sessions, templates, compliance frameworks
 *        and controls, risk categories, escalation policies, system config,
 *        scheduler job definitions, IMOC ingestion rules and saved views.
 * WIPED  universe, plans, engagements and everything under them (working
 *        papers, evidence, findings, reports, follow-ups, checklists), risks,
 *        workflow approvals / assignments / escalations / requests, assets,
 *        IMOC tickets + links, Project Plus links, system-audit runs, security
 *        tests, documents (except those used by templates/signatures),
 *        notifications, logs, predictive data, job run history.
 *
 * BACK UP THE DATABASE FIRST. This cannot be undone.
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const WIPE_TABLES = [
  // audit fieldwork
  'audit_working_paper_comments', 'audit_working_papers', 'audit_evidence_assets', 'audit_evidence',
  'audit_evidence_requests', 'audit_time_entries', 'audit_finding_responders', 'audit_finding_assets',
  'audit_findings', 'audit_reports', 'audit_follow_ups', 'audit_checklists',
  'imoc_ticket_snapshots', 'imoc_ticket_links', 'projectplus_entity_links',
  'audit_engagement_assets', 'audit_engagements', 'audit_plan_items', 'audit_plans',
  'audit_universe_assets', 'audit_universe',
  // risk & compliance links
  'imoc_ticket_risk_links', 'compliance_control_risks', 'risk_asset_links', 'risk_assessments', 'risk_register',
  // workflow
  'workflow_approval_signed_documents', 'workflow_approval_steps', 'workflow_approvals',
  'workflow_request_signed_documents', 'workflow_request_actions', 'workflow_request_steps', 'workflow_requests',
  'workflow_assignments', 'workflow_escalations',
  // assets
  'asset_attestations', 'asset_relationships', 'asset_sources', 'assets',
  // system audit toolkit
  'access_review_items', 'system_audit_exceptions', 'system_audit_runs',
  'security_test_assets', 'security_tests', 'system_documents',
  // IMOC store
  'imoc_ingestion_runs', 'imoc_tickets',
  // predictive
  'predictive_insight_feedback', 'predictive_insights', 'predictive_outcomes', 'predictive_snapshots',
  // messaging, logs, history, transient auth tokens
  'notification_queue', 'notifications', 'email_logs', 'audit_logs', 'system_logs',
  'scheduled_job_runs', 'password_reset_tokens', 'mfa_email_otps',
];

const KEPT_DOCUMENT_IDS_SQL = `(
  SELECT document_id FROM [dbo].[document_templates] WHERE document_id IS NOT NULL
  UNION SELECT document_id FROM [dbo].[user_signatures]
)`;

// Documents are special: templates and user signatures point at some of them.
const DOCUMENT_STEPS: Array<{ label: string; table: string; sql: string; count: string }> = [
  {
    label: 'document_versions (of removable documents)',
    table: 'document_versions',
    sql: `DELETE FROM [dbo].[document_versions] WHERE document_id NOT IN ${KEPT_DOCUMENT_IDS_SQL}`,
    count: `SELECT COUNT(*) AS n FROM [dbo].[document_versions] WHERE document_id NOT IN ${KEPT_DOCUMENT_IDS_SQL}`,
  },
  {
    label: 'documents (not used by templates/signatures)',
    table: 'documents',
    sql: `DELETE FROM [dbo].[documents] WHERE id NOT IN ${KEPT_DOCUMENT_IDS_SQL}`,
    count: `SELECT COUNT(*) AS n FROM [dbo].[documents] WHERE id NOT IN ${KEPT_DOCUMENT_IDS_SQL}`,
  },
];

const count = async (sql: string): Promise<number> => {
  const rows = (await prisma.$queryRawUnsafe(sql)) as Array<{ n: number | bigint }>;
  return Number(rows[0]?.n ?? 0);
};

const tableCount = (t: string) => count(`SELECT COUNT(*) AS n FROM [dbo].[${t}]`);

async function main(): Promise<void> {
  const execute = process.argv.includes('--execute');
  const confirmed = process.argv.includes('--confirm=RESET');

  const dbUrl = process.env.DATABASE_URL ?? '';
  const target = dbUrl.replace(/\/\/[^@]*@/, '//***@').split(';').filter((p) => /^sqlserver:|database=/i.test(p)).join(' ');
  console.log(`Target database: ${target || '(DATABASE_URL not set)'}`);

  const usersBefore = await tableCount('users');
  console.log(`Users (kept): ${usersBefore}\n`);

  console.log(execute ? 'Rows to delete:' : 'DRY RUN. Rows that WOULD be deleted:');
  let total = 0;
  for (const t of WIPE_TABLES) {
    const n = await tableCount(t);
    total += n;
    if (n > 0) console.log(`  ${t.padEnd(40)} ${n}`);
  }
  for (const d of DOCUMENT_STEPS) {
    const n = await count(d.count);
    total += n;
    if (n > 0) console.log(`  ${d.label.padEnd(40)} ${n}`);
  }
  console.log(`\nTotal rows: ${total}`);

  if (!execute) {
    console.log('\nNothing deleted. Re-run with: --execute --confirm=RESET (after taking a database backup).');
    return;
  }
  if (!confirmed) {
    throw new Error('Refusing to delete: add --confirm=RESET to proceed.');
  }

  // Foreign keys are NO ACTION, so delete in repeated passes until every table is empty;
  // a table blocked by a not-yet-emptied child is simply retried on the next pass.
  const steps = [
    ...WIPE_TABLES.map((t) => ({ label: t, sql: `DELETE FROM [dbo].[${t}]` })),
    ...DOCUMENT_STEPS.map((d) => ({ label: d.label, sql: d.sql })),
  ];
  let pending = steps;
  for (let pass = 1; pass <= 10 && pending.length > 0; pass++) {
    const failed: typeof steps = [];
    for (const step of pending) {
      try {
        await prisma.$executeRawUnsafe(step.sql);
      } catch {
        failed.push(step);
      }
    }
    console.log(`Pass ${pass}: ${pending.length - failed.length} cleared, ${failed.length} deferred`);
    if (failed.length === pending.length) {
      throw new Error(`Cannot clear: ${failed.map((f) => f.label).join(', ')}. Nothing further was changed.`);
    }
    pending = failed;
  }

  const usersAfter = await tableCount('users');
  console.log(`\nDone. Users before: ${usersBefore}, after: ${usersAfter}.`);
  if (usersAfter !== usersBefore) throw new Error('User count changed. Restore from backup and investigate.');
  console.log('Reminder: uploaded files on disk/blob storage are not deleted by this script.');
}

main()
  .catch((err) => {
    console.error(`\nFAILED: ${err instanceof Error ? err.message : err}`);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
