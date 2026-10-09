"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.emptyChecklistProgress = exports.CONTROL_SETS = exports.REPORT_EDITABLE_STATUSES = exports.WP_REVIEWABLE_STATUSES = exports.PLAN_EDITABLE_STATUSES = exports.PLAN_TRANSITIONS = exports.FINDING_TRANSITIONS = exports.ENGAGEMENT_TRANSITIONS = exports.parseReferenceSequence = exports.buildReferenceNumber = exports.stringify = exports.parseJson = exports.decimalToNumber = exports.toIso = exports.assertTransition = exports.isFindingAuditee = exports.isFindingOversight = exports.assertHasPermission = exports.auditTypeLabel = void 0;
const app_error_1 = require("../../../shared/errors/app.error");
const audit_enum_1 = require("../domain/enum/audit.enum");
/** Human-readable audit-type names, for messages shown back to the user.
 *  `systems` was merged into `it` and only appears on pre-merge records. */
const AUDIT_TYPE_LABELS = {
    it: 'System/IT',
    systems: 'System/IT',
    financial: 'Financial',
    compliance: 'Compliance',
};
const auditTypeLabel = (auditType) => AUDIT_TYPE_LABELS[auditType] ?? auditType;
exports.auditTypeLabel = auditTypeLabel;
const assertHasPermission = (permissions, required, message = 'Insufficient permission for this action') => {
    if (!permissions.includes(required)) {
        throw app_error_1.AppError.forbidden(message);
    }
};
exports.assertHasPermission = assertHasPermission;
/**
 * How a viewer is scoped when reading findings. Mirrors the dashboard's
 * isRestrictedAuditee/isRestrictedAuditor semantics so finding visibility and
 * dashboard metrics agree.
 *
 * - oversight (`finding:read_all`)         → every finding
 * - auditee (this helper)                  → only findings assigned to them
 * - field auditor (neither of the above)   → engagements they lead / are assigned to
 *
 * An auditee is identified by `followup:respond` (auditee-exclusive) OR a lack
 * of engagement visibility — NOT by the absence of `engagement:read` alone,
 * because the seeded `auditee` role does hold `engagement:read`.
 */
const isFindingOversight = (permissions) => permissions.includes('finding:read_all');
exports.isFindingOversight = isFindingOversight;
const isFindingAuditee = (permissions) => !permissions.includes('finding:read_all') &&
    (permissions.includes('followup:respond') || !permissions.includes('engagement:read'));
