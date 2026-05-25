"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.emptyChecklistProgress = exports.CONTROL_SETS = exports.REPORT_EDITABLE_STATUSES = exports.WP_REVIEWABLE_STATUSES = exports.PLAN_TRANSITIONS = exports.FINDING_TRANSITIONS = exports.ENGAGEMENT_TRANSITIONS = exports.parseReferenceSequence = exports.buildReferenceNumber = exports.stringify = exports.parseJson = exports.decimalToNumber = exports.toIso = exports.assertTransition = exports.assertHasPermission = exports.assertHasRole = exports.hasAuditeeRole = exports.AUDITEE_ROLE = exports.AUDIT_WORK_ROLES = exports.AUDIT_REVIEW_ROLES = exports.AUDIT_ADMIN_ROLES = void 0;
const app_error_1 = require("../../../shared/errors/app.error");
const audit_enum_1 = require("../domain/enum/audit.enum");
exports.AUDIT_ADMIN_ROLES = ['super_admin', 'audit_admin', 'audit_manager', 'cae'];
exports.AUDIT_REVIEW_ROLES = ['super_admin', 'audit_admin', 'audit_manager', 'audit_lead'];
exports.AUDIT_WORK_ROLES = ['super_admin', 'audit_admin', 'audit_manager', 'audit_lead', 'auditor'];
exports.AUDITEE_ROLE = 'auditee';
const hasAuditeeRole = (roles) => roles.includes(exports.AUDITEE_ROLE);
exports.hasAuditeeRole = hasAuditeeRole;
const assertHasRole = (roles, allowedRoles, message = 'Insufficient role for this audit action') => {
    if (!roles.some((role) => allowedRoles.includes(role))) {
        throw app_error_1.AppError.forbidden(message);
    }
};
exports.assertHasRole = assertHasRole;
/**
 * Permission-based authorization gate. Prefer this over assertHasRole so that
 * roles remain fully customizable in Settings — a user is authorized by the
 * permissions their role(s) grant, never by a hardcoded role name. super_admin
 * is seeded with every permission slug, so it continues to pass.
 */
const assertHasPermission = (permissions, required, message = 'Insufficient permission for this action') => {
    if (!permissions.includes(required)) {
        throw app_error_1.AppError.forbidden(message);
    }
};
exports.assertHasPermission = assertHasPermission;
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
    [audit_enum_1.FindingStatus.Verified]: [audit_enum_1.FindingStatus.Closed],
    [audit_enum_1.FindingStatus.Closed]: [],
};
exports.PLAN_TRANSITIONS = {
    [audit_enum_1.PlanStatus.Draft]: [audit_enum_1.PlanStatus.Submitted],
    [audit_enum_1.PlanStatus.Submitted]: [audit_enum_1.PlanStatus.Approved, audit_enum_1.PlanStatus.Rejected],
    [audit_enum_1.PlanStatus.Approved]: [],
    [audit_enum_1.PlanStatus.Rejected]: [],
};
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
    ],
};
const emptyChecklistProgress = () => ({
    [audit_enum_1.ChecklistResult.Passed]: 0,
    [audit_enum_1.ChecklistResult.Failed]: 0,
    [audit_enum_1.ChecklistResult.NotApplicable]: 0,
    [audit_enum_1.ChecklistResult.NotTested]: 0,
});
exports.emptyChecklistProgress = emptyChecklistProgress;
//# sourceMappingURL=audit.utility.js.map