"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.incidentLogAnalyzer = exports.normalisePriority = void 0;
const zod_1 = require("zod");
const system_audit_enum_1 = require("../../domain/enum/system-audit.enum");
const system_audit_utility_1 = require("../system-audit.utility");
const PRIORITIES = ['critical', 'high', 'medium', 'low'];
const SlaSchema = zod_1.z.object({
    responseMinutes: zod_1.z.number().min(1).max(100_000),
    resolutionHours: zod_1.z.number().min(0.1).max(10_000),
});
const ParametersSchema = zod_1.z.object({
    sla: zod_1.z
        .object({ critical: SlaSchema, high: SlaSchema, medium: SlaSchema, low: SlaSchema })
        .default({
        critical: { responseMinutes: 15, resolutionHours: 4 },
        high: { responseMinutes: 60, resolutionHours: 8 },
        medium: { responseMinutes: 240, resolutionHours: 24 },
        low: { responseMinutes: 480, resolutionHours: 72 },
    }),
    /** Open incidents older than this are escalated as aged. */
    openAgeDays: zod_1.z.number().int().min(1).max(3650).default(30),
});
const text = (v) => (typeof v === 'string' && v.trim() ? v.trim() : null);
const date = (v) => (v instanceof Date ? v : null);
const normalisePriority = (raw) => {
    const p = (raw ?? '').toLowerCase();
    if (/crit|urgent|highest|\bp1\b|^1\b|sev(erity)? ?1\b/.test(p))
        return 'critical';
    if (/high|\bp2\b|^2\b|sev(erity)? ?2\b/.test(p))
        return 'high';
    if (/low|minor|planning|\bp[45]\b|^[45]\b|sev(erity)? ?[45]\b/.test(p))
        return 'low';
    return 'medium';
};
exports.normalisePriority = normalisePriority;
// Includes IMOC's terminal states (completed, dismissed, scrapped).
const RESOLVED_STATUS = /resolv|closed|complete|restored|done|finish|dismiss|scrap|cancel|reject/i;
// IMOC reports an expired SLA as "BREAK".
const SLA_BREACH_TEXT = /breach|\bbreak\b|overdue|violat|missed|exceed|timeout|timed out|late/i;
const analyse = (records, params, context) => {
    const exceptions = [];
    const byPriority = { critical: 0, high: 0, medium: 0, low: 0 };
    let resolved = 0;
    let responseBreaches = 0;
    let resolutionBreaches = 0;
    let resolvedWithinSla = 0;
    let resolvedTimed = 0;
    let sourceSlaBreaches = 0;
    let aged = 0;
    let totalResolutionHours = 0;
    let unreadable = 0;
    const hasResolution = context.mappedFields.has('resolution');
    for (const r of records) {
        const v = r.values;
        const id = text(v.incident_id) ?? `row ${r.rowNumber}`;
        const reportedAt = date(v.reported_at);
        if (!reportedAt) {
            unreadable += 1;
            continue;
        }
        const priority = (0, exports.normalisePriority)(text(v.priority));
        byPriority[priority] += 1;
        const sla = params.sla[priority];
        const title = text(v.title);
        const label = title ? `${id} (${title})` : id;
        const base = { incidentId: id, priority, category: text(v.category), assignee: text(v.assignee), row: r.rowNumber };
        const breachSeverity = priority === 'critical' || priority === 'high' ? system_audit_enum_1.ExceptionSeverity.High : system_audit_enum_1.ExceptionSeverity.Medium;
        const respondedAt = date(v.responded_at);
        if (respondedAt) {
            const minutes = (0, system_audit_utility_1.hoursBetween)(reportedAt, respondedAt) * 60;
            if (minutes > sla.responseMinutes) {
                responseBreaches += 1;
                exceptions.push({
                    ruleCode: 'RESPONSE_SLA_BREACH',
                    severity: system_audit_enum_1.ExceptionSeverity.Medium,
                    title: `${priority} incident ${label} was first responded to after ${Math.round(minutes)} minutes (target ${sla.responseMinutes})`,
                    recordRef: id,
                    details: { ...base, reportedAt: reportedAt.toISOString(), respondedAt: respondedAt.toISOString() },
                });
            }
        }
        const resolvedAt = date(v.resolved_at);
        const status = text(v.status) ?? '';
        const isResolved = Boolean(resolvedAt) || RESOLVED_STATUS.test(status);
        let computedBreach = false;
        if (resolvedAt) {
            resolved += 1;
            resolvedTimed += 1;
            const hours = (0, system_audit_utility_1.hoursBetween)(reportedAt, resolvedAt);
            totalResolutionHours += hours;
            if (hours > sla.resolutionHours) {
                computedBreach = true;
                resolutionBreaches += 1;
                exceptions.push({
                    ruleCode: 'RESOLUTION_SLA_BREACH',
                    severity: breachSeverity,
                    title: `${priority} incident ${label} took ${(0, system_audit_utility_1.round)(hours)} hours to resolve (target ${sla.resolutionHours})`,
                    recordRef: id,
                    details: { ...base, reportedAt: reportedAt.toISOString(), resolvedAt: resolvedAt.toISOString() },
                });
            }
            else {
                resolvedWithinSla += 1;
            }
        }
        else if (isResolved) {
            resolved += 1;
        }
        const slaStatus = text(v.sla_status);
        if (!computedBreach && slaStatus && SLA_BREACH_TEXT.test(slaStatus)) {
            sourceSlaBreaches += 1;
            exceptions.push({
                ruleCode: 'SLA_BREACHED',
                severity: breachSeverity,
                title: `Incident ${label} is marked "${slaStatus}" against its SLA in the source system`,
                recordRef: id,
                details: { ...base, slaStatus },
            });
        }
        if (!isResolved) {
            const ageDays = (0, system_audit_utility_1.daysBetween)(reportedAt, context.now);
            if (ageDays > params.openAgeDays) {
                aged += 1;
                exceptions.push({
                    ruleCode: 'UNRESOLVED_AGED',
                    severity: breachSeverity,
                    title: `${priority} incident ${label} has been open for ${Math.floor(ageDays)} days`,
                    recordRef: id,
                    details: { ...base, reportedAt: reportedAt.toISOString(), status: status || null },
                });
            }
        }
        if (isResolved && hasResolution && !text(v.resolution)) {
            exceptions.push({
                ruleCode: 'CLOSED_WITHOUT_RESOLUTION',
                severity: system_audit_enum_1.ExceptionSeverity.Low,
                title: `Incident ${label} was closed with no resolution or root-cause notes`,
                recordRef: id,
                details: base,
            });
        }
    }
    // Compliance is measured on incidents IAMS could time itself.
    const withTimes = resolvedWithinSla + resolutionBreaches;
    return {
        summary: {
            incidents: records.length - unreadable,
            ...Object.fromEntries(PRIORITIES.map((p) => [`${p}Incidents`, byPriority[p]])),
            resolved,
            open: records.length - unreadable - resolved,
            responseSlaBreaches: responseBreaches,
            resolutionSlaBreaches: resolutionBreaches,
            sourceReportedSlaBreaches: sourceSlaBreaches,
            slaCompliance: withTimes ? (0, system_audit_utility_1.round)((resolvedWithinSla / withTimes) * 100) : null,
            meanTimeToResolveHours: resolvedTimed ? (0, system_audit_utility_1.round)(totalResolutionHours / resolvedTimed) : null,
            agedOpenIncidents: aged,
            unreadableRows: unreadable,
        },
        exceptions,
    };
};
exports.incidentLogAnalyzer = {
    type: system_audit_enum_1.AnalysisType.IncidentLog,
    label: 'Incident management review',
    description: 'Examines security and service incident records — response and resolution against SLA, aged open incidents, and closures without resolution notes. Works on an ITSM export or live read-only IMOC tickets.',
    controls: ['ISO27001-A.5.26', 'ISO27001-A.5.24', 'ISO20000-8.6.1', 'GDPR-ART33', 'SOX-ITGC-CO'],
    fields: [
        { key: 'incident_id', label: 'Incident ID', kind: 'text', required: true, synonyms: ['incident', 'incident number', 'number', 'ticket', 'ticket id', 'ticket number', 'id', 'reference', 'order number'] },
        { key: 'reported_at', label: 'Reported at', kind: 'date', required: true, synonyms: ['opened', 'opened at', 'reported', 'created', 'created at', 'logged', 'open date', 'date opened', 'begin time', 'raised'] },
        { key: 'priority', label: 'Priority', kind: 'text', required: false, synonyms: ['severity', 'impact', 'urgency', 'priority level', 'incident priority'] },
        { key: 'title', label: 'Title', kind: 'text', required: false, synonyms: ['summary', 'short description', 'description', 'subject', 'order name'] },
        { key: 'category', label: 'Category', kind: 'text', required: false, synonyms: ['type', 'classification', 'model name', 'incident type'] },
        { key: 'responded_at', label: 'First response', kind: 'date', required: false, synonyms: ['acknowledged', 'acknowledged at', 'responded', 'response time', 'first response', 'assigned at', 'response date'] },
        { key: 'resolved_at', label: 'Resolved at', kind: 'date', required: false, synonyms: ['resolved', 'closed', 'closed at', 'resolution date', 'restored', 'end time', 'date closed'] },
        { key: 'status', label: 'Status', kind: 'text', required: false, synonyms: ['state', 'incident status', 'order status'] },
        { key: 'resolution', label: 'Resolution notes', kind: 'text', required: false, synonyms: ['resolution', 'close notes', 'closure notes', 'root cause', 'resolution code'] },
        { key: 'assignee', label: 'Assigned to', kind: 'text', required: false, synonyms: ['owner', 'resolver', 'assignment group', 'current user'] },
        { key: 'sla_status', label: 'SLA status', kind: 'text', required: false, synonyms: ['sla', 'made sla', 'sla breached', 'breached'] },
    ],
    parametersSchema: ParametersSchema,
    rules: [
        { code: 'RESPONSE_SLA_BREACH', label: 'First response later than SLA', severity: system_audit_enum_1.ExceptionSeverity.Medium },
        { code: 'RESOLUTION_SLA_BREACH', label: 'Resolved later than SLA', severity: 'varies' },
        { code: 'SLA_BREACHED', label: 'Source system reports SLA breach', severity: 'varies' },
        { code: 'UNRESOLVED_AGED', label: 'Open longer than threshold', severity: 'varies' },
        { code: 'CLOSED_WITHOUT_RESOLUTION', label: 'Closed without resolution notes', severity: system_audit_enum_1.ExceptionSeverity.Low },
    ],
    analyse,
};
//# sourceMappingURL=incident-log.analyzer.js.map