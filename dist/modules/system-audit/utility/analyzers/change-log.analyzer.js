"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.changeLogAnalyzer = void 0;
const zod_1 = require("zod");
const system_audit_enum_1 = require("../../domain/enum/system-audit.enum");
const system_audit_utility_1 = require("../system-audit.utility");
const ParametersSchema = zod_1.z.object({
    /** Emergency changes may be ratified after the fact, within this many days. */
    emergencyRatificationDays: zod_1.z.number().int().min(0).max(60).default(3),
    requireTestEvidence: zod_1.z.boolean().default(true),
    requireRollbackPlan: zod_1.z.boolean().default(true),
    /** Optional approved change window (24h clock). Null disables the check. */
    changeWindow: zod_1.z
        .object({
        startHour: zod_1.z.number().int().min(0).max(23),
        endHour: zod_1.z.number().int().min(0).max(23),
        weekendsAllowed: zod_1.z.boolean().default(true),
    })
        .nullable()
        .default(null),
});
const IMPLEMENTED = /implement|complete|closed|deployed|done|success|resolved/i;
const CANCELLED = /cancel|reject|withdrawn|abandon/i;
const EMERGENCY = /emergency|urgent|expedite/i;
const NEGATIVE = /^(no|n|false|0|none|n\/a|na|-|not tested|pending)$/i;
// Some ITSM exports hold an approval *state* in the approver column.
const NOT_APPROVED_STATE = /^(not yet requested|requested|requested approval|pending|rejected|not approved|no|none|n\/a|na|-)$/i;
const APPROVED_STATE = /^(approved|yes|y|true)$/i;
const text = (v) => (typeof v === 'string' && v.trim() ? v.trim() : null);
const date = (v) => (v instanceof Date ? v : null);
const samePerson = (a, b) => Boolean(a && b && a.trim().toLowerCase() === b.trim().toLowerCase());
const inWindow = (when, window) => {
    const day = when.getDay();
    if ((day === 0 || day === 6) && window.weekendsAllowed)
        return true;
    const hour = when.getHours();
    // Windows may wrap midnight, e.g. 22:00 → 06:00.
    return window.startHour <= window.endHour
        ? hour >= window.startHour && hour < window.endHour
        : hour >= window.startHour || hour < window.endHour;
};
const analyse = (records, params, context) => {
    const exceptions = [];
    const counts = { implemented: 0, emergency: 0, unapproved: 0, lateApproval: 0, selfApproved: 0, noTest: 0, noRollback: 0, outsideWindow: 0, emergencyUnratified: 0 };
    const hasTest = context.mappedFields.has('test_evidence');
    const hasRollback = context.mappedFields.has('rollback_plan');
    for (const r of records) {
        const v = r.values;
        const id = text(v.change_id) ?? `row ${r.rowNumber}`;
        const title = text(v.title);
        const label = title ? `${id} (${title})` : id;
        const status = text(v.status) ?? '';
        if (CANCELLED.test(status))
            continue;
        const implementedAt = date(v.implementation_date);
        const implemented = Boolean(implementedAt) || IMPLEMENTED.test(status);
        if (!implemented)
            continue;
        counts.implemented += 1;
        const isEmergency = EMERGENCY.test(text(v.change_type) ?? '');
        if (isEmergency)
            counts.emergency += 1;
        const approverRaw = text(v.approved_by);
        const approver = approverRaw && NOT_APPROVED_STATE.test(approverRaw) ? null : approverRaw;
        const approverIsPerson = Boolean(approver && !APPROVED_STATE.test(approver));
        const approvedAt = date(v.approval_date);
        const base = { changeId: id, system: text(v.system), row: r.rowNumber };
        if (!approver && !approvedAt) {
            counts.unapproved += 1;
            exceptions.push({
                ruleCode: 'CHANGE_NOT_APPROVED',
                severity: system_audit_enum_1.ExceptionSeverity.High,
                title: `Change ${label} was implemented with no recorded approval`,
                recordRef: id,
                details: { ...base, changeType: text(v.change_type), implementedAt: implementedAt?.toISOString() ?? null },
            });
        }
        else if (approvedAt && implementedAt && approvedAt > implementedAt) {
            const lateDays = Math.round((0, system_audit_utility_1.daysBetween)(implementedAt, approvedAt) * 10) / 10;
            if (!isEmergency) {
                counts.lateApproval += 1;
                exceptions.push({
                    ruleCode: 'APPROVED_AFTER_IMPLEMENTATION',
                    severity: system_audit_enum_1.ExceptionSeverity.High,
                    title: `Change ${label} was approved ${lateDays} day(s) after it was implemented`,
                    recordRef: id,
                    details: { ...base, approvedAt: approvedAt.toISOString(), implementedAt: implementedAt.toISOString() },
                });
            }
            else if (lateDays > params.emergencyRatificationDays) {
                counts.emergencyUnratified += 1;
                exceptions.push({
                    ruleCode: 'EMERGENCY_NOT_RATIFIED',
                    severity: system_audit_enum_1.ExceptionSeverity.Medium,
                    title: `Emergency change ${label} was ratified ${lateDays} day(s) after implementation (limit ${params.emergencyRatificationDays})`,
                    recordRef: id,
                    details: { ...base, approvedAt: approvedAt.toISOString(), implementedAt: implementedAt.toISOString() },
                });
            }
        }
        const requester = text(v.requested_by);
        const implementer = text(v.implemented_by);
        if (approverIsPerson && (samePerson(approver, requester) || samePerson(approver, implementer))) {
            counts.selfApproved += 1;
            exceptions.push({
                ruleCode: 'SELF_APPROVED',
                severity: system_audit_enum_1.ExceptionSeverity.High,
                title: `Change ${label} was approved by the same person who ${samePerson(approver, implementer) ? 'implemented' : 'requested'} it`,
                recordRef: id,
                details: { ...base, approvedBy: approver, requestedBy: requester, implementedBy: implementer },
            });
        }
        if (hasTest && params.requireTestEvidence) {
            const test = v.test_evidence;
            if (test === null || test === false || (typeof test === 'string' && NEGATIVE.test(test))) {
                counts.noTest += 1;
                exceptions.push({
                    ruleCode: 'NO_TEST_EVIDENCE',
                    severity: system_audit_enum_1.ExceptionSeverity.Medium,
                    title: `Change ${label} has no evidence of testing`,
                    recordRef: id,
                    details: base,
                });
            }
        }
        if (hasRollback && params.requireRollbackPlan && !isEmergency) {
            const rollback = text(v.rollback_plan);
            if (!rollback || NEGATIVE.test(rollback)) {
                counts.noRollback += 1;
                exceptions.push({
                    ruleCode: 'NO_ROLLBACK_PLAN',
                    severity: system_audit_enum_1.ExceptionSeverity.Low,
                    title: `Change ${label} has no documented rollback plan`,
                    recordRef: id,
                    details: base,
                });
            }
        }
        if (params.changeWindow && implementedAt && !isEmergency && !inWindow(implementedAt, params.changeWindow)) {
            counts.outsideWindow += 1;
            exceptions.push({
                ruleCode: 'OUTSIDE_CHANGE_WINDOW',
                severity: system_audit_enum_1.ExceptionSeverity.Low,
                title: `Change ${label} was implemented outside the approved change window`,
                recordRef: id,
                details: { ...base, implementedAt: implementedAt.toISOString(), window: params.changeWindow },
            });
        }
    }
    return {
        summary: {
            totalRecords: records.length,
            implementedChanges: counts.implemented,
            emergencyChanges: counts.emergency,
            unapproved: counts.unapproved,
            approvedAfterImplementation: counts.lateApproval,
            emergencyNotRatified: counts.emergencyUnratified,
            selfApproved: counts.selfApproved,
            noTestEvidence: counts.noTest,
            noRollbackPlan: counts.noRollback,
            outsideChangeWindow: counts.outsideWindow,
        },
        exceptions,
    };
};
exports.changeLogAnalyzer = {
    type: system_audit_enum_1.AnalysisType.ChangeLog,
    label: 'Change management review',
    description: 'Tests a change log from the ITSM tool: changes implemented without approval, approved after the fact, self-approved, or missing test and rollback evidence.',
    controls: ['SYS-CHG-001', 'COBIT-BAI06', 'SOX-ITGC-PC', 'ISO27001-A.8.9'],
    fields: [
        { key: 'change_id', label: 'Change ID', kind: 'text', required: true, synonyms: ['change number', 'change no', 'change ref', 'ticket', 'ticket id', 'rfc', 'cr number', 'cr', 'number', 'id', 'reference'] },
        { key: 'implementation_date', label: 'Implemented on', kind: 'date', required: true, synonyms: ['implemented date', 'implementation date', 'implemented', 'implemented on', 'completed date', 'completed', 'actual end', 'closed date', 'deployment date', 'deployed on'] },
        { key: 'approved_by', label: 'Approved by', kind: 'text', required: true, synonyms: ['approver', 'cab approver', 'authorised by', 'authorized by', 'approved'] },
        { key: 'approval_date', label: 'Approved on', kind: 'date', required: false, synonyms: ['approved date', 'approved on', 'approval date', 'cab date', 'authorised on', 'authorized on'] },
        { key: 'title', label: 'Title', kind: 'text', required: false, synonyms: ['summary', 'short description', 'description', 'subject'] },
        { key: 'change_type', label: 'Change type', kind: 'text', required: false, synonyms: ['type', 'category', 'change category', 'classification'] },
        { key: 'status', label: 'Status', kind: 'text', required: false, synonyms: ['state', 'change status'] },
        { key: 'requested_by', label: 'Requested by', kind: 'text', required: false, synonyms: ['requester', 'raised by', 'requestor', 'opened by', 'initiator'] },
        { key: 'implemented_by', label: 'Implemented by', kind: 'text', required: false, synonyms: ['implementer', 'engineer', 'assignee', 'assigned to', 'performed by'] },
        { key: 'test_evidence', label: 'Test evidence', kind: 'text', required: false, synonyms: ['tested', 'test result', 'test results', 'uat', 'uat sign off', 'testing'] },
        { key: 'rollback_plan', label: 'Rollback plan', kind: 'text', required: false, synonyms: ['backout plan', 'back out plan', 'rollback', 'backout'] },
        { key: 'system', label: 'System', kind: 'text', required: false, synonyms: ['ci', 'configuration item', 'application', 'service', 'asset'] },
    ],
    parametersSchema: ParametersSchema,
    rules: [
        { code: 'CHANGE_NOT_APPROVED', label: 'Implemented without approval', severity: system_audit_enum_1.ExceptionSeverity.High },
        { code: 'APPROVED_AFTER_IMPLEMENTATION', label: 'Approved after implementation', severity: system_audit_enum_1.ExceptionSeverity.High },
        { code: 'EMERGENCY_NOT_RATIFIED', label: 'Emergency change ratified late', severity: system_audit_enum_1.ExceptionSeverity.Medium },
        { code: 'SELF_APPROVED', label: 'Approver also requested or implemented', severity: system_audit_enum_1.ExceptionSeverity.High },
        { code: 'NO_TEST_EVIDENCE', label: 'No test evidence', severity: system_audit_enum_1.ExceptionSeverity.Medium },
        { code: 'NO_ROLLBACK_PLAN', label: 'No rollback plan', severity: system_audit_enum_1.ExceptionSeverity.Low },
        { code: 'OUTSIDE_CHANGE_WINDOW', label: 'Outside approved change window', severity: system_audit_enum_1.ExceptionSeverity.Low },
    ],
    analyse,
};
//# sourceMappingURL=change-log.analyzer.js.map