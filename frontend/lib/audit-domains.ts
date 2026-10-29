import { Cpu, Banknote, ShieldCheck, type LucideIcon } from 'lucide-react';

/**
 * The audit domains GBB commissioned as "dedicated modules". Each shares the
 * single audit engine but presents a dedicated workspace with its own control
 * framework, templates, and OLAs.
 *
 * GBB merged the former separate "IT" and "Systems" modules into one
 * System/IT Audit domain, so `systems` is retired as a selectable type. The
 * backend still accepts the value for records created before the merge — see
 * `auditTypeLabel` and the 20260805120000_merge_systems_into_it migration.
 */
export type AuditDomainKey = 'it' | 'financial' | 'compliance';

export interface AuditDomainMeta {
  /** Matches the backend AuditType enum value. */
  key: AuditDomainKey;
  /** Sidebar / page title, e.g. "IT Audit". */
  label: string;
  /** Short label for badges and buttons, e.g. "IT". */
  short: string;
  /** Route to this module's workspace. */
  href: string;
  icon: LucideIcon;
  /** Control framework this domain is assessed against. */
  framework: string;
  /** One-line focus statement. */
  focus: string;
  /** Longer blurb shown on the module header. */
  description: string;
}

// Ordered as the requirement lists them: System/IT, Financial, Compliance.
export const AUDIT_DOMAINS: AuditDomainMeta[] = [
  {
    key: 'it',
    // Merged domain — covers what were previously the separate IT and Systems
    // modules, so its framework and focus are the union of both.
    label: 'System/IT Audit',
    short: 'System/IT',
    href: '/audit/domains/it',
    icon: Cpu,
    framework: 'ISO 27001 · ISO 22301 · SOX ITGC · Baselines · CAB change · DR & capacity',
    focus: 'Infrastructure, access, cybersecurity, configuration & continuity',
    description:
      'Infrastructure, access management, and cybersecurity controls assessed against ISO 27001 and ISO 22301, together with configuration and continuity — baseline drift, CAB change control, disaster recovery, and capacity.',
  },
  {
    key: 'financial',
    label: 'Financial Audit',
    short: 'Financial',
    href: '/audit/domains/financial',
    icon: Banknote,
    framework: 'Maker-checker · Reconciliations · Fixed assets',
    focus: 'Transactions & financial controls',
    description:
      'Transaction integrity and financial controls — maker-checker segregation, reconciliations, and fixed-asset verification.',
  },
  {
    key: 'compliance',
    label: 'Compliance Audit',
    short: 'Compliance',
    href: '/audit/domains/compliance',
    icon: ShieldCheck,
    framework: 'ISO 9001 · ISO 22301 · NDPR · GDPR',
    focus: 'Standards & regulatory adherence',
    description:
      'Adherence to ISO 9001, ISO 22301, and NDPR — quality management, business continuity, and data protection.',
  },
];

export const AUDIT_DOMAIN_MAP: Record<AuditDomainKey, AuditDomainMeta> = Object.fromEntries(
  AUDIT_DOMAINS.map((d) => [d.key, d]),
) as Record<AuditDomainKey, AuditDomainMeta>;

export const isAuditDomain = (value: string): value is AuditDomainKey =>
  value in AUDIT_DOMAIN_MAP;

export type SelectableAuditTypeKey =
  | 'it'
  | 'systems'
  | 'financial'
  | 'compliance'
  | 'operational'
  | 'pension'
  | 'procurement'
  | 'hr_payroll'
  | 'project'
  | 'special';

export interface SelectableAuditTypeOption {
  value: SelectableAuditTypeKey;
  label: string;
  shortLabel: string;
  description: string;
}

export const SELECTABLE_AUDIT_TYPES: SelectableAuditTypeOption[] = [
  {
    value: 'it',
    label: 'IT Audit',
    shortLabel: 'IT Audit',
    description: 'Infrastructure, access management, cybersecurity & IT general controls (ISO 27001 / SOX ITGC)',
  },
  {
    value: 'systems',
    label: 'Systems Audit',
    shortLabel: 'Systems',
    description: 'System baselines, configuration drift, CAB change control, disaster recovery & capacity (ISO 22301)',
  },
  {
    value: 'financial',
    label: 'Financial Audit',
    shortLabel: 'Financial',
    description: 'Transactions, maker-checker controls, reconciliations & fixed assets',
  },
  {
    value: 'compliance',
    label: 'Compliance Audit',
    shortLabel: 'Compliance',
    description: 'Adherence to regulatory frameworks, ISO standards, NDPR & internal policies',
  },
  {
    value: 'operational',
    label: 'Operational Audit',
    shortLabel: 'Operational',
    description: 'Standard operating procedures, process efficiency, KPIs & turnaround times',
  },
  {
    value: 'pension',
    label: 'Pension Audit',
    shortLabel: 'Pension',
    description: 'PENCOM / PRA 2014 remittances, PFA reconciliations, RSA PINs & retirement benefits',
  },
  {
    value: 'procurement',
    label: 'Procurement Audit',
    shortLabel: 'Procurement',
    description: 'PPA 2007 competitive bidding, BPP thresholds, vendor due diligence & contract awards',
  },
  {
    value: 'hr_payroll',
    label: 'HR & Payroll Audit',
    shortLabel: 'HR & Payroll',
    description: 'Nominal roll reconciliation, statutory deductions (PAYE/NHF/NSITF) & ghost worker controls',
  },
  {
    value: 'project',
    label: 'Project / Capital Audit',
    shortLabel: 'Project / Capital',
    description: 'Project charter governance, milestone sign-offs, variation orders & capital budget tracking',
  },
  {
    value: 'special',
    label: 'Special Investigation / Audit',
    shortLabel: 'Special',
    description: 'Ad-hoc investigations, terms of reference, forensic evidence preservation & loss quantification',
  },
];

const SELECTABLE_AUDIT_TYPE_MAP: Record<string, SelectableAuditTypeOption> = Object.fromEntries(
  SELECTABLE_AUDIT_TYPES.map((t) => [t.value, t]),
);

/**
 * Display label for any stored `audit_type`.
 */
export const auditTypeLabel = (
  value: string | null | undefined,
  form: 'long' | 'short' = 'long',
): string => {
  if (!value) return '—';
  if (value === 'all') return form === 'short' ? 'All' : 'All audit types';
  const selectable = SELECTABLE_AUDIT_TYPE_MAP[value];
  if (selectable) return form === 'short' ? selectable.shortLabel : selectable.label;
  const meta = AUDIT_DOMAIN_MAP[value as AuditDomainKey];
  if (meta) return form === 'short' ? meta.short : meta.label;
  return value.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
};
