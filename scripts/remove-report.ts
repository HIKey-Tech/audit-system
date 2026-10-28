/// <reference types="node" />
// scripts/remove-report.ts
//
// Removes the audit report of an engagement that has been drafted/approved but NOT YET ISSUED, so
// the lead auditor can create it again from scratch (Review tab -> "Generate review"). Use it when
// the report was created too early — e.g. before the auditee gave their management responses.
//
// A report is one row per engagement (unique), so a soft delete would block creating a new one;
// this performs a real delete of that one row. What happens to related data:
//   - the report row            -> deleted
//   - its approval records      -> kept as history, marked "cancelled" (they point at the old report only)
//   - signed approval documents -> kept (stored files stay in the repository as history)
//   - findings, working papers, checklists, evidence, management responses -> untouched
//   - the engagement stays in Quality Assurance
//
// A full record of what was removed is written to the tamper-evident audit trail.
//
// Safe by default: it only PRINTS what it would do. Nothing changes without --apply.
//
//   Dry run : npx ts-node scripts/remove-report.ts AUD-2026-002
//   Apply   : npx ts-node scripts/remove-report.ts AUD-2026-002 --apply
//
// Take a database backup before running with --apply on a live system.

import { PrismaClient } from '@prisma/client';
import { auditLogService } from '../src/modules/logging/service/implementation/audit-log.service';

const prisma = new PrismaClient();

const main = async (): Promise<void> => {
  const reference = process.argv[2];
  const apply = process.argv.includes('--apply');

  if (!reference || reference.startsWith('--')) {
    console.error('Usage: npx ts-node scripts/remove-report.ts <ENGAGEMENT-REFERENCE> [--apply]');
    process.exit(1);
  }

  const engagement = await prisma.audit_Engagement.findFirst({
    where: { reference_number: reference, deleted_at: null },
    select: { id: true, reference_number: true, title: true, status: true },
  });
  if (!engagement) {
    console.error(`No engagement found with reference ${reference}.`);
    process.exit(1);
  }

  // Include soft-deleted rows: the unique link to the engagement is what blocks a new report.
  const report = await prisma.audit_Report.findFirst({
    where: { engagement_id: engagement.id },
    select: { id: true, title: true, status: true, version_number: true, document_id: true, deleted_at: true },
  });
  if (!report) {
    console.error(`${reference} has no report — nothing to remove.`);
    process.exit(1);
  }

  const approvals = await prisma.workflow_Approval.findMany({
    where: { entity_type: 'audit_report', entity_id: report.id },
    orderBy: { created_at: 'desc' },
    select: { id: true, status: true, current_level: true },
  });
  const signedDocs = approvals.length
    ? await prisma.workflow_Approval_Signed_Document.count({ where: { approval_id: { in: approvals.map((a) => a.id) } } })
    : 0;
  const findingCount = await prisma.audit_Finding.count({ where: { engagement_id: engagement.id, deleted_at: null } });
  const responseCount = await prisma.audit_Follow_Up.count({
    where: { finding: { engagement_id: engagement.id, deleted_at: null }, management_response: { not: null } },
  });

  console.log('Engagement :', engagement.reference_number, '-', engagement.title);
  console.log('  status   :', engagement.status);
  console.log('Report     :', report.title, `(v${report.version_number})${report.deleted_at ? ' [soft-deleted]' : ''}`);
  console.log('  status   :', report.status);
  console.log('Approvals  :', approvals.map((a) => `${a.status} (level ${a.current_level})`).join(', ') || 'none');
  console.log('Signed docs:', signedDocs, '(kept)');
  console.log('Findings   :', findingCount, '| management responses on file:', responseCount, '(both untouched)');
  console.log('');

  if (report.status === 'issued') {
    console.error('REFUSED: the report has already been issued — it cannot be removed. Nothing needs removing:');
    console.error('the auditee can respond to findings now that the engagement is past fieldwork.');
    process.exit(1);
  }
  if (engagement.status !== 'under_review') {
    console.error(`REFUSED: expected the engagement to be under_review (Quality Assurance), but it is "${engagement.status}".`);
    process.exit(1);
  }

  console.log('Plan:');
  console.log('  1. mark the report\'s approval record(s) as "cancelled" (history kept)');
  console.log('  2. delete the report row');
  console.log('  3. the lead auditor then uses Review tab -> "Generate review" to create a new one');

  if (!apply) {
    console.log('\nDRY RUN — nothing was changed. Add --apply to do it.');
    return;
  }

  await prisma.$transaction(async (tx) => {
    await tx.workflow_Approval.updateMany({
      where: { entity_type: 'audit_report', entity_id: report.id, status: { in: ['pending', 'approved'] } },
      data: { status: 'cancelled' },
    });
    await tx.audit_Report.delete({ where: { id: report.id } });
  });

  await auditLogService.log({
    action: 'audit.report.remove.manual',
    module: 'audit',
    entityType: 'audit_report',
    entityId: report.id,
    oldValues: {
      engagement: engagement.reference_number,
      title: report.title,
      status: report.status,
      version: report.version_number,
      approvals: approvals.map((a) => ({ id: a.id, status: a.status })),
    },
    newValues: { removed: true, reason: 'Removed by script so the report is created after the management responses' },
  });

  console.log('\nDONE — the report was removed. The lead can now generate a new one.');
};

main()
  .catch((err) => {
    console.error('Failed:', err instanceof Error ? err.message : err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
