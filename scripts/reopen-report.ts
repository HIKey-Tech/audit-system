/// <reference types="node" />
// scripts/reopen-report.ts
//
// Re-opens an audit report that has been APPROVED but NOT YET ISSUED, by putting it back to
// `draft`. The lead auditor can then edit it and submit it again, which starts a fresh
// approval chain at level 1. The previous approval and its signed document stay in the
// database as history. The change is written to the tamper-evident audit trail.
//
// Safe by default: it only PRINTS what it would do. Nothing changes without --apply.
//
//   Dry run : npx ts-node scripts/reopen-report.ts AUD-2026-002
//   Apply   : npx ts-node scripts/reopen-report.ts AUD-2026-002 --apply
//
// Take a database backup before running with --apply on a live system.

import { PrismaClient } from '@prisma/client';
import { auditLogService } from '../src/modules/logging/service/implementation/audit-log.service';

const prisma = new PrismaClient();

const main = async (): Promise<void> => {
  const reference = process.argv[2];
  const apply = process.argv.includes('--apply');

  if (!reference || reference.startsWith('--')) {
    console.error('Usage: npx ts-node scripts/reopen-report.ts <ENGAGEMENT-REFERENCE> [--apply]');
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

  const report = await prisma.audit_Report.findFirst({
    where: { engagement_id: engagement.id, deleted_at: null },
    select: { id: true, title: true, status: true },
  });
  if (!report) {
    console.error(`${reference} has no report.`);
    process.exit(1);
  }

  const approvals = await prisma.workflow_Approval.findMany({
    where: { entity_type: 'audit_report', entity_id: report.id },
    orderBy: { created_at: 'desc' },
    select: { id: true, status: true, current_level: true },
  });

  console.log('Engagement :', engagement.reference_number, '-', engagement.title);
  console.log('  status   :', engagement.status);
  console.log('Report     :', report.title);
  console.log('  status   :', report.status);
  console.log('Approvals  :', approvals.map((a) => `${a.status} (level ${a.current_level})`).join(', ') || 'none');
  console.log('');

  if (report.status === 'issued') {
    console.error('REFUSED: the report has already been issued. Nothing needs re-opening — the auditee can');
    console.error('respond to findings now that the engagement is past fieldwork.');
    process.exit(1);
  }
  if (report.status !== 'approved') {
    console.error(`REFUSED: only an APPROVED report can be re-opened (this one is "${report.status}").`);
    console.error('A draft is already editable; a submitted report can be rejected by its approver instead.');
    process.exit(1);
  }
  if (engagement.status !== 'under_review') {
    console.error(`REFUSED: expected the engagement to be under_review (Quality Assurance), but it is "${engagement.status}".`);
    process.exit(1);
  }
  if (approvals.some((a) => a.status === 'pending')) {
    console.error('REFUSED: this report has a pending approval. Resolve it first.');
    process.exit(1);
  }

  console.log('Plan: set the report status  approved -> draft  (approval history is kept).');
  console.log('Then the lead auditor edits the review and uses "Submit for approval" again.');

  if (!apply) {
    console.log('\nDRY RUN — nothing was changed. Add --apply to do it.');
    return;
  }

  await prisma.audit_Report.update({
    where: { id: report.id },
    data: { status: 'draft', rejection_reason: null },
  });

  await auditLogService.log({
    action: 'audit.report.reopen.manual',
    module: 'audit',
    entityType: 'audit_report',
    entityId: report.id,
    oldValues: { status: 'approved' },
    newValues: { status: 'draft', reason: 'Re-opened by script so management responses can be included before approval' },
  });

  console.log('\nDONE — report is now a draft again.');
};

main()
  .catch((err) => {
    console.error('Failed:', err instanceof Error ? err.message : err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
