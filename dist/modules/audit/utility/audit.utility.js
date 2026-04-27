"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.emptyChecklistProgress = exports.CONTROL_SETS = exports.REPORT_EDITABLE_STATUSES = exports.WP_REVIEWABLE_STATUSES = exports.PLAN_TRANSITIONS = exports.FINDING_TRANSITIONS = exports.ENGAGEMENT_TRANSITIONS = exports.parseReferenceSequence = exports.buildReferenceNumber = exports.stringify = exports.parseJson = exports.decimalToNumber = exports.toIso = exports.assertTransition = exports.assertHasRole = exports.hasAuditeeRole = exports.AUDITEE_ROLE = exports.AUDIT_WORK_ROLES = exports.AUDIT_REVIEW_ROLES = exports.AUDIT_ADMIN_ROLES = void 0;
const app_error_1 = require("../../../shared/errors/app.error");
const audit_enum_1 = require("../domain/enum/audit.enum");
exports.AUDIT_ADMIN_ROLES = ['super_admin', 'audit_admin'];
exports.AUDIT_REVIEW_ROLES = ['super_admin', 'audit_admin', 'audit_lead'];
exports.AUDIT_WORK_ROLES = ['super_admin', 'audit_admin', 'audit_lead', 'auditor'];
exports.AUDITEE_ROLE = 'auditee';
const hasAuditeeRole = (roles) => roles.includes(exports.AUDITEE_ROLE);
exports.hasAuditeeRole = hasAuditeeRole;
const assertHasRole = (roles, allowedRoles, message = 'Insufficient role for this audit action') => {
    if (!roles.some((role) => allowedRoles.includes(role))) {
        throw app_error_1.AppError.forbidden(message);
    }
};
exports.assertHasRole = assertHasRole;
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
            controlDescription: 'Access control rules are established and enforced for information assets.',
            testProcedure: 'Inspect access control policy, review user access listings, and sample approval evidence.',
        },
        {
            controlReference: 'ISO27001-A.8.16',
            controlDescription: 'Monitoring activities detect anomalous events in systems and networks.',
            testProcedure: 'Review monitoring coverage, alert handling records, and sample incident escalation evidence.',
        },
        {
            controlReference: 'ISO27001-A.8.13',
            controlDescription: 'Information and system backups are maintained and tested.',
            testProcedure: 'Inspect backup schedules, restoration test records, and exception handling logs.',
        },
    ],
    [audit_enum_1.AuditType.Financial]: [
        {
            controlReference: 'FIN-AP-001',
            controlDescription: 'Payment approvals are segregated from payment preparation.',
            testProcedure: 'Sample payment transactions and verify maker-checker evidence against approval limits.',
        },
        {
            controlReference: 'FIN-REC-001',
            controlDescription: 'Bank and ledger reconciliations are prepared and independently reviewed.',
            testProcedure: 'Inspect monthly reconciliations, reconciling items, and reviewer sign-off evidence.',
        },
        {
            controlReference: 'FIN-FA-001',
            controlDescription: 'Fixed assets are recorded, tagged, and periodically verified.',
            testProcedure: 'Trace sampled assets to the register and verify physical existence and ownership.',
        },
    ],
    [audit_enum_1.AuditType.Compliance]: [
        {
            controlReference: 'NDPR-PRIV-001',
            controlDescription: 'Personal data processing has a lawful basis and documented privacy notices.',
            testProcedure: 'Review processing register, privacy notices, and sampled consent or lawful-basis evidence.',
        },
        {
            controlReference: 'ISO9001-9.2',
            controlDescription: 'Internal audits are planned and conducted against quality management requirements.',
            testProcedure: 'Inspect audit schedules, audit records, nonconformities, and corrective action follow-up.',
        },
        {
            controlReference: 'ISO22301-8.4',
            controlDescription: 'Business continuity procedures are tested and maintained.',
            testProcedure: 'Review BCP test records, issues raised, and management sign-off.',
        },
    ],
    [audit_enum_1.AuditType.Systems]: [
        {
            controlReference: 'SYS-INF-001',
            controlDescription: 'Infrastructure configuration baselines are defined and monitored.',
            testProcedure: 'Compare sampled server or network configurations against approved baselines.',
        },
        {
            controlReference: 'SYS-CHG-001',
            controlDescription: 'Production changes are approved, tested, and traceable.',
            testProcedure: 'Sample production changes and verify approval, test evidence, and rollback plans.',
        },
        {
            controlReference: 'SYS-DR-001',
            controlDescription: 'Disaster recovery capability aligns with approved recovery objectives.',
            testProcedure: 'Inspect DR plans, RTO/RPO mapping, and recent DR test evidence.',
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