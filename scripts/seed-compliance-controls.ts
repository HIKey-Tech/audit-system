/**
 * Seeds the structured compliance framework library (compliance_frameworks +
 * compliance_controls) from the existing CONTROL_SETS catalogue.
 *
 * Idempotent — safe to run repeatedly and on multiple databases. Run AFTER the
 * `20260616120000_add_compliance_framework_tables` migration has been applied.
 *
 *   npx prisma migrate deploy
 *   npx ts-node scripts/seed-compliance-controls.ts
 */
import { PrismaClient } from '@prisma/client';
import { CONTROL_SETS } from '../src/modules/audit/utility/audit.utility';
import { AuditType } from '../src/modules/audit/domain/enum/audit.enum';

const prisma = new PrismaClient();

interface FrameworkDef {
  code: string;
  name: string;
  category: 'it' | 'financial' | 'compliance' | 'systems' | 'governance';
}

// Catalogue of frameworks the seeded controls belong to.
const FRAMEWORKS: FrameworkDef[] = [
  { code: 'ISO27001', name: 'ISO/IEC 27001 — Information Security', category: 'it' },
  { code: 'PCIDSS', name: 'PCI DSS — Payment Card Data Security', category: 'it' },
  { code: 'NIST-CSF', name: 'NIST Cybersecurity Framework', category: 'it' },
  { code: 'ISO9001', name: 'ISO 9001 — Quality Management', category: 'compliance' },
  { code: 'ISO22301', name: 'ISO 22301 — Business Continuity', category: 'compliance' },
  { code: 'NDPR', name: 'NDPR — Nigeria Data Protection Regulation', category: 'compliance' },
  { code: 'NITDA', name: 'NITDA — Data Protection Compliance', category: 'governance' },
  { code: 'ISO31000', name: 'ISO 31000 — Risk Management', category: 'compliance' },
  { code: 'ISO20000', name: 'ISO/IEC 20000 — IT Service Management', category: 'systems' },
  { code: 'COBIT', name: 'COBIT — IT Governance', category: 'governance' },
  { code: 'GBB-FIN', name: 'GBB Financial Controls', category: 'financial' },
  { code: 'GBB-SYS', name: 'GBB Systems Controls', category: 'systems' },
];

/** Derive the framework code from a control reference prefix. Order matters. */
function frameworkCodeFor(controlReference: string): string {
  const ref = controlReference.toUpperCase();
  if (ref.startsWith('NDPR-NITDA')) return 'NITDA';
  if (ref.startsWith('NDPR')) return 'NDPR';
  if (ref.startsWith('NIST')) return 'NIST-CSF';
  if (ref.startsWith('ISO27001')) return 'ISO27001';
  if (ref.startsWith('ISO9001')) return 'ISO9001';
  if (ref.startsWith('ISO22301')) return 'ISO22301';
  if (ref.startsWith('ISO31000')) return 'ISO31000';
  if (ref.startsWith('ISO20000')) return 'ISO20000';
  if (ref.startsWith('PCIDSS')) return 'PCIDSS';
  if (ref.startsWith('COBIT')) return 'COBIT';
  if (ref.startsWith('FIN')) return 'GBB-FIN';
  if (ref.startsWith('SYS')) return 'GBB-SYS';
  return 'GBB-SYS';
}

async function main(): Promise<void> {
  const frameworkIdByCode = new Map<string, string>();

  for (const fw of FRAMEWORKS) {
    const row = await prisma.compliance_Framework.upsert({
      where: { code: fw.code },
      update: { name: fw.name, category: fw.category },
      create: { code: fw.code, name: fw.name, category: fw.category },
    });
    frameworkIdByCode.set(fw.code, row.id);
  }
  console.log(`Upserted ${FRAMEWORKS.length} frameworks.`);

  let controlCount = 0;
  for (const auditType of Object.values(AuditType)) {
    const controls = CONTROL_SETS[auditType] ?? [];
    for (const control of controls) {
      const code = frameworkCodeFor(control.controlReference);
      const frameworkId = frameworkIdByCode.get(code)!;
      await prisma.compliance_Control.upsert({
        where: {
          framework_id_control_reference: {
            framework_id: frameworkId,
            control_reference: control.controlReference,
          },
        },
        update: {
          control_description: control.controlDescription,
          test_procedure: control.testProcedure,
          audit_type: auditType,
        },
        create: {
          framework_id: frameworkId,
          control_reference: control.controlReference,
          control_description: control.controlDescription,
          test_procedure: control.testProcedure,
          audit_type: auditType,
        },
      });
      controlCount += 1;
    }
  }
  console.log(`Upserted ${controlCount} controls.`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (err) => {
    console.error(err);
    await prisma.$disconnect();
    process.exit(1);
  });
