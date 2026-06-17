import { Prisma } from '@prisma/client';
import { AppError } from '../../../shared/errors/app.error';
import {
  AuditType,
  ChecklistResult,
  EngagementStatus,
  FindingStatus,
  PlanStatus,
  ReportStatus,
  WorkingPaperStatus,
} from '../domain/enum/audit.enum';

export const assertHasPermission = (
  permissions: string[],
  required: string,
  message = 'Insufficient permission for this action',
): void => {
  if (!permissions.includes(required)) {
    throw AppError.forbidden(message);
  }
};

export const assertTransition = <TStatus extends string>(
  current: TStatus,
  next: TStatus,
  transitions: Partial<Record<TStatus, readonly TStatus[]>>,
  entityName: string,
): void => {
  if (!transitions[current]?.includes(next)) {
    throw AppError.badRequest(`Invalid ${entityName} status transition from '${current}' to '${next}'`);
  }
};

export const toIso = (value: Date | null): string | null =>
  value ? value.toISOString() : null;

export const decimalToNumber = (value: Prisma.Decimal | null): number | null =>
  value === null ? null : Number(value.toString());

export const parseJson = (value: string | null): unknown =>
  value ? JSON.parse(value) : null;

export const stringify = (value: unknown): string =>
  typeof value === 'string' ? value : JSON.stringify(value, null, 2);

export const buildReferenceNumber = (year: number, sequence: number): string =>
  `AUD-${year}-${String(sequence).padStart(3, '0')}`;

export const parseReferenceSequence = (referenceNumber: string, year: number): number => {
  const prefix = `AUD-${year}-`;
  if (!referenceNumber.startsWith(prefix)) return 0;
  const value = Number(referenceNumber.slice(prefix.length));
  return Number.isInteger(value) ? value : 0;
};

export const ENGAGEMENT_TRANSITIONS: Record<EngagementStatus, readonly EngagementStatus[]> = {
  [EngagementStatus.Planned]: [EngagementStatus.InProgress],
  [EngagementStatus.InProgress]: [EngagementStatus.UnderReview],
  [EngagementStatus.UnderReview]: [EngagementStatus.Reported],
  [EngagementStatus.Reported]: [EngagementStatus.Closed],
  [EngagementStatus.Closed]: [],
};

export const FINDING_TRANSITIONS: Record<FindingStatus, readonly FindingStatus[]> = {
  [FindingStatus.Open]: [FindingStatus.ManagementResponseReceived],
  [FindingStatus.ManagementResponseReceived]: [FindingStatus.InRemediation],
  [FindingStatus.InRemediation]: [FindingStatus.Verified],
  [FindingStatus.Verified]: [],
  [FindingStatus.PendingClosure]: [],
  [FindingStatus.Closed]: [],
};

export const PLAN_TRANSITIONS: Record<PlanStatus, readonly PlanStatus[]> = {
  [PlanStatus.Draft]: [PlanStatus.Submitted],
  [PlanStatus.Submitted]: [PlanStatus.Approved, PlanStatus.Rejected],
  [PlanStatus.Approved]: [],
  [PlanStatus.Rejected]: [],
};

export const WP_REVIEWABLE_STATUSES: readonly WorkingPaperStatus[] = [
  WorkingPaperStatus.Draft,
  WorkingPaperStatus.Rejected,
] as const;

export const REPORT_EDITABLE_STATUSES: readonly ReportStatus[] = [
  ReportStatus.Draft,
  ReportStatus.Rejected,
] as const;

