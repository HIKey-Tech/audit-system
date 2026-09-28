import {
  Activity,
  Archive,
  BookOpen,
  Bug,
  ClipboardCheck,
  Database,
  FileCheck2,
  FileSearch,
  FileText,
  Gauge,
  GitPullRequest,
  HardDriveDownload,
  KeyRound,
  LifeBuoy,
  Radar,
  ScrollText,
  ShieldAlert,
  ShieldCheck,
  SlidersHorizontal,
  Siren,
  UserCheck,
  type LucideIcon,
} from 'lucide-react';
import type {
  AnalysisSource,
  AnalysisType,
  SecurityTestStatus,
  SecurityTestType,
  SystemDocumentType,
} from '@/lib/api/system-audit';

export interface AnalysisMeta {
  label: string;
  short: string;
  icon: LucideIcon;
  /** What to upload — shown under the type picker. */
  hint: string;
  /** Summary keys shown as headline metrics on cards and run pages. */
  headline: Array<{ key: string; label: string; suffix?: string; bad?: boolean }>;
}

export const ANALYSIS_META: Record<AnalysisType, AnalysisMeta> = {
  access_listing: {
    label: 'User access review',
    short: 'Access review',
    icon: UserCheck,
    hint: 'A user/role listing from any system (AD, Dynafin, database, application) — or run it live on IAMS or Entra ID.',
    headline: [
      { key: 'totalAccounts', label: 'Accounts' },
      { key: 'sodConflicts', label: 'SoD conflicts', bad: true },
      { key: 'terminatedWithAccess', label: 'Leavers with access', bad: true },
      { key: 'dormantAccounts', label: 'Dormant', bad: true },
      { key: 'privilegedAccounts', label: 'Privileged' },
    ],
  },
  change_log: {
    label: 'Change management review',
    short: 'Change log',
    icon: GitPullRequest,
    hint: 'A change-request export from the ITSM tool (change id, approver, approval and implementation dates).',
    headline: [
      { key: 'implementedChanges', label: 'Changes' },
      { key: 'unapproved', label: 'Unapproved', bad: true },
      { key: 'approvedAfterImplementation', label: 'Approved late', bad: true },
      { key: 'selfApproved', label: 'Self-approved', bad: true },
      { key: 'noTestEvidence', label: 'Untested', bad: true },
    ],
  },
  backup_log: {
    label: 'Backup & recovery verification',
    short: 'Backups',
    icon: HardDriveDownload,
    hint: 'A job report from the backup tool (system, start time, result) including restore tests.',
    headline: [
      { key: 'successRate', label: 'Success rate', suffix: '%' },
      { key: 'failedBackups', label: 'Failed jobs', bad: true },
      { key: 'systemsAtRisk', label: 'Systems at risk', bad: true },
      { key: 'restoreTestFailures', label: 'Failed restores', bad: true },
    ],
  },
  incident_log: {
    label: 'Incident management review',
    short: 'Incidents',
    icon: Siren,
    hint: 'An incident export from the ITSM/SIEM tool — or run it live on IMOC tickets.',
    headline: [
      { key: 'incidents', label: 'Incidents' },
      { key: 'slaCompliance', label: 'SLA compliance', suffix: '%' },
      { key: 'resolutionSlaBreaches', label: 'SLA breaches', bad: true },
      { key: 'agedOpenIncidents', label: 'Aged open', bad: true },
    ],
  },
  security_event_log: {
    label: 'Security log anomaly analysis',
    short: 'Security logs',
    icon: Radar,
    hint: 'A security event export (SIEM, AD, firewall, application) — or run it live on IAMS sign-in events.',
    headline: [
      { key: 'events', label: 'Events' },
      { key: 'bruteForceBursts', label: 'Brute force', bad: true },
      { key: 'passwordSprayBursts', label: 'Password spray', bad: true },
      { key: 'offHoursPrivilegedActions', label: 'Off-hours privileged', bad: true },
      { key: 'auditLogCleared', label: 'Logs cleared', bad: true },
    ],
  },
  configuration: {
    label: 'Configuration baseline review',
    short: 'Configuration',
    icon: SlidersHorizontal,
    hint: 'A settings export (server, database, firewall, application) — compared with the approved baseline or an expected-value column.',
    headline: [
      { key: 'settings', label: 'Settings' },
      { key: 'driftedSettings', label: 'Drifted', bad: true },
      { key: 'missingSettings', label: 'Missing', bad: true },
      { key: 'insecureValues', label: 'Insecure', bad: true },
    ],
  },
  vulnerability_scan: {
    label: 'Vulnerability scan results',
    short: 'Vulnerabilities',
    icon: Bug,
    hint: 'Scanner or penetration-test results (Nessus, Qualys, OpenVAS, tester spreadsheet).',
    headline: [
      { key: 'hosts', label: 'Hosts' },
      { key: 'critical', label: 'Critical', bad: true },
      { key: 'high', label: 'High', bad: true },
      { key: 'overdueVulnerabilities', label: 'Overdue', bad: true },
    ],
  },
  data_integrity: {
    label: 'Data integrity checks',
    short: 'Data integrity',
    icon: Database,
    hint: 'Any system extract (e.g. Dynafin vouchers) — choose the key, mandatory, sequence, amount, and date columns to test.',
    headline: [
      { key: 'rows', label: 'Rows' },
      { key: 'duplicateKeys', label: 'Duplicates', bad: true },
      { key: 'missingSequenceNumbers', label: 'Sequence gaps', bad: true },
      { key: 'missingValues', label: 'Missing values', bad: true },
      { key: 'totalDifference', label: 'Total difference', bad: true },
    ],
  },
};