exports.isFindingAuditee = isFindingAuditee;
const assertTransition = (current, next, transitions, entityName) => {
    if (!transitions[current]?.includes(next)) {
        throw app_error_1.AppError.badRequest(`Invalid ${entityName} status transition from '${current}' to '${next}'`);
    }
};
exports.assertTransition = assertTransition;
const toIso = (value) => value ? value.toISOString() : null;
exports.toIso = toIso;
const decimalToNumber = (value) => value === null ? null : Number(value.toString());
exports.decimalToNumber = decimalToNumber;
const parseJson = (value) => value ? JSON.parse(value) : null;
exports.parseJson = parseJson;
const stringify = (value) => typeof value === 'string' ? value : JSON.stringify(value, null, 2);
exports.stringify = stringify;
const buildReferenceNumber = (year, sequence) => `AUD-${year}-${String(sequence).padStart(3, '0')}`;
exports.buildReferenceNumber = buildReferenceNumber;
const parseReferenceSequence = (referenceNumber, year) => {
    const prefix = `AUD-${year}-`;
    if (!referenceNumber.startsWith(prefix))
        return 0;
    const value = Number(referenceNumber.slice(prefix.length));
    return Number.isInteger(value) ? value : 0;
};
exports.parseReferenceSequence = parseReferenceSequence;
exports.ENGAGEMENT_TRANSITIONS = {
    [audit_enum_1.EngagementStatus.Planned]: [audit_enum_1.EngagementStatus.InProgress],
    [audit_enum_1.EngagementStatus.InProgress]: [audit_enum_1.EngagementStatus.UnderReview],
    [audit_enum_1.EngagementStatus.UnderReview]: [audit_enum_1.EngagementStatus.Reported],
    [audit_enum_1.EngagementStatus.Reported]: [audit_enum_1.EngagementStatus.Closed],
    [audit_enum_1.EngagementStatus.Closed]: [],
};
exports.FINDING_TRANSITIONS = {
    [audit_enum_1.FindingStatus.Open]: [audit_enum_1.FindingStatus.ManagementResponseReceived],
    [audit_enum_1.FindingStatus.ManagementResponseReceived]: [audit_enum_1.FindingStatus.InRemediation],
    [audit_enum_1.FindingStatus.InRemediation]: [audit_enum_1.FindingStatus.Verified],
    [audit_enum_1.FindingStatus.Verified]: [],
    [audit_enum_1.FindingStatus.PendingClosure]: [],
    [audit_enum_1.FindingStatus.Closed]: [],
};
exports.PLAN_TRANSITIONS = {
    [audit_enum_1.PlanStatus.Draft]: [audit_enum_1.PlanStatus.Submitted],
    [audit_enum_1.PlanStatus.Submitted]: [audit_enum_1.PlanStatus.Approved, audit_enum_1.PlanStatus.Rejected],
    [audit_enum_1.PlanStatus.Approved]: [],
    // A rejected plan is revised and re-submitted (draft-equivalent), restarting the approval chain.
    [audit_enum_1.PlanStatus.Rejected]: [audit_enum_1.PlanStatus.Submitted],
};
/** Plans whose content may be changed and which may be (re)submitted for approval. */
exports.PLAN_EDITABLE_STATUSES = [
    audit_enum_1.PlanStatus.Draft,
    audit_enum_1.PlanStatus.Rejected,
];
exports.WP_REVIEWABLE_STATUSES = [
    audit_enum_1.WorkingPaperStatus.Draft,
    audit_enum_1.WorkingPaperStatus.Rejected,
];
exports.REPORT_EDITABLE_STATUSES = [
    audit_enum_1.ReportStatus.Draft,
    audit_enum_1.ReportStatus.Rejected,
];
exports.CONTROL_SETS = {
    [audit_enum_1.AuditType.It]: [
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
        {
            controlReference: 'ISO27001-A.5.1',
            controlDescription: 'IT and information security policies, procedures, and standards are defined, approved by management, communicated, and reviewed at planned intervals.',
            testProcedure: 'Inspect the policy set in the System Documentation library, verify approval and version history, confirm each policy is within its review date, and assess adequacy against current systems and regulations.',
        },
        {
            controlReference: 'ISO27001-A.5.37',
            controlDescription: 'Operating procedures for information processing facilities are documented and made available to personnel who need them.',
            testProcedure: 'Sample operational procedures and process manuals for in-scope systems, confirm they are current and accessible, and compare documented steps against observed practice.',
        },
        {
            controlReference: 'ISO27001-A.5.3',
            controlDescription: 'Conflicting duties and areas of responsibility are segregated to reduce the risk of unauthorised or unintentional modification or misuse of assets.',
            testProcedure: 'Run a User Access Review with segregation-of-duties rules over in-scope systems, investigate every conflict, and confirm that unavoidable conflicts have documented compensating controls.',
        },
        {
            controlReference: 'ISO27001-A.5.18',
            controlDescription: 'Access rights to information and systems are provisioned, periodically reviewed, adjusted, and removed in line with the access control policy.',
            testProcedure: 'Obtain a current user access listing, reconcile it against the HR/directory record, confirm leavers and disabled accounts hold no active access, and verify evidence of the latest periodic access review.',
        },
        {
            controlReference: 'ISO27001-A.8.2',
            controlDescription: 'Allocation and use of privileged access rights are restricted, managed, and monitored.',
            testProcedure: 'Identify all privileged and administrator accounts, verify each has documented approval and business need, and review privileged activity logs for unusual use.',
        },
        {
            controlReference: 'ISO27001-A.8.9',
            controlDescription: 'Configurations, including security configurations, of hardware, software, services, and networks are established, documented, implemented, monitored, and reviewed.',
            testProcedure: 'Compare current configuration exports of in-scope systems against the approved baseline, investigate every deviation, and confirm deviations were approved through change management.',
        },
        {
            controlReference: 'ISO27001-A.8.7',
            controlDescription: 'Protection against malware (anti-virus / endpoint protection) is implemented, kept up to date, and supported by user awareness.',
            testProcedure: 'Review endpoint protection console coverage against the asset inventory, check signature and engine update status, and sample malware alerts for timely response.',
        },
        {
            controlReference: 'ISO27001-A.8.15',
            controlDescription: 'Logs recording user activities, exceptions, faults, and other relevant events are produced, stored, protected, and analysed.',
            testProcedure: 'Confirm logging is enabled for in-scope systems, verify log retention and protection from alteration, and analyse a log extract for anomalies such as repeated failed logins or out-of-hours privileged activity.',
        },
        {
            controlReference: 'ISO27001-A.5.7',
            controlDescription: 'Information relating to information security threats is collected and analysed to produce threat intelligence and to track emerging IT risks.',
            testProcedure: 'Review threat-intelligence sources and advisories consumed, confirm relevant threats are assessed into the risk register, and verify emerging risks are reported to management.',
        },
        {
            controlReference: 'ISO27001-A.5.24',
            controlDescription: 'Information security incident management is planned and prepared, with defined processes, roles, and responsibilities.',
            testProcedure: 'Inspect the incident response plan, confirm roles and escalation contacts are current, and verify the plan was tested or exercised within the last year.',
        },
        {
            controlReference: 'ISO27001-A.5.26',
            controlDescription: 'Information security incidents are responded to in accordance with documented procedures and resolved within agreed timelines.',
            testProcedure: 'Analyse the incident log for response and resolution times against SLA, sample incidents for root-cause analysis and lessons learned, and confirm unresolved incidents are escalated.',
        },
        {
            controlReference: 'ISO27001-A.5.30',
            controlDescription: 'ICT readiness is planned, implemented, maintained, and tested based on business continuity objectives and ICT continuity requirements.',
            testProcedure: 'Review the ICT continuity and disaster recovery plans, compare achieved RTO/RPO in the latest recovery tests against targets, and confirm failed tests were remediated.',
        },
        {
            controlReference: 'SYS-DR-002',
            controlDescription: 'Backup restoration is tested at defined intervals, and recovery test results — including achieved recovery time — are recorded and reviewed.',
            testProcedure: 'Analyse the backup job log for failed or missed jobs, review restore-test records for the last 12 months, and confirm every failed restore test has a documented corrective action.',
        },
        {
            controlReference: 'SYS-DATA-001',
            controlDescription: 'Input, processing, and output controls — validation, reconciliations, and error handling — ensure data in financial and operational systems is complete, accurate, and valid.',
            testProcedure: 'Run data integrity analytics over a system extract (duplicates, missing mandatory fields, sequence gaps, control totals) and investigate every exception with the system owner.',
        },
        {
            controlReference: 'ISO27001-A.8.24',
            controlDescription: 'Cryptography, including encryption of sensitive data at rest and in transit, is used effectively and supported by key management.',
            testProcedure: 'Review encryption configuration for systems holding confidential data, verify TLS versions for data in transit, and inspect key management and rotation records.',
        },
        {
            controlReference: 'ISO27001-A.5.19',
            controlDescription: 'Processes are defined and implemented to manage the information security risks associated with suppliers and third-party service providers.',
            testProcedure: 'Obtain the list of IT suppliers, confirm each critical supplier had a security risk assessment, and verify due diligence was completed before onboarding.',
        },
        {
            controlReference: 'ISO27001-A.5.20',
            controlDescription: 'IT contracts and supplier agreements contain the relevant information security, confidentiality, service-level, and right-to-audit requirements.',
            testProcedure: 'Sample IT contracts from the System Documentation library, check for security, confidentiality, SLA, and right-to-audit clauses, and flag expired or soon-to-expire contracts.',
        },
        {
            controlReference: 'ISO27001-A.5.22',
            controlDescription: 'Supplier service delivery and changes to supplier services are regularly monitored, reviewed, and evaluated.',
            testProcedure: 'Review supplier performance reports against contracted SLAs, confirm service reviews took place, and verify changes to supplier services were risk-assessed.',
        },
        {
            controlReference: 'PCIDSS-11.4',
            controlDescription: 'External and internal penetration testing is performed at least annually and after significant change, and exploitable vulnerabilities are corrected and retested.',
            testProcedure: 'Review the security testing schedule, confirm tests were authorised with agreed rules of engagement, and trace critical and high results to remediation and retest evidence.',
        },
        {
            controlReference: 'SOX-ITGC-AC',
            controlDescription: 'Access to programs and data is restricted to authorised users through provisioning, periodic review, privileged access control, and timely removal of leavers (SOX ITGC — Access).',
            testProcedure: 'Perform a user access review over financially significant systems, test provisioning approvals for new users, and confirm leavers were removed within the policy timeline.',
        },
        {
            controlReference: 'SOX-ITGC-PC',
            controlDescription: 'Program changes are authorised, tested, approved, and migrated to production by personnel independent of development (SOX ITGC — Program Change).',
            testProcedure: 'Analyse the change log for changes without approval, approvals after implementation, and implementers who also approved; sample changes for test and rollback evidence.',
        },
        {
            controlReference: 'SOX-ITGC-PD',
            controlDescription: 'New systems and major enhancements follow a controlled development and acquisition lifecycle, including validated data conversion (SOX ITGC — Program Development).',
            testProcedure: 'Inspect project documentation for recent implementations, verify user acceptance testing sign-off, and confirm data conversion was reconciled and approved.',
        },
        {
            controlReference: 'SOX-ITGC-CO',
            controlDescription: 'Computer operations — job scheduling, backup and recovery, and incident management — are monitored so processing is complete and accurate (SOX ITGC — Computer Operations).',
            testProcedure: 'Review batch job and backup logs for failures and their resolution, and trace a sample of operational incidents to timely closure.',
        },
    ],
    [audit_enum_1.AuditType.Financial]: [
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
    [audit_enum_1.AuditType.Compliance]: [
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
        {
            controlReference: 'GDPR-ART5',
            controlDescription: 'Personal data is processed lawfully, fairly, and transparently, limited to its purpose, minimised, accurate, kept no longer than necessary, and the controller can demonstrate accountability (GDPR Art. 5).',
            testProcedure: 'Review the data inventory against stated purposes, sample records for accuracy and retention compliance, and confirm accountability documentation is maintained.',
        },
        {
            controlReference: 'GDPR-ART28',
            controlDescription: 'Processors act only under a written contract that sets out processing instructions, confidentiality, security, and audit rights (GDPR Art. 28).',
            testProcedure: 'Sample third-party contracts involving personal data and confirm each contains the mandatory processor clauses, including security obligations and audit rights.',
        },
        {
            controlReference: 'GDPR-ART30',
            controlDescription: 'A record of processing activities is maintained and kept current (GDPR Art. 30).',
            testProcedure: 'Inspect the record of processing activities, confirm it covers in-scope systems, and verify it was reviewed after recent system or process changes.',
        },
        {
            controlReference: 'GDPR-ART32',
            controlDescription: 'Appropriate technical and organisational measures ensure the confidentiality, integrity, availability, and resilience of processing systems, with regular testing of their effectiveness (GDPR Art. 32).',
            testProcedure: 'Review encryption, access control, backup, and restore-test evidence for systems processing personal data, and confirm security measures are tested periodically.',
        },
        {
            controlReference: 'GDPR-ART33',
            controlDescription: 'Personal data breaches are documented and notified to the supervisory authority within 72 hours where required (GDPR Art. 33).',
            testProcedure: 'Review the incident log for personal data breaches, verify notification timelines against the 72-hour requirement, and confirm a breach register is maintained.',
        },
        {
            controlReference: 'GDPR-ART35',
            controlDescription: 'Data protection impact assessments are carried out before high-risk processing begins (GDPR Art. 35).',
            testProcedure: 'Identify new or changed high-risk processing in the audit period, and confirm a DPIA was completed and approved before go-live.',
        },
    ],
    [audit_enum_1.AuditType.Systems]: [
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
// GBB merged the separate IT and Systems audit modules into one System/IT
// domain, so the merged domain tests the union of both control sets. The
// Systems key is left in place so engagements created before the merge still
// resolve their checklist controls.
exports.CONTROL_SETS[audit_enum_1.AuditType.It] = [
    ...exports.CONTROL_SETS[audit_enum_1.AuditType.It],
    ...exports.CONTROL_SETS[audit_enum_1.AuditType.Systems],
];
const emptyChecklistProgress = () => ({
    [audit_enum_1.ChecklistResult.Passed]: 0,
    [audit_enum_1.ChecklistResult.Failed]: 0,
    [audit_enum_1.ChecklistResult.NotApplicable]: 0,
    [audit_enum_1.ChecklistResult.NotTested]: 0,
});
exports.emptyChecklistProgress = emptyChecklistProgress;
//# sourceMappingURL=audit.utility.js.map