export const CONTROL_SETS: Record<AuditType, Array<{
  controlReference: string;
  controlDescription: string;
  testProcedure: string;
}>> = {
  [AuditType.It]: [
    {
      controlReference: 'ISO27001-A.5.15',
      controlDescription: 'Access control rules are established, documented, and periodically reviewed for all GBB information assets.',
      testProcedure: 'Inspect the access control policy, sample recent user access listings across core systems, and verify evidence of formal management approval and quarterly access reviews.',
    },
    {
      controlReference: 'ISO27001-A.8.13',
      controlDescription: 'System backups of database logs, configurations, and critical data are maintained, secured, and regularly tested.',
      testProcedure: 'Review backup policies and schedules, inspect automated job logs for success rates, and review documentation for recent data restoration exercises.',
    },
    {
      controlReference: 'ISO27001-A.8.16',
      controlDescription: 'Security event logs are collected, analyzed, and monitored to detect anomalous network activities and system events.',
      testProcedure: 'Inspect SIEM dashboards and monitoring configurations, verify log retention periods, and check evidence of timely response to high-priority security alerts.',
    },
    {
      controlReference: 'ISO27001-A.8.20',
      controlDescription: 'Network controls, firewall rules, and remote access systems are managed to secure GBB systems and data.',
      testProcedure: 'Review the firewall rule review schedule, verify segments separating production from testing environments, and inspect VPN multi-factor authorization logs.',
    },
    {
      controlReference: 'ISO27001-A.8.8',
      controlDescription: 'Vulnerabilities in systems, software, and packages are proactively scanned, analyzed, and patched according to risk ratings.',
      testProcedure: 'Inspect recent vulnerability scan reports, review patch management schedules, and trace high-risk vulnerabilities to evidence of mitigation within SLA limits.',
    },
    {
      controlReference: 'ISO27001-A.8.25',
      controlDescription: 'Secure development practices, code quality guidelines, and static code analysis (SAST) are implemented for all internal software.',
      testProcedure: 'Review developers coding guidelines, inspect automated security scans within the CI/CD pipeline, and check code review approval records.',
    },
    {
      controlReference: 'PCIDSS-3.4',
      controlDescription: 'Stored cardholder data is rendered unreadable through strong cryptography, with documented key management procedures.',
      testProcedure: 'Inspect data-at-rest encryption configurations for systems storing cardholder data, review key management and rotation procedures, and sample stored records to confirm the PAN is masked or encrypted.',
    },
    {
      controlReference: 'PCIDSS-8.3',
      controlDescription: 'Access to systems handling cardholder data enforces multi-factor authentication and unique user identification.',
      testProcedure: 'Review authentication configurations for in-scope systems, verify MFA is enforced for all administrative and remote access, and confirm shared or generic accounts are disabled.',
    },
    {
      controlReference: 'PCIDSS-10.2',
      controlDescription: 'Audit trails record all individual access to cardholder data and are protected from alteration.',
      testProcedure: 'Inspect logging configuration on cardholder-data systems, verify log integrity protection and retention periods, and trace a sample of access events to the audit trail.',
    },
    {
      controlReference: 'NIST-CSF-ID.AM',
      controlDescription: 'Physical devices, software platforms, and data flows within GBB are inventoried to support asset management (NIST CSF Identify).',
      testProcedure: 'Review the asset inventory, sample assets against physical and logical records, and verify data-flow documentation is current and approved.',
    },
    {
      controlReference: 'NIST-CSF-PR.AC',
      controlDescription: 'Identities and credentials are issued, managed, and revoked for authorized devices and users (NIST CSF Protect).',
      testProcedure: 'Sample joiner, mover, and leaver records, verify timely provisioning and de-provisioning, and confirm least-privilege access assignment.',
    },
    {
      controlReference: 'NIST-CSF-DE.CM',
      controlDescription: 'Networks and systems are continuously monitored to detect potential cybersecurity events (NIST CSF Detect).',
      testProcedure: 'Inspect monitoring and detection tooling coverage, review alerting thresholds, and verify evidence that detections are investigated within defined timeframes.',
    },
  ],
  [AuditType.Financial]: [
    {
      controlReference: 'FIN-AP-001',
      controlDescription: 'Financial payment approvals are strictly segregated from payment preparation (maker-checker controls).',
      testProcedure: 'Sample recent payment transactions from the ERP system and verify that the preparing staff and approving manager are distinct individuals.',
    },
    {
      controlReference: 'FIN-REC-001',
      controlDescription: 'Bank and ledger reconciliations are prepared monthly, documented, and independently reviewed by financial managers.',
      testProcedure: 'Inspect a sample of monthly bank reconciliation statements, verify reconciling items have tracking status, and confirm signature evidence of independent review.',
    },
    {
      controlReference: 'FIN-FA-001',
      controlDescription: 'Fixed assets are recorded in the register, physically tagged, and verified through annual physical audits.',
      testProcedure: 'Trace a sample of equipment from the fixed assets register to their physical locations, check asset tag matches, and review the latest physical stocktake report.',
    },
  ],
  [AuditType.Compliance]: [
    {
      controlReference: 'ISO9001-9.2',
      controlDescription: 'Internal quality audits are planned, scheduled, and conducted independently to evaluate Quality Management System compliance.',
      testProcedure: 'Inspect the QMS annual audit plan, review audit reports, check auditor independence, and verify that findings were presented to the quality committee.',
    },
    {
      controlReference: 'ISO9001-10.2',
      controlDescription: 'Nonconformities and customer complaints are logged, analyzed for root cause, and resolved with documented corrective actions.',
      testProcedure: 'Review the complaints registry, sample nonconformities, inspect root cause analyses, and check evidence of follow-up validation audits.',
    },
    {
      controlReference: 'ISO9001-7.2',
      controlDescription: 'Personnel competencies, certifications, and required training programs are planned, tracked, and documented.',
      testProcedure: 'Inspect training plans, review job descriptions against staff qualification certificates, and sample training completion logs.',
    },
    {
      controlReference: 'ISO22301-8.2',
      controlDescription: 'Business Impact Analysis (BIA) and risk assessments are periodically updated to define recovery priorities (RTO & RPO).',
      testProcedure: 'Review the latest BIA document, check alignment of recovery priorities with GBB business goals, and confirm executive approval of operational thresholds.',
    },
    {
      controlReference: 'ISO22301-8.4',
      controlDescription: 'Business Continuity Plans (BCP) and incident response procedures are established, documented, and made accessible.',
      testProcedure: 'Inspect the BCP document, verify contacts listing of the crisis management team, and check availability of plans to key staff.',
    },
    {
      controlReference: 'ISO22301-8.5',
      controlDescription: 'Business continuity plans and disaster recovery procedures are tested annually through simulated exercises.',
      testProcedure: 'Inspect the business continuity exercise schedule, review the latest post-exercise test report, and check evidence of remediation for failures.',
    },
    {
      controlReference: 'NDPR-PRIV-001',
      controlDescription: 'Personal data processing activities have a documented lawful basis, privacy notices, and consent registries under NDPR.',
      testProcedure: 'Inspect GBB privacy notices on public portals, review internal data inventories, check data processing consent logs, and verify DPO audit filing records.',
    },
    {
      controlReference: 'NDPR-PRIV-002',
      controlDescription: 'Data subject rights — access, rectification, erasure, and objection — are supported through documented, time-bound request handling procedures.',
      testProcedure: 'Inspect the data subject request procedure, sample fulfilled requests, and verify responses were provided within statutory timelines with evidence retained.',
    },
    {
      controlReference: 'NDPR-NITDA-001',
      controlDescription: 'GBB meets its NITDA obligations under the NDPR, including the annual data protection audit filing and engagement of a licensed Data Protection Compliance Organisation (DPCO).',
      testProcedure: 'Verify the most recent NITDA data protection audit was filed within the deadline, confirm DPCO engagement records, and review evidence of remediation of prior filing observations.',
    },
    {
      controlReference: 'ISO31000-6.4',
      controlDescription: 'Risks are systematically identified, analyzed, and evaluated against defined criteria within the enterprise risk management process (ISO 31000 Risk Assessment).',
      testProcedure: 'Review the risk management framework and risk register, verify risks are scored against documented criteria, and confirm evaluation outcomes drive treatment decisions.',
    },
    {
      controlReference: 'ISO31000-6.5',
      controlDescription: 'Risk treatment plans are selected, implemented, and tracked to reduce risks to acceptable levels (ISO 31000 Risk Treatment).',
      testProcedure: 'Sample risks with treatment plans, verify owners and target dates, and confirm evidence that residual risk is monitored against the defined risk appetite.',
    },
    {
      controlReference: 'ISO31000-6.6',
      controlDescription: 'Risk management performance is monitored, reviewed, and reported to governance bodies at defined intervals (ISO 31000 Monitoring & Review).',
      testProcedure: 'Inspect risk reporting to management and the board, verify review frequency against policy, and confirm actions arising are tracked to closure.',
    },
  ],
  [AuditType.Systems]: [
    {
      controlReference: 'SYS-INF-001',
      controlDescription: 'Baseline configurations for infrastructure, databases, and network devices are defined, approved, and monitored for drift.',
      testProcedure: 'Inspect documented server baseline guidelines, compare a sample of production configurations against baselines, and review unauthorized change alerts.',
    },
    {
      controlReference: 'SYS-CHG-001',
      controlDescription: 'Changes to production systems require formal Change Advisory Board (CAB) review, test reports, and rollback plans.',
      testProcedure: 'Sample change tickets, verify CAB approval signatures, check test environment logs, and confirm a documented and tested rollback procedure was attached.',
    },
    {
      controlReference: 'SYS-DR-001',
      controlDescription: 'Disaster recovery environments match production setups and support live database replication with minimal lag.',
      testProcedure: 'Inspect database replication dashboards, check replication lag metrics, and review the latest live DR switchover/failover test report.',
    },
    {
      controlReference: 'SYS-CAP-001',
      controlDescription: 'System utilization, bandwidth, CPU, and storage performance are monitored to forecast capacity requirements.',
      testProcedure: 'Review recent capacity monitoring reports, check automated threshold warnings, and inspect documented scaling and upgrades plans.',
    },
    {
      controlReference: 'ISO20000-8.6.1',
      controlDescription: 'Incident and service request management procedures ensure timely recording, prioritization, and resolution against agreed SLAs (ISO 20000 Service Management).',
      testProcedure: 'Sample incident and service-request tickets from the ITSM system, verify SLA timers and prioritization, and confirm resolution and closure evidence.',
    },
    {
      controlReference: 'ISO20000-8.7.1',
      controlDescription: 'Service level agreements are defined, documented, and reviewed against actual service performance (ISO 20000 Service Level Management).',
      testProcedure: 'Inspect the SLA catalogue, review the latest service performance reports against SLA targets, and confirm evidence of management review of breaches.',
    },
    {
      controlReference: 'COBIT-APO13',
      controlDescription: 'A security management system is established and maintained to govern information security in line with enterprise objectives (COBIT Managed Security).',
      testProcedure: 'Review the ISMS governance documentation, verify alignment of security objectives to enterprise goals, and inspect management review minutes.',
    },
    {
      controlReference: 'COBIT-BAI06',
      controlDescription: 'IT changes are managed through a controlled process covering assessment, authorization, and tracking (COBIT Managed IT Changes).',
      testProcedure: 'Sample change records, verify impact assessment and authorization, and confirm emergency changes followed the defined exception process.',
    },
  ],
};

export const emptyChecklistProgress = (): Record<ChecklistResult, number> => ({
  [ChecklistResult.Passed]: 0,
  [ChecklistResult.Failed]: 0,
  [ChecklistResult.NotApplicable]: 0,
  [ChecklistResult.NotTested]: 0,
});