export const SOURCE_LABELS: Record<AnalysisSource, string> = {
  upload: 'Uploaded export',
  iams: 'IAMS (live)',
  entra_id: 'Entra ID (live)',
  imoc: 'IMOC (live)',
};

export const SECURITY_TEST_TYPE_LABELS: Record<SecurityTestType, string> = {
  vulnerability_scan: 'Vulnerability scan',
  penetration_test: 'Penetration test',
  web_application_test: 'Web application test',
  red_team: 'Red team exercise',
  social_engineering: 'Social engineering',
};

export const SECURITY_TEST_STATUS_LABELS: Record<SecurityTestStatus, string> = {
  planned: 'Planned',
  authorised: 'Authorised',
  in_progress: 'Testing',
  reporting: 'Awaiting report',
  remediation: 'Remediation',
  closed: 'Closed',
  cancelled: 'Cancelled',
};

export const DOC_TYPE_LABELS: Record<SystemDocumentType, string> = {
  policy: 'Policy',
  procedure: 'Procedure',
  standard: 'Standard',
  architecture_diagram: 'Architecture diagram',
  network_diagram: 'Network diagram',
  process_manual: 'Process manual',
  bcp: 'Business continuity plan',
  drp: 'Disaster recovery plan',
  incident_response_plan: 'Incident response plan',
  contract: 'IT contract',
  sla: 'Service level agreement',
  other: 'Other',
};

export const DISPOSITION_LABELS: Record<string, string> = {
  open: 'Open',
  confirmed: 'Confirmed',
  false_positive: 'False positive',
  explained: 'Explained',
};

export const DECISION_LABELS: Record<string, string> = {
  pending: 'Pending',
  appropriate: 'Appropriate',
  revoke: 'Revoke',
  modify: 'Modify',
};

// ─────────────────────────────────────────────────────────────
// GBB's "System Audit Activities & Software Requirements" — each activity,
// what it requires, and where IAMS satisfies it. Rendered on the toolkit hub
// so evaluators can walk the checklist row by row.
// ─────────────────────────────────────────────────────────────

export interface CoverageLink {
  label: string;
  href: string;
  icon: LucideIcon;
  /** Permission needed to open the link; hidden otherwise. */
  permission?: string;
}

export interface SystemAuditActivity {
  number: number;
  title: string;
  requirements: string[];
  privilege: string;
  links: CoverageLink[];
}

export const SYSTEM_AUDIT_ACTIVITIES: SystemAuditActivity[] = [
  {
    number: 1,
    title: 'Risk assessment & planning',
    requirements: [
      'Identify and evaluate IT risks aligned with organisational objectives',
      'Plan audits around critical IT processes, systems, and controls',
      'Prioritise audits by risk impact and likelihood',
    ],
    privilege: 'Read-only access to configuration settings',
    links: [
      { label: 'Risk register (objectives, likelihood × impact)', href: '/risk', icon: ShieldAlert, permission: 'risk:read' },
      { label: 'Risk-ranked audit programme', href: '/audit/plans', icon: ClipboardCheck, permission: 'plan:read' },
      { label: 'Configuration baseline review', href: '/system-audit/analytics?type=configuration', icon: SlidersHorizontal, permission: 'sysaudit:read' },
    ],
  },
  {
    number: 2,
    title: 'Internal control evaluation',
    requirements: [
      'Review IT policies, procedures, and standards',
      'Test access, change, data-integrity, backup, and recovery controls',
      'Assess controls over infrastructure, applications, and operations',
    ],
    privilege: 'Access to audit logs and event monitoring tools',
    links: [
      { label: 'Event monitoring (security events, changes, exceptions)', href: '/system-audit/events', icon: Activity, permission: 'log:read' },
      { label: 'Change management review', href: '/system-audit/analytics?type=change_log', icon: GitPullRequest, permission: 'sysaudit:read' },
      { label: 'IT control library', href: '/audit/compliance', icon: ShieldCheck, permission: 'control:read' },
      { label: 'Policies & procedures library', href: '/system-audit/documentation?docType=policy', icon: BookOpen, permission: 'sysdoc:read' },
    ],
  },
  {
    number: 3,
    title: 'Compliance audits',
    requirements: [
      'Adherence to regulation (GDPR, NDPR, ISO standards, SOX)',
      'Compliance with internal IT governance frameworks',
      'Review IT contracts and third-party management',
    ],
    privilege: 'Access to audit logs and event monitoring tools',
    links: [
      { label: 'Framework coverage (ISO, NDPR, GDPR, SOX ITGC, COBIT)', href: '/audit/compliance', icon: ShieldCheck, permission: 'control:read' },
      { label: 'IT contracts & SLAs (expiry tracking)', href: '/system-audit/documentation?docType=contract', icon: FileText, permission: 'sysdoc:read' },
      { label: 'Audit trail', href: '/logs', icon: ScrollText, permission: 'log:read' },
    ],
  },
  {
    number: 4,
    title: 'Security audits',
    requirements: [
      'Evaluate firewall, intrusion detection, and antivirus controls',
      'Coordinate vulnerability and penetration testing',
      'Assess incident response and business continuity plans',
    ],
    privilege: 'User access review permissions (verify access rights and SoD without modifying)',
    links: [
      { label: 'User access reviews & segregation of duties', href: '/system-audit/access-reviews', icon: KeyRound, permission: 'sysaudit:read' },
      { label: 'Security testing (VAPT) coordination', href: '/system-audit/security-tests', icon: Bug, permission: 'sectest:read' },
      { label: 'Continuity & incident response plans', href: '/system-audit/documentation?docType=bcp', icon: LifeBuoy, permission: 'sysdoc:read' },
    ],
  },
  {
    number: 5,
    title: 'Data & system integrity review',
    requirements: [
      'Validate accuracy, completeness, and confidentiality of data',
      'Ensure integrity in financial and operational systems',
      'Monitor data backup and restoration',
    ],
    privilege: 'Incident management system access; report generation and export rights',
    links: [
      { label: 'Data integrity checks', href: '/system-audit/analytics?type=data_integrity', icon: FileCheck2, permission: 'sysaudit:read' },
      { label: 'Incident management review (IMOC)', href: '/system-audit/analytics?type=incident_log', icon: Siren, permission: 'sysaudit:read' },
      { label: 'Backup & restore verification', href: '/system-audit/analytics?type=backup_log', icon: HardDriveDownload, permission: 'sysaudit:read' },
      { label: 'Findings register export', href: '/audit/findings', icon: FileSearch, permission: 'finding:read' },
    ],
  },
  {
    number: 6,
    title: 'Audit reporting & follow-up',
    requirements: [
      'Document audit findings comprehensively',
      'Give actionable recommendations to IT management',
      'Track implementation of corrective measures',
    ],
    privilege: 'System documentation access (policies, architecture diagrams, process manuals)',
    links: [
      { label: 'System documentation library', href: '/system-audit/documentation', icon: BookOpen, permission: 'sysdoc:read' },
      { label: 'Findings & remediation follow-up', href: '/audit/findings', icon: FileSearch, permission: 'finding:read' },
      { label: 'Audit reviews (reports)', href: '/audit/reports', icon: FileText, permission: 'report:read' },
      { label: 'Evidence repository', href: '/audit/repository', icon: Archive, permission: 'evidence:read' },
    ],
  },
  {
    number: 7,
    title: 'Continuous monitoring',
    requirements: [
      'Automated ongoing risk and control monitoring',
      'Analyse IT logs, access records, and alerts for anomalies',
      'Stay abreast of emerging IT risks and trends',
    ],
    privilege: 'Limited access to backup and recovery systems (verify status without altering configuration)',
    links: [
      { label: 'Continuous monitoring dashboard', href: '/system-audit/monitoring', icon: Gauge, permission: 'sysaudit:read' },
      { label: 'Security log anomaly analysis', href: '/system-audit/analytics?type=security_event_log', icon: Radar, permission: 'sysaudit:read' },
      { label: 'Backup status & recovery tests', href: '/system-audit/analytics?type=backup_log', icon: HardDriveDownload, permission: 'sysaudit:read' },
    ],
  },
];
