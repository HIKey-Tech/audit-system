"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.PeriodicReportService = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const docx_1 = require("docx");
const date_fns_1 = require("date-fns");
const prisma_client_1 = require("../../../../shared/prisma/prisma.client");
const app_error_1 = require("../../../../shared/errors/app.error");
const logger_util_1 = require("../../../../shared/utils/logger.util");
const pdf_util_1 = require("../../../../shared/utils/pdf.util");
const GBB_NAVY = '1B365D';
const GBB_NAVY_HEX = '#1B365D';
const GBB_ACCENT_GREEN = '4F6228';
let cachedLogoBuffer = null;
const getGbbLogoBuffer = () => {
    if (cachedLogoBuffer)
        return cachedLogoBuffer;
    const candidatePaths = [
        path.resolve(__dirname, '../../../../assets/gbb-logo.png'),
        path.resolve(process.cwd(), 'src/assets/gbb-logo.png'),
        path.resolve(process.cwd(), 'dist/assets/gbb-logo.png'),
    ];
    for (const candidate of candidatePaths) {
        try {
            if (fs.existsSync(candidate)) {
                cachedLogoBuffer = fs.readFileSync(candidate);
                return cachedLogoBuffer;
            }
        }
        catch (err) {
            logger_util_1.logger.warn('Could not read GBB logo file', { candidate, err });
        }
    }
    return null;
};
const formatUserName = (u, fallback = '—') => {
    if (!u)
        return fallback;
    if (u.display_name && u.display_name.trim())
        return u.display_name.trim();
    const full = `${u.first_name ?? ''} ${u.last_name ?? ''}`.trim();
    return full || fallback;
};
const AUDIT_TYPE_LABELS = {
    it: 'System/IT Audit',
    systems: 'Systems Audit',
    financial: 'Financial Audit',
    compliance: 'Compliance Audit',
    operational: 'Operational Audit',
    pension: 'Pension Audit',
    procurement: 'Procurement Audit',
    hr_payroll: 'HR & Payroll Audit',
    project: 'Project Audit',
    special: 'Special Audit',
};
const CANONICAL_AUDIT_TYPES = [
    'it',
    'systems',
    'financial',
    'compliance',
    'operational',
    'pension',
    'procurement',
    'hr_payroll',
    'project',
    'special',
];
const formatAuditType = (value) => {
    if (!value)
        return '—';
    const lower = value.toLowerCase();
    if (AUDIT_TYPE_LABELS[lower])
        return AUDIT_TYPE_LABELS[lower];
    return value.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
};
const formatStatusLabel = (status) => {
    if (!status)
        return '—';
    const key = status.toLowerCase();
    if (key === 'under_review')
        return 'Quality Assurance';
    if (key === 'reported')
        return 'Review Issued';
    if (key === 'in_progress')
        return 'In Progress';
    if (key === 'submitted')
        return 'In Review (Submitted)';
    if (key === 'issued')
        return 'Published / Issued';
    return status.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
};
const ENTITY_TYPE_LABELS = {
    audit_plan: 'Audit Programme',
    audit_working_paper: 'Working Paper',
    audit_report: 'Audit Review',
    audit_finding_closure: 'Finding Closure',
    audit_finding: 'Audit Finding',
    audit_engagement: 'Audit Engagement',
};
const formatEntityType = (entityType) => ENTITY_TYPE_LABELS[entityType] ??
    entityType.replace(/^audit_/, '').replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
class PeriodicReportService {
    _computePeriod(query) {
        const now = new Date();
        const year = query.year || now.getFullYear();
        if (query.periodType === 'monthly') {
            const month = query.month ?? now.getMonth() + 1;
            const periodStart = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0, 0));
            const periodEnd = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999));
            const monthName = (0, date_fns_1.format)(periodStart, 'MMMM yyyy');
            return {
                periodType: 'monthly',
                periodStart,
                periodEnd,
                periodLabel: `${monthName} (${(0, date_fns_1.format)(periodStart, 'MMM d, yyyy')} – ${(0, date_fns_1.format)(periodEnd, 'MMM d, yyyy')})`,
                slugLabel: `${year}-M${String(month).padStart(2, '0')}`,
            };
        }
        if (query.periodType === 'yearly') {
            const periodStart = new Date(Date.UTC(year, 0, 1, 0, 0, 0, 0));
            const periodEnd = new Date(Date.UTC(year, 11, 31, 23, 59, 59, 999));
            return {
                periodType: 'yearly',
                periodStart,
                periodEnd,
                periodLabel: `FY ${year} (Jan 1, ${year} – Dec 31, ${year})`,
                slugLabel: `FY-${year}`,
            };
        }
        if (query.periodType === 'custom') {
            const startRaw = query.startDate ? new Date(query.startDate) : new Date(Date.UTC(year, 0, 1));
            const endRaw = query.endDate ? new Date(query.endDate) : now;
            if (Number.isNaN(startRaw.getTime()) || Number.isNaN(endRaw.getTime())) {
                throw app_error_1.AppError.badRequest('Invalid startDate or endDate for custom period');
            }
            const periodStart = new Date(Date.UTC(startRaw.getUTCFullYear(), startRaw.getUTCMonth(), startRaw.getUTCDate(), 0, 0, 0, 0));
            const periodEnd = new Date(Date.UTC(endRaw.getUTCFullYear(), endRaw.getUTCMonth(), endRaw.getUTCDate(), 23, 59, 59, 999));
            if (periodStart.getTime() > periodEnd.getTime()) {
                throw app_error_1.AppError.badRequest('startDate must be before or equal to endDate');
            }
            const startIso = (0, date_fns_1.format)(periodStart, 'yyyy-MM-dd');
            const endIso = (0, date_fns_1.format)(periodEnd, 'yyyy-MM-dd');
            return {
                periodType: 'custom',
                periodStart,
                periodEnd,
                periodLabel: `Custom Period: ${startIso} to ${endIso}`,
                slugLabel: `${startIso}_to_${endIso}`,
            };
        }
        // Default: quarterly
        const quarter = query.quarter ?? Math.floor(now.getMonth() / 3) + 1;
        const startMonth = (quarter - 1) * 3;
        const endMonth = startMonth + 2;
        const periodStart = new Date(Date.UTC(year, startMonth, 1, 0, 0, 0, 0));
        const periodEnd = new Date(Date.UTC(year, endMonth + 1, 0, 23, 59, 59, 999));
        return {
            periodType: 'quarterly',
            periodStart,
            periodEnd,
            periodLabel: `Q${quarter} ${year} (${(0, date_fns_1.format)(periodStart, 'MMM d, yyyy')} – ${(0, date_fns_1.format)(periodEnd, 'MMM d, yyyy')})`,
            slugLabel: `${year}-Q${quarter}`,
        };
    }
    _auditTypeWhere(auditType) {
        const clean = auditType?.trim().toLowerCase();
        if (!clean || clean === 'all')
            return undefined;
        if (clean === 'it' || clean === 'systems') {
            return { in: ['it', 'systems'] };
        }
        return { equals: clean };
    }
    async getPeriodicReport(query, actor) {
        const { periodType, periodStart, periodEnd, periodLabel } = this._computePeriod(query);
        const auditTypeCond = this._auditTypeWhere(query.auditType);
        const now = new Date();
        const yearsInPeriod = Array.from(new Set([periodStart.getUTCFullYear(), periodEnd.getUTCFullYear()]));
        const [rawPlans, rawEngagements, rawReports, rawApprovals, rawEscalations, rawFindings] = await Promise.all([
            prisma_client_1.prisma.audit_Plan.findMany({
                where: {
                    deleted_at: null,
                    ...(auditTypeCond ? { audit_type: auditTypeCond } : {}),
                    OR: [
                        { year: { in: yearsInPeriod } },
                        { created_at: { gte: periodStart, lte: periodEnd } },
                        { updated_at: { gte: periodStart, lte: periodEnd } },
                        { approved_at: { gte: periodStart, lte: periodEnd } },
                    ],
                },
                include: {
                    approved_by: { select: { display_name: true, first_name: true, last_name: true } },
                    items: { select: { id: true, engagement_created: true } },
                },
                orderBy: [{ year: 'desc' }, { created_at: 'desc' }],
            }),
            prisma_client_1.prisma.audit_Engagement.findMany({
                where: {
                    deleted_at: null,
                    ...(auditTypeCond ? { audit_type: auditTypeCond } : {}),
                    OR: [
                        {
                            planned_start_date: { lte: periodEnd },
                            planned_end_date: { gte: periodStart },
                        },
                        { actual_start_date: { gte: periodStart, lte: periodEnd } },
                        { actual_end_date: { gte: periodStart, lte: periodEnd } },
                        { created_at: { gte: periodStart, lte: periodEnd } },
                        { updated_at: { gte: periodStart, lte: periodEnd } },
                    ],
                },
                include: {
                    universe: { select: { name: true } },
                    lead_auditor: { select: { display_name: true, first_name: true, last_name: true } },
                    audit_manager: { select: { display_name: true, first_name: true, last_name: true } },
                    auditee: { select: { display_name: true, first_name: true, last_name: true } },
                    workflow_assignments: {
                        include: {
                            user: { select: { display_name: true, first_name: true, last_name: true } },
                        },
                    },
                    findings: {
                        where: { deleted_at: null },
                        select: { id: true },
                    },
                    checklists: {
                        select: { result: true },
                    },
                },
                orderBy: { created_at: 'desc' },
            }),
            prisma_client_1.prisma.audit_Report.findMany({
                where: {
                    deleted_at: null,
                    ...(auditTypeCond ? { engagement: { audit_type: auditTypeCond } } : {}),
                    OR: [
                        { created_at: { gte: periodStart, lte: periodEnd } },
                        { updated_at: { gte: periodStart, lte: periodEnd } },
                        { issued_at: { gte: periodStart, lte: periodEnd } },
                    ],
                },
                include: {
                    created_by: { select: { display_name: true, first_name: true, last_name: true } },
                    engagement: {
                        select: {
                            id: true,
                            reference_number: true,
                            title: true,
                            audit_type: true,
                            findings: {
                                where: { deleted_at: null },
                                select: { id: true },
                            },
                        },
                    },
                },
                orderBy: { created_at: 'desc' },
            }),
            prisma_client_1.prisma.workflow_Approval.findMany({
                where: {
                    OR: [
                        { created_at: { gte: periodStart, lte: periodEnd } },
                        { updated_at: { gte: periodStart, lte: periodEnd } },
                        { completed_at: { gte: periodStart, lte: periodEnd } },
                    ],
                },
                include: {
                    submitted_by: { select: { display_name: true, first_name: true, last_name: true } },
                    steps: {
                        include: {
                            approver: { select: { display_name: true, first_name: true, last_name: true } },
                        },
                        orderBy: { level: 'asc' },
                    },
                },
                orderBy: { created_at: 'desc' },
            }),
            prisma_client_1.prisma.workflow_Escalation.findMany({
                where: {
                    OR: [
                        { created_at: { gte: periodStart, lte: periodEnd } },
                        { notified_at: { gte: periodStart, lte: periodEnd } },
                        { acknowledged_at: { gte: periodStart, lte: periodEnd } },
                    ],
                },
                include: {
                    escalated_to: { select: { display_name: true, first_name: true, last_name: true } },
                },
                orderBy: { created_at: 'desc' },
            }),
            prisma_client_1.prisma.audit_Finding.findMany({
                where: {
                    deleted_at: null,
                    ...(auditTypeCond ? { engagement: { audit_type: auditTypeCond } } : {}),
                    OR: [
                        { created_at: { gte: periodStart, lte: periodEnd } },
                        { updated_at: { gte: periodStart, lte: periodEnd } },
                        { closed_at: { gte: periodStart, lte: periodEnd } },
                    ],
                },
                include: {
                    engagement: {
                        select: { id: true, reference_number: true, title: true, audit_type: true },
                    },
                    auditee: { select: { display_name: true, first_name: true, last_name: true } },
                    follow_up: { select: { management_response: true } },
                },
                orderBy: { created_at: 'desc' },
            }),
        ]);
        // Map Programmes
        const programmes = rawPlans.map((p) => ({
            id: p.id,
            title: p.title,
            year: p.year,
            auditType: p.audit_type,
            status: p.status,
            itemsCount: p.items.length,
            engagementsCreatedCount: p.items.filter((i) => i.engagement_created).length,
            approvedByName: p.approved_by ? formatUserName(p.approved_by) : null,
            approvedAt: p.approved_at ? p.approved_at.toISOString() : null,
            rejectionReason: p.rejection_reason ?? null,
            createdAt: p.created_at.toISOString(),
        }));
        // Map Engagements
        const engagements = rawEngagements.map((e) => {
            const totalControls = e.checklists.length;
            const testedControls = e.checklists.filter((c) => c.result !== 'not_tested').length;
            const checklistCompletionPct = totalControls > 0 ? Math.round((testedControls / totalControls) * 100) : 0;
            const isOverdue = e.status !== 'closed' && e.status !== 'reported' && e.sla_deadline.getTime() < now.getTime();
            const supportingNames = Array.from(new Set(e.workflow_assignments
                .filter((a) => a.role === 'supporting_auditor')
                .map((a) => formatUserName(a.user))
                .filter((name) => name !== '—')));
            return {
                id: e.id,
                referenceNumber: e.reference_number,
                title: e.title,
                universeName: e.universe.name,
                auditType: e.audit_type,
                priority: e.priority,
                status: e.status,
                leadAuditorName: formatUserName(e.lead_auditor),
                auditManagerName: formatUserName(e.audit_manager),
                auditeeName: formatUserName(e.auditee),
                teamMembers: supportingNames,
                plannedStartDate: e.planned_start_date.toISOString(),
                plannedEndDate: e.planned_end_date.toISOString(),
                actualStartDate: e.actual_start_date ? e.actual_start_date.toISOString() : null,
                actualEndDate: e.actual_end_date ? e.actual_end_date.toISOString() : null,
                olaDeadline: e.sla_deadline.toISOString(),
                isOverdue,
                findingsCount: e.findings.length,
                checklistCompletionPct,
            };
        });
        // Map Reports
        const reports = rawReports.map((r) => ({
            id: r.id,
            title: r.title,
            engagementId: r.engagement.id,
            engagementReference: r.engagement.reference_number,
            engagementTitle: r.engagement.title,
            auditType: r.engagement.audit_type,
            status: r.status,
            versionNumber: r.version_number,
            createdByName: formatUserName(r.created_by),
            issuedAt: r.issued_at ? r.issued_at.toISOString() : null,
            rejectionReason: r.rejection_reason ?? null,
            findingsCount: r.engagement.findings.length,
            createdAt: r.created_at.toISOString(),
        }));
        // Resolve approval entity references, escalations, & optional auditType filtering
        const resolvedApprovals = await this._resolveApprovals(rawApprovals, rawEscalations, query.auditType);
        // Map Findings
        const findings = rawFindings.map((f) => ({
            id: f.id,
            title: f.title,
            engagementId: f.engagement.id,
            engagementReference: f.engagement.reference_number,
            engagementTitle: f.engagement.title,
            severity: f.severity,
            category: f.category,
            status: f.status,
            auditeeName: formatUserName(f.auditee),
            dueDate: f.due_date.toISOString(),
            hasManagementResponse: Boolean(f.follow_up?.management_response?.trim()),
            closedAt: f.closed_at ? f.closed_at.toISOString() : null,
            createdAt: f.created_at.toISOString(),
        }));
        // Build Summary
        const engagementsByStatus = {
            planned: 0,
            in_progress: 0,
            under_review: 0,
            reported: 0,
            closed: 0,
        };
        const engagementsByType = {
            it: 0,
            systems: 0,
            financial: 0,
            compliance: 0,
            operational: 0,
            pension: 0,
            procurement: 0,
            hr_payroll: 0,
            project: 0,
            special: 0,
        };
        let engagementsStartedInPeriod = 0;
        let engagementsClosedInPeriod = 0;
        let engagementsOverdue = 0;
        for (const eng of rawEngagements) {
            const st = eng.status;
            if (st in engagementsByStatus) {
                engagementsByStatus[st] += 1;
            }
            const normType = (eng.audit_type || 'operational').toLowerCase();
            engagementsByType[normType] = (engagementsByType[normType] ?? 0) + 1;
            const startCandidate = eng.actual_start_date ?? eng.created_at;
            if (startCandidate >= periodStart && startCandidate <= periodEnd) {
                engagementsStartedInPeriod += 1;
            }
            if (eng.status === 'closed' &&
                eng.actual_end_date &&
                eng.actual_end_date >= periodStart &&
                eng.actual_end_date <= periodEnd) {
                engagementsClosedInPeriod += 1;
            }
            if (eng.status !== 'closed' && eng.status !== 'reported' && eng.sla_deadline < now) {
                engagementsOverdue += 1;
            }
        }
        const findingsBySeverity = {
            critical: 0,
            high: 0,
            medium: 0,
            low: 0,
            informational: 0,
        };
        let findingsRaisedInPeriod = 0;
        let findingsClosedInPeriod = 0;
        let findingsOpenTotal = 0;
        for (const f of rawFindings) {
            const sev = f.severity.toLowerCase();
            if (sev in findingsBySeverity) {
                findingsBySeverity[sev] += 1;
            }
            if (f.created_at >= periodStart && f.created_at <= periodEnd) {
                findingsRaisedInPeriod += 1;
            }
            if (f.closed_at && f.closed_at >= periodStart && f.closed_at <= periodEnd) {
                findingsClosedInPeriod += 1;
            }
            if (f.status !== 'closed') {
                findingsOpenTotal += 1;
            }
        }
        const reportsIssuedCount = rawReports.filter((r) => r.status === 'issued' ||
            r.status === 'published' ||
            (r.issued_at && r.issued_at >= periodStart && r.issued_at <= periodEnd)).length;
        const approvalsEscalatedCount = resolvedApprovals.filter((a) => a.status === 'escalated' || Boolean(a.isEscalated)).length;
        const summary = {
            totalProgrammes: programmes.length,
            approvedProgrammes: programmes.filter((p) => p.status === 'approved').length,
            pendingProgrammes: programmes.filter((p) => p.status === 'draft' || p.status === 'submitted').length,
            rejectedProgrammes: programmes.filter((p) => p.status === 'rejected').length,
            totalEngagements: engagements.length,
            engagementsStartedInPeriod,
            engagementsClosedInPeriod,
            engagementsOverdue,
            engagementsByStatus,
            engagementsByType,
            reportsIssuedInPeriod: reportsIssuedCount,
            reportsPublished: reportsIssuedCount,
            reportsDraft: reports.filter((r) => r.status === 'draft').length,
            reportsSubmitted: reports.filter((r) => r.status === 'submitted' || r.status === 'in_review' || r.status === 'under_review').length,
            reportsApproved: reports.filter((r) => r.status === 'approved').length,
            reportsRejected: reports.filter((r) => Boolean(r.rejectionReason) || r.status === 'rejected').length,
            approvalsTotalInPeriod: resolvedApprovals.length,
            approvalsPending: resolvedApprovals.filter((a) => a.status === 'pending').length,
            approvalsApproved: resolvedApprovals.filter((a) => a.status === 'approved').length,
            approvalsRejected: resolvedApprovals.filter((a) => a.status === 'rejected').length,
            approvalsEscalated: approvalsEscalatedCount,
            findingsRaisedInPeriod,
            findingsClosedInPeriod,
            findingsOpenTotal,
            findingsBySeverity,
        };
        return {
            periodType,
            periodStart: periodStart.toISOString(),
            periodEnd: periodEnd.toISOString(),
            periodLabel,
            auditTypeFilter: query.auditType && query.auditType !== 'all' ? query.auditType : null,
            generatedAt: now.toISOString(),
            generatedBy: actor.displayName || actor.email,
            summary,
            programmes,
            engagements,
            reports,
            approvals: resolvedApprovals,
            findings,
        };
    }
    async _resolveApprovals(rawApprovals, rawEscalations, auditTypeFilter) {
        if (rawApprovals.length === 0 && rawEscalations.length === 0)
            return [];
        // Also fetch any escalations associated with the approval entity_ids even if created slightly outside period
        const approvalEntityIds = rawApprovals.map((a) => a.entity_id);
        const extraEscalations = approvalEntityIds.length > 0
            ? await prisma_client_1.prisma.workflow_Escalation.findMany({
                where: { entity_id: { in: approvalEntityIds } },
                include: {
                    escalated_to: { select: { display_name: true, first_name: true, last_name: true } },
                },
            })
            : [];
        const allEscalationsByEntityId = new Map();
        for (const esc of [...extraEscalations, ...rawEscalations]) {
            const existing = allEscalationsByEntityId.get(esc.entity_id);
            if (!existing || esc.escalation_level >= existing.escalation_level) {
                allEscalationsByEntityId.set(esc.entity_id, esc);
            }
        }
        const allRecords = [
            ...rawApprovals.map((a) => ({ entity_type: a.entity_type, entity_id: a.entity_id })),
            ...rawEscalations.map((e) => ({ entity_type: e.entity_type, entity_id: e.entity_id })),
        ];
        const planIds = Array.from(new Set(allRecords.filter((r) => r.entity_type === 'audit_plan').map((r) => r.entity_id)));
        const wpIds = Array.from(new Set(allRecords.filter((r) => r.entity_type === 'audit_working_paper').map((r) => r.entity_id)));
        const reportIds = Array.from(new Set(allRecords.filter((r) => r.entity_type === 'audit_report').map((r) => r.entity_id)));
        const findingIds = Array.from(new Set(allRecords
            .filter((r) => r.entity_type === 'audit_finding_closure' || r.entity_type === 'audit_finding')
            .map((r) => r.entity_id)));
        const engagementIds = Array.from(new Set(allRecords.filter((r) => r.entity_type === 'audit_engagement').map((r) => r.entity_id)));
        const [plans, wps, reports, findings, engagements] = await Promise.all([
            planIds.length > 0
                ? prisma_client_1.prisma.audit_Plan.findMany({
                    where: { id: { in: planIds } },
                    select: { id: true, title: true, year: true, audit_type: true },
                })
                : Promise.resolve([]),
            wpIds.length > 0
                ? prisma_client_1.prisma.audit_Working_Paper.findMany({
                    where: { id: { in: wpIds } },
                    select: {
                        id: true,
                        title: true,
                        engagement: { select: { reference_number: true, audit_type: true } },
                    },
                })
                : Promise.resolve([]),
            reportIds.length > 0
                ? prisma_client_1.prisma.audit_Report.findMany({
                    where: { id: { in: reportIds } },
                    select: {
                        id: true,
                        title: true,
                        engagement: { select: { reference_number: true, audit_type: true } },
                    },
                })
                : Promise.resolve([]),
            findingIds.length > 0
                ? prisma_client_1.prisma.audit_Finding.findMany({
                    where: { id: { in: findingIds } },
                    select: {
                        id: true,
                        title: true,
                        engagement: { select: { reference_number: true, audit_type: true } },
                    },
                })
                : Promise.resolve([]),
            engagementIds.length > 0
                ? prisma_client_1.prisma.audit_Engagement.findMany({
                    where: { id: { in: engagementIds } },
                    select: { id: true, reference_number: true, title: true, audit_type: true },
                })
                : Promise.resolve([]),
        ]);
        const planMap = new Map(plans.map((p) => [p.id, p]));
        const wpMap = new Map(wps.map((w) => [w.id, w]));
        const reportMap = new Map(reports.map((r) => [r.id, r]));
        const findingMap = new Map(findings.map((f) => [f.id, f]));
        const engagementMap = new Map(engagements.map((e) => [e.id, e]));
        const resolveEntityMeta = (entityType, entityId) => {
            let entityReference = `${formatEntityType(entityType)} (${entityId.slice(0, 8)})`;
            let entityAuditType = null;
            if (entityType === 'audit_plan') {
                const p = planMap.get(entityId);
                if (p) {
                    entityReference = `${p.title} (FY ${p.year})`;
                    entityAuditType = p.audit_type;
                }
            }
            else if (entityType === 'audit_working_paper') {
                const w = wpMap.get(entityId);
                if (w) {
                    entityReference = `${w.engagement.reference_number}: ${w.title}`;
                    entityAuditType = w.engagement.audit_type;
                }
            }
            else if (entityType === 'audit_report') {
                const r = reportMap.get(entityId);
                if (r) {
                    entityReference = `${r.engagement.reference_number}: ${r.title}`;
                    entityAuditType = r.engagement.audit_type;
                }
            }
            else if (entityType === 'audit_finding_closure' || entityType === 'audit_finding') {
                const f = findingMap.get(entityId);
                if (f) {
                    entityReference = `${f.engagement.reference_number}: ${f.title}`;
                    entityAuditType = f.engagement.audit_type;
                }
            }
            else if (entityType === 'audit_engagement') {
                const e = engagementMap.get(entityId);
                if (e) {
                    entityReference = `${e.reference_number}: ${e.title}`;
                    entityAuditType = e.audit_type;
                }
            }
            return { entityReference, entityAuditType };
        };
        const cleanFilter = auditTypeFilter?.trim().toLowerCase();
        const matchesAuditType = (recordAuditType) => {
            if (!cleanFilter || cleanFilter === 'all')
                return true;
            if (!recordAuditType)
                return false;
            const norm = recordAuditType.toLowerCase();
            if (cleanFilter === 'it' || cleanFilter === 'systems') {
                return norm === 'it' || norm === 'systems';
            }
            return norm === cleanFilter;
        };
        const result = [];
        const matchedEscalationEntityIds = new Set();
        for (const a of rawApprovals) {
            const { entityReference, entityAuditType } = resolveEntityMeta(a.entity_type, a.entity_id);
            if (!matchesAuditType(entityAuditType)) {
                continue;
            }
            const actedSteps = a.steps
                .filter((s) => s.acted_at !== null || s.status === 'approved' || s.status === 'rejected')
                .sort((s1, s2) => {
                const t1 = s1.acted_at ? s1.acted_at.getTime() : 0;
                const t2 = s2.acted_at ? s2.acted_at.getTime() : 0;
                return t2 - t1 || s2.level - s1.level;
            });
            const lastStep = actedSteps[0];
            const lastActedByName = lastStep?.approver ? formatUserName(lastStep.approver) : null;
            const lastComment = a.rejection_reason || lastStep?.comment || null;
            const matchedEsc = allEscalationsByEntityId.get(a.entity_id) ?? allEscalationsByEntityId.get(a.id);
            if (matchedEsc) {
                matchedEscalationEntityIds.add(matchedEsc.entity_id);
            }
            const isEscalated = a.status === 'escalated' || Boolean(matchedEsc);
            result.push({
                id: a.id,
                entityType: a.entity_type,
                entityId: a.entity_id,
                entityReference,
                status: a.status,
                submittedByName: formatUserName(a.submitted_by),
                currentLevel: a.current_level,
                totalLevels: a.steps.length || 1,
                lastActedByName,
                lastComment: matchedEsc && !lastComment ? `Escalated: ${matchedEsc.reason}` : lastComment,
                createdAt: a.created_at.toISOString(),
                completedAt: a.completed_at ? a.completed_at.toISOString() : null,
                isEscalated,
                escalationLevel: matchedEsc?.escalation_level,
            });
        }
        for (const esc of rawEscalations) {
            if (matchedEscalationEntityIds.has(esc.entity_id))
                continue;
            const { entityReference, entityAuditType } = resolveEntityMeta(esc.entity_type, esc.entity_id);
            if (!matchesAuditType(entityAuditType)) {
                continue;
            }
            matchedEscalationEntityIds.add(esc.entity_id);
            result.push({
                id: `esc-${esc.id}`,
                entityType: esc.entity_type,
                entityId: esc.entity_id,
                entityReference,
                status: 'escalated',
                submittedByName: 'OLA Escalation Monitor',
                currentLevel: esc.escalation_level,
                totalLevels: esc.escalation_level,
                lastActedByName: esc.escalated_to ? formatUserName(esc.escalated_to) : null,
                lastComment: esc.reason,
                createdAt: esc.created_at.toISOString(),
                completedAt: esc.acknowledged_at ? esc.acknowledged_at.toISOString() : null,
                isEscalated: true,
                escalationLevel: esc.escalation_level,
            });
        }
        return result;
    }
    // ────────────────────────────────────────────────────────────
    // Export to Word (.docx) & PDF (.pdf)
    // ────────────────────────────────────────────────────────────
    async exportPeriodicReport(query, format, actor) {
        const { slugLabel } = this._computePeriod(query);
        const data = await this.getPeriodicReport(query, actor);
        const dateSuffix = (0, date_fns_1.format)(new Date(), 'yyyy-MM-dd');
        const fileName = `GBB-Periodic-Audit-Report-${slugLabel}-${dateSuffix}.${format}`;
        const mimeType = format === 'docx'
            ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
            : 'application/pdf';
        const buffer = format === 'docx' ? await this._generateDocx(data) : await this._generatePdf(data);
        return { fileName, mimeType, buffer };
    }
    _docxHeaderCell(text) {
        return new docx_1.TableCell({
            children: [
                new docx_1.Paragraph({
                    alignment: docx_1.AlignmentType.LEFT,
                    children: [new docx_1.TextRun({ text, bold: true, color: 'FFFFFF', size: 18 })],
                }),
            ],
            shading: { fill: GBB_NAVY, type: docx_1.ShadingType.SOLID },
            verticalAlign: docx_1.VerticalAlign.CENTER,
            margins: { top: 80, bottom: 80, left: 100, right: 100 },
        });
    }
    _docxBodyCell(text, opts) {
        return new docx_1.TableCell({
            children: [
                new docx_1.Paragraph({
                    children: [
                        new docx_1.TextRun({
                            text: text || '—',
                            bold: opts?.bold,
                            color: opts?.color ?? '1E293B',
                            size: 18,
                        }),
                    ],
                }),
            ],
            ...(opts?.fill ? { shading: { fill: opts.fill, type: docx_1.ShadingType.SOLID } } : {}),
            verticalAlign: docx_1.VerticalAlign.CENTER,
            margins: { top: 70, bottom: 70, left: 100, right: 100 },
        });
    }
    _docxTable(headers, rows) {
        const headerRow = new docx_1.TableRow({
            tableHeader: true,
            children: headers.map((h) => this._docxHeaderCell(h)),
        });
        const dataRows = rows.length > 0
            ? rows.map((cells) => new docx_1.TableRow({ children: cells }))
            : [
                new docx_1.TableRow({
                    children: [
                        new docx_1.TableCell({
                            columnSpan: headers.length,
                            children: [
                                new docx_1.Paragraph({
                                    alignment: docx_1.AlignmentType.CENTER,
                                    children: [
                                        new docx_1.TextRun({
                                            text: 'No records recorded for the selected reporting period.',
                                            italics: true,
                                            color: '64748B',
                                            size: 18,
                                        }),
                                    ],
                                }),
                            ],
                            margins: { top: 120, bottom: 120, left: 100, right: 100 },
                        }),
                    ],
                }),
            ];
        return new docx_1.Table({
            rows: [headerRow, ...dataRows],
            width: { size: 100, type: docx_1.WidthType.PERCENTAGE },
            borders: {
                top: { style: docx_1.BorderStyle.SINGLE, size: 2, color: 'CBD5E1' },
                bottom: { style: docx_1.BorderStyle.SINGLE, size: 2, color: 'CBD5E1' },
                left: { style: docx_1.BorderStyle.SINGLE, size: 2, color: 'CBD5E1' },
                right: { style: docx_1.BorderStyle.SINGLE, size: 2, color: 'CBD5E1' },
                insideHorizontal: { style: docx_1.BorderStyle.SINGLE, size: 1, color: 'E2E8F0' },
                insideVertical: { style: docx_1.BorderStyle.SINGLE, size: 1, color: 'E2E8F0' },
            },
        });
    }
    _docxSectionHeading(title) {
        return new docx_1.Paragraph({
            spacing: { before: 280, after: 120 },
            children: [
                new docx_1.TextRun({
                    text: title,
                    bold: true,
                    size: 24,
                    color: GBB_NAVY,
                }),
            ],
        });
    }
    async _generateDocx(data) {
        const children = [];
        const logoBuf = getGbbLogoBuffer();
        if (logoBuf) {
            children.push(new docx_1.Paragraph({
                alignment: docx_1.AlignmentType.CENTER,
                spacing: { before: 60, after: 100 },
                children: [
                    new docx_1.ImageRun({
                        type: 'png',
                        data: logoBuf,
                        transformation: { width: 130, height: 91 },
                    }),
                ],
            }));
        }
        children.push(new docx_1.Paragraph({
            alignment: docx_1.AlignmentType.CENTER,
            spacing: { before: 40, after: 120 },
            children: [
                new docx_1.TextRun({
                    text: 'GALAXY BACKBONE LIMITED',
                    bold: true,
                    size: 26,
                    color: GBB_NAVY,
                }),
            ],
        }));
        children.push(new docx_1.Table({
            rows: [
                new docx_1.TableRow({
                    children: [
                        new docx_1.TableCell({
                            shading: { fill: 'F8FAFC', type: docx_1.ShadingType.SOLID },
                            margins: { top: 200, bottom: 200, left: 200, right: 200 },
                            children: [
                                new docx_1.Paragraph({
                                    alignment: docx_1.AlignmentType.CENTER,
                                    spacing: { after: 80 },
                                    children: [
                                        new docx_1.TextRun({
                                            text: 'PERIODIC INTERNAL AUDIT ACTIVITY REPORT',
                                            bold: true,
                                            size: 30,
                                            color: GBB_NAVY,
                                        }),
                                    ],
                                }),
                                new docx_1.Paragraph({
                                    alignment: docx_1.AlignmentType.CENTER,
                                    spacing: { after: 60 },
                                    children: [
                                        new docx_1.TextRun({
                                            text: data.periodLabel,
                                            bold: true,
                                            size: 22,
                                            color: '334155',
                                        }),
                                    ],
                                }),
                                new docx_1.Paragraph({
                                    alignment: docx_1.AlignmentType.CENTER,
                                    children: [
                                        new docx_1.TextRun({
                                            text: `Scope: ${data.auditTypeFilter ? formatAuditType(data.auditTypeFilter) : 'All Audit Domains'}  |  Generated: ${(0, date_fns_1.format)(new Date(data.generatedAt), 'dd MMM yyyy, HH:mm')}  |  Prepared by: ${data.generatedBy}`,
                                            size: 18,
                                            color: '64748B',
                                        }),
                                    ],
                                }),
                            ],
                        }),
                    ],
                }),
            ],
            width: { size: 100, type: docx_1.WidthType.PERCENTAGE },
            borders: {
                top: { style: docx_1.BorderStyle.SINGLE, size: 18, color: GBB_ACCENT_GREEN },
                bottom: { style: docx_1.BorderStyle.SINGLE, size: 18, color: GBB_ACCENT_GREEN },
                left: { style: docx_1.BorderStyle.NONE, size: 0, color: 'auto' },
                right: { style: docx_1.BorderStyle.NONE, size: 0, color: 'auto' },
                insideHorizontal: { style: docx_1.BorderStyle.NONE, size: 0, color: 'auto' },
                insideVertical: { style: docx_1.BorderStyle.NONE, size: 0, color: 'auto' },
            },
        }));
        // 1. Executive Summary & Key Metrics
        children.push(this._docxSectionHeading('1. Executive Summary & Key Metrics'));
        const s = data.summary;
        children.push(this._docxTable(['Audit Activity Pillar', 'Total', 'Primary Breakdown', 'Secondary / Risk Breakdown'], [
            [
                this._docxBodyCell('Audit Programmes (Plans)', { bold: true, fill: 'F8FAFC' }),
                this._docxBodyCell(String(s.totalProgrammes), { bold: true }),
                this._docxBodyCell(`Approved: ${s.approvedProgrammes} | Pending: ${s.pendingProgrammes}`),
                this._docxBodyCell(`Rejected: ${s.rejectedProgrammes}`),
            ],
            [
                this._docxBodyCell('Audit Engagements', { bold: true, fill: 'F8FAFC' }),
                this._docxBodyCell(String(s.totalEngagements), { bold: true }),
                this._docxBodyCell(`Started in Period: ${s.engagementsStartedInPeriod} | Closed in Period: ${s.engagementsClosedInPeriod}`),
                this._docxBodyCell(`Overdue OLA: ${s.engagementsOverdue} | In Progress: ${s.engagementsByStatus.in_progress} | QA: ${s.engagementsByStatus.under_review}`),
            ],
            [
                this._docxBodyCell('Audit Reviews (Reports)', { bold: true, fill: 'F8FAFC' }),
                this._docxBodyCell(String(data.reports.length), { bold: true }),
                this._docxBodyCell(`Published / Issued: ${s.reportsPublished} | Approved: ${s.reportsApproved}`),
                this._docxBodyCell(`In Review (Submitted): ${s.reportsSubmitted} | Draft: ${s.reportsDraft} | Rejected: ${s.reportsRejected}`),
            ],
            [
                this._docxBodyCell('Workflow Approvals', { bold: true, fill: 'F8FAFC' }),
                this._docxBodyCell(String(s.approvalsTotalInPeriod), { bold: true }),
                this._docxBodyCell(`Approved: ${s.approvalsApproved} | Pending: ${s.approvalsPending}`),
                this._docxBodyCell(`Rejected: ${s.approvalsRejected} | Escalated: ${s.approvalsEscalated}`),
            ],
            [
                this._docxBodyCell('Audit Findings & Follow-Up', { bold: true, fill: 'F8FAFC' }),
                this._docxBodyCell(String(data.findings.length), { bold: true }),
                this._docxBodyCell(`Raised in Period: ${s.findingsRaisedInPeriod} | Closed in Period: ${s.findingsClosedInPeriod} | Open: ${s.findingsOpenTotal}`),
                this._docxBodyCell(`Critical: ${s.findingsBySeverity.critical} | High: ${s.findingsBySeverity.high} | Medium: ${s.findingsBySeverity.medium} | Low: ${s.findingsBySeverity.low}`),
            ],
        ]));
        // 2. Audit Programmes
        children.push(this._docxSectionHeading('2. Audit Programmes'));
        children.push(this._docxTable(['Title', 'Year', 'Audit Type', 'Status', 'Planned Items', 'Engagements Created', 'Approved By / Reason'], data.programmes.map((p) => [
            this._docxBodyCell(p.title, { bold: true }),
            this._docxBodyCell(String(p.year)),
            this._docxBodyCell(formatAuditType(p.auditType)),
            this._docxBodyCell(formatStatusLabel(p.status)),
            this._docxBodyCell(String(p.itemsCount)),
            this._docxBodyCell(String(p.engagementsCreatedCount)),
            this._docxBodyCell(p.status === 'rejected' && p.rejectionReason
                ? `Rejected: ${p.rejectionReason}`
                : p.approvedByName
                    ? `${p.approvedByName}${p.approvedAt ? ` (${(0, date_fns_1.format)(new Date(p.approvedAt), 'dd MMM yyyy')})` : ''}`
                    : '—'),
        ])));
        // 3. Audit Engagements
        children.push(this._docxSectionHeading('3. Audit Engagements'));
        const totalEngCount = s.totalEngagements || 0;
        const pctStr = (cnt, tot) => tot > 0 ? `${Math.round((cnt / tot) * 100)}%` : '0%';
        const statusBreakdownRows = [
            ['Planned', s.engagementsByStatus.planned],
            ['In Progress', s.engagementsByStatus.in_progress],
            ['Quality Assurance / Under Review', s.engagementsByStatus.under_review],
            ['Review Issued / Reported', s.engagementsByStatus.reported],
            ['Closed', s.engagementsByStatus.closed],
        ];
        children.push(this._docxTable(['Engagement Stage / Status', 'Count', '% of Total'], statusBreakdownRows.map(([label, cnt]) => [
            this._docxBodyCell(label, { bold: true }),
            this._docxBodyCell(String(cnt)),
            this._docxBodyCell(pctStr(cnt, totalEngCount)),
        ])));
        const typeKeys = Array.from(new Set([...CANONICAL_AUDIT_TYPES, ...Object.keys(s.engagementsByType)]));
        children.push(this._docxTable(['Audit Type', 'Engagements Count', '% of Total'], typeKeys.map((typeKey) => {
            const cnt = s.engagementsByType[typeKey] ?? 0;
            return [
                this._docxBodyCell(formatAuditType(typeKey), { bold: true }),
                this._docxBodyCell(String(cnt)),
                this._docxBodyCell(pctStr(cnt, totalEngCount)),
            ];
        })));
        children.push(this._docxTable(['Reference', 'Title', 'Entity', 'Type', 'Stage', 'Lead Auditor', 'Manager', 'Auditee', 'OLA Deadline'], data.engagements.map((e) => [
            this._docxBodyCell(e.referenceNumber, { bold: true }),
            this._docxBodyCell(e.title),
            this._docxBodyCell(e.universeName),
            this._docxBodyCell(formatAuditType(e.auditType)),
            this._docxBodyCell(formatStatusLabel(e.status)),
            this._docxBodyCell(e.leadAuditorName),
            this._docxBodyCell(e.auditManagerName),
            this._docxBodyCell(e.auditeeName),
            this._docxBodyCell(`${(0, date_fns_1.format)(new Date(e.olaDeadline), 'dd MMM yyyy')}${e.isOverdue ? ' (OVERDUE)' : ''}`, e.isOverdue ? { bold: true, color: 'DC2626' } : undefined),
        ])));
        // 4. Audit Reports Issued & In Progress
        children.push(this._docxSectionHeading('4. Audit Reports Issued & In Progress'));
        children.push(this._docxTable(['Draft', 'In Review (Submitted)', 'Approved', 'Published / Issued', 'Rejected', 'Total Reviews'], [
            [
                this._docxBodyCell(String(s.reportsDraft), { bold: true }),
                this._docxBodyCell(String(s.reportsSubmitted), { bold: true }),
                this._docxBodyCell(String(s.reportsApproved), { bold: true }),
                this._docxBodyCell(String(s.reportsPublished), { bold: true }),
                this._docxBodyCell(String(s.reportsRejected), { bold: true }),
                this._docxBodyCell(String(data.reports.length), { bold: true }),
            ],
        ]));
        children.push(this._docxTable(['Report Title', 'Engagement Ref', 'Audit Type', 'Version', 'Status', 'Author', 'Issued Date / Notes'], data.reports.map((r) => [
            this._docxBodyCell(r.title, { bold: true }),
            this._docxBodyCell(r.engagementReference),
            this._docxBodyCell(formatAuditType(r.auditType)),
            this._docxBodyCell(`v${r.versionNumber}.0`),
            this._docxBodyCell(formatStatusLabel(r.status)),
            this._docxBodyCell(r.createdByName),
            this._docxBodyCell(r.rejectionReason
                ? `Rejected: ${r.rejectionReason}`
                : r.issuedAt
                    ? (0, date_fns_1.format)(new Date(r.issuedAt), 'dd MMM yyyy')
                    : 'In progress'),
        ])));
        // 5. Approvals Breakdown
        children.push(this._docxSectionHeading('5. Approvals Breakdown (Pending, Approved, Rejected, Escalated)'));
        children.push(this._docxTable(['Record Type', 'Subject / Reference', 'Status', 'Submitted By', 'Level', 'Last Reviewer', 'Reviewer Comment / Reason'], data.approvals.map((a) => [
            this._docxBodyCell(formatEntityType(a.entityType)),
            this._docxBodyCell(a.entityReference, { bold: true }),
            this._docxBodyCell(`${formatStatusLabel(a.status)}${a.isEscalated && a.status !== 'escalated' ? ' (Escalated)' : ''}`, a.status === 'rejected'
                ? { bold: true, color: 'DC2626' }
                : a.status === 'approved'
                    ? { bold: true, color: '166534' }
                    : a.status === 'escalated' || a.isEscalated
                        ? { bold: true, color: '6B21A8' }
                        : undefined),
            this._docxBodyCell(a.submittedByName),
            this._docxBodyCell(`Level ${a.currentLevel} of ${a.totalLevels}`),
            this._docxBodyCell(a.lastActedByName ?? '—'),
            this._docxBodyCell(a.lastComment ?? '—'),
        ])));
        // 6. Findings & Remediation Summary
        children.push(this._docxSectionHeading('6. Findings & Remediation Summary'));
        children.push(this._docxTable(['Finding Title', 'Engagement', 'Severity', 'Category', 'Status', 'Auditee', 'Due Date', 'Mgmt Response'], data.findings.map((f) => [
            this._docxBodyCell(f.title, { bold: true }),
            this._docxBodyCell(f.engagementReference),
            this._docxBodyCell(f.severity.toUpperCase(), { bold: true }),
            this._docxBodyCell(formatAuditType(f.category)),
            this._docxBodyCell(formatStatusLabel(f.status)),
            this._docxBodyCell(f.auditeeName),
            this._docxBodyCell((0, date_fns_1.format)(new Date(f.dueDate), 'dd MMM yyyy')),
            this._docxBodyCell(f.hasManagementResponse ? 'Received' : 'Pending'),
        ])));
        const doc = new docx_1.Document({
            sections: [
                {
                    properties: {
                        page: {
                            size: { orientation: docx_1.PageOrientation.LANDSCAPE },
                            margin: {
                                top: (0, docx_1.convertInchesToTwip)(0.6),
                                bottom: (0, docx_1.convertInchesToTwip)(0.6),
                                left: (0, docx_1.convertInchesToTwip)(0.6),
                                right: (0, docx_1.convertInchesToTwip)(0.6),
                            },
                        },
                    },
                    footers: {
                        default: new docx_1.Footer({
                            children: [
                                new docx_1.Paragraph({
                                    alignment: docx_1.AlignmentType.CENTER,
                                    children: [
                                        new docx_1.TextRun({
                                            text: `Galaxy Backbone Limited — Confidential Periodic Audit Activity Report (${data.periodLabel}) — Page `,
                                            size: 16,
                                            color: '64748B',
                                        }),
                                        new docx_1.TextRun({
                                            children: [docx_1.PageNumber.CURRENT],
                                            size: 16,
                                            color: '64748B',
                                        }),
                                        new docx_1.TextRun({
                                            text: ' of ',
                                            size: 16,
                                            color: '64748B',
                                        }),
                                        new docx_1.TextRun({
                                            children: [docx_1.PageNumber.TOTAL_PAGES],
                                            size: 16,
                                            color: '64748B',
                                        }),
                                    ],
                                }),
                            ],
                        }),
                    },
                    children,
                },
            ],
        });
        const uint8 = await docx_1.Packer.toBuffer(doc);
        return Buffer.from(uint8);
    }
    async _generatePdf(data) {
        const logoBuf = getGbbLogoBuffer();
        const logoDataUrl = logoBuf ? `data:image/png;base64,${logoBuf.toString('base64')}` : null;
        const s = data.summary;
        const headerCell = (text) => ({
            text,
            bold: true,
            color: '#FFFFFF',
            fillColor: GBB_NAVY_HEX,
            fontSize: 8.5,
        });
        const bodyCell = (text, opts) => ({
            text: text || '—',
            bold: opts?.bold,
            color: opts?.color ?? '#1E293B',
            fillColor: opts?.fillColor,
            fontSize: 8,
        });
        const emptyRow = (colSpan) => {
            const row = [
                {
                    text: 'No records recorded for the selected reporting period.',
                    colSpan,
                    italics: true,
                    color: '#64748B',
                    alignment: 'center',
                    fontSize: 8.5,
                },
            ];
            for (let i = 1; i < colSpan; i += 1) {
                row.push({});
            }
            return row;
        };
        const content = [
            ...(logoDataUrl
                ? [{ image: logoDataUrl, width: 105, alignment: 'center', margin: [0, 0, 0, 6] }]
                : []),
            {
                text: 'GALAXY BACKBONE LIMITED',
                bold: true,
                fontSize: 13,
                color: GBB_NAVY_HEX,
                alignment: 'center',
                margin: [0, 0, 0, 4],
            },
            {
                table: {
                    widths: ['*'],
                    body: [
                        [
                            {
                                stack: [
                                    {
                                        text: 'PERIODIC INTERNAL AUDIT ACTIVITY REPORT',
                                        bold: true,
                                        fontSize: 14,
                                        color: GBB_NAVY_HEX,
                                        alignment: 'center',
                                        margin: [0, 2, 0, 2],
                                    },
                                    {
                                        text: data.periodLabel,
                                        bold: true,
                                        fontSize: 10.5,
                                        color: '#334155',
                                        alignment: 'center',
                                        margin: [0, 0, 0, 3],
                                    },
                                    {
                                        text: `Scope: ${data.auditTypeFilter ? formatAuditType(data.auditTypeFilter) : 'All Audit Domains'}  |  Generated: ${(0, date_fns_1.format)(new Date(data.generatedAt), 'dd MMM yyyy, HH:mm')}  |  Prepared by: ${data.generatedBy}`,
                                        fontSize: 8.5,
                                        color: '#64748B',
                                        alignment: 'center',
                                    },
                                ],
                                fillColor: '#F8FAFC',
                                margin: [8, 6, 8, 6],
                            },
                        ],
                    ],
                },
                layout: {
                    hLineWidth: (i, node) => i === 0 || i === node.table.body.length ? 2.5 : 0,
                    vLineWidth: () => 0,
                    hLineColor: () => '#4F6228',
                },
                margin: [0, 0, 0, 12],
            },
            // Section 1: Executive Summary
            { text: '1. Executive Summary & Key Metrics', style: 'sectionTitle', margin: [0, 8, 0, 6] },
            {
                table: {
                    headerRows: 1,
                    widths: [150, 50, '*', '*'],
                    body: [
                        ['Audit Activity Pillar', 'Total', 'Primary Breakdown', 'Secondary / Risk Breakdown'].map(headerCell),
                        [
                            bodyCell('Audit Programmes (Plans)', { bold: true, fillColor: '#F8FAFC' }),
                            bodyCell(String(s.totalProgrammes), { bold: true }),
                            bodyCell(`Approved: ${s.approvedProgrammes}  |  Pending: ${s.pendingProgrammes}`),
                            bodyCell(`Rejected: ${s.rejectedProgrammes}`),
                        ],
                        [
                            bodyCell('Audit Engagements', { bold: true, fillColor: '#F8FAFC' }),
                            bodyCell(String(s.totalEngagements), { bold: true }),
                            bodyCell(`Started in Period: ${s.engagementsStartedInPeriod}  |  Closed in Period: ${s.engagementsClosedInPeriod}`),
                            bodyCell(`Overdue OLA: ${s.engagementsOverdue}  |  In Progress: ${s.engagementsByStatus.in_progress}  |  QA: ${s.engagementsByStatus.under_review}`),
                        ],
                        [
                            bodyCell('Audit Reviews (Reports)', { bold: true, fillColor: '#F8FAFC' }),
                            bodyCell(String(data.reports.length), { bold: true }),
                            bodyCell(`Published / Issued: ${s.reportsPublished}  |  Approved: ${s.reportsApproved}`),
                            bodyCell(`In Review: ${s.reportsSubmitted}  |  Draft: ${s.reportsDraft}  |  Rejected: ${s.reportsRejected}`),
                        ],
                        [
                            bodyCell('Workflow Approvals', { bold: true, fillColor: '#F8FAFC' }),
                            bodyCell(String(s.approvalsTotalInPeriod), { bold: true }),
                            bodyCell(`Approved: ${s.approvalsApproved}  |  Pending: ${s.approvalsPending}`),
                            bodyCell(`Rejected: ${s.approvalsRejected}  |  Escalated: ${s.approvalsEscalated}`),
                        ],
                        [
                            bodyCell('Audit Findings & Follow-Up', { bold: true, fillColor: '#F8FAFC' }),
                            bodyCell(String(data.findings.length), { bold: true }),
                            bodyCell(`Raised: ${s.findingsRaisedInPeriod}  |  Closed: ${s.findingsClosedInPeriod}  |  Open: ${s.findingsOpenTotal}`),
                            bodyCell(`Critical: ${s.findingsBySeverity.critical}  |  High: ${s.findingsBySeverity.high}  |  Medium: ${s.findingsBySeverity.medium}  |  Low: ${s.findingsBySeverity.low}`),
                        ],
                    ],
                },
                layout: pdf_util_1.borderedTableLayout,
                margin: [0, 0, 0, 12],
            },
            // Section 2: Programmes
            { text: '2. Audit Programmes', style: 'sectionTitle', margin: [0, 10, 0, 6] },
            {
                table: {
                    headerRows: 1,
                    widths: ['*', 40, 90, 65, 55, 65, 140],
                    body: [
                        ['Title', 'Year', 'Audit Type', 'Status', 'Items', 'Engagements', 'Approved By / Reason'].map(headerCell),
                        ...(data.programmes.length > 0
                            ? data.programmes.map((p) => [
                                bodyCell(p.title, { bold: true }),
                                bodyCell(String(p.year)),
                                bodyCell(formatAuditType(p.auditType)),
                                bodyCell(formatStatusLabel(p.status)),
                                bodyCell(String(p.itemsCount)),
                                bodyCell(String(p.engagementsCreatedCount)),
                                bodyCell(p.status === 'rejected' && p.rejectionReason
                                    ? `Rejected: ${p.rejectionReason}`
                                    : p.approvedByName
                                        ? `${p.approvedByName}${p.approvedAt ? ` (${(0, date_fns_1.format)(new Date(p.approvedAt), 'dd MMM yyyy')})` : ''}`
                                        : '—'),
                            ])
                            : [emptyRow(7)]),
                    ],
                },
                layout: pdf_util_1.borderedTableLayout,
                margin: [0, 0, 0, 12],
            },
            // Section 3: Engagements
            { text: '3. Audit Engagements', style: 'sectionTitle', margin: [0, 10, 0, 6] },
            {
                columns: [
                    {
                        width: '*',
                        table: {
                            headerRows: 1,
                            widths: ['*', 50, 60],
                            body: [
                                ['Engagement Stage / Status', 'Count', '% of Total'].map(headerCell),
                                ...[
                                    ['Planned', s.engagementsByStatus.planned],
                                    ['In Progress', s.engagementsByStatus.in_progress],
                                    ['Quality Assurance / Under Review', s.engagementsByStatus.under_review],
                                    ['Review Issued / Reported', s.engagementsByStatus.reported],
                                    ['Closed', s.engagementsByStatus.closed],
                                ].map(([label, cnt]) => [
                                    bodyCell(label, { bold: true }),
                                    bodyCell(String(cnt)),
                                    bodyCell(s.totalEngagements > 0
                                        ? `${Math.round((cnt / s.totalEngagements) * 100)}%`
                                        : '0%'),
                                ]),
                            ],
                        },
                        layout: pdf_util_1.borderedTableLayout,
                    },
                    { width: 14, text: '' },
                    {
                        width: '*',
                        table: {
                            headerRows: 1,
                            widths: ['*', 50, 60],
                            body: [
                                ['Audit Type', 'Count', '% of Total'].map(headerCell),
                                ...Array.from(new Set([...CANONICAL_AUDIT_TYPES, ...Object.keys(s.engagementsByType)])).map((typeKey) => {
                                    const cnt = s.engagementsByType[typeKey] ?? 0;
                                    return [
                                        bodyCell(formatAuditType(typeKey), { bold: true }),
                                        bodyCell(String(cnt)),
                                        bodyCell(s.totalEngagements > 0
                                            ? `${Math.round((cnt / s.totalEngagements) * 100)}%`
                                            : '0%'),
                                    ];
                                }),
                            ],
                        },
                        layout: pdf_util_1.borderedTableLayout,
                    },
                ],
                margin: [0, 0, 0, 8],
            },
            {
                table: {
                    headerRows: 1,
                    widths: [65, '*', 85, 70, 65, 75, 75, 75, 75],
                    body: [
                        ['Reference', 'Title', 'Entity', 'Type', 'Stage', 'Lead', 'Manager', 'Auditee', 'OLA Deadline'].map(headerCell),
                        ...(data.engagements.length > 0
                            ? data.engagements.map((e) => [
                                bodyCell(e.referenceNumber, { bold: true }),
                                bodyCell(e.title),
                                bodyCell(e.universeName),
                                bodyCell(formatAuditType(e.auditType)),
                                bodyCell(formatStatusLabel(e.status)),
                                bodyCell(e.leadAuditorName),
                                bodyCell(e.auditManagerName),
                                bodyCell(e.auditeeName),
                                bodyCell(`${(0, date_fns_1.format)(new Date(e.olaDeadline), 'dd MMM yyyy')}${e.isOverdue ? ' (OVERDUE)' : ''}`, e.isOverdue ? { bold: true, color: '#DC2626' } : undefined),
                            ])
                            : [emptyRow(9)]),
                    ],
                },
                layout: pdf_util_1.borderedTableLayout,
                margin: [0, 0, 0, 12],
            },
            // Section 4: Audit Reports
            { text: '4. Audit Reports Issued & In Progress', style: 'sectionTitle', margin: [0, 10, 0, 6] },
            {
                table: {
                    headerRows: 1,
                    widths: ['*', '*', '*', '*', '*', '*'],
                    body: [
                        [
                            'Draft',
                            'In Review (Submitted)',
                            'Approved',
                            'Published / Issued',
                            'Rejected',
                            'Total Reviews',
                        ].map(headerCell),
                        [
                            bodyCell(String(s.reportsDraft), { bold: true }),
                            bodyCell(String(s.reportsSubmitted), { bold: true }),
                            bodyCell(String(s.reportsApproved), { bold: true }),
                            bodyCell(String(s.reportsPublished), { bold: true }),
                            bodyCell(String(s.reportsRejected), { bold: true }),
                            bodyCell(String(data.reports.length), { bold: true }),
                        ],
                    ],
                },
                layout: pdf_util_1.borderedTableLayout,
                margin: [0, 0, 0, 8],
            },
            {
                table: {
                    headerRows: 1,
                    widths: ['*', 80, 80, 45, 65, 90, 130],
                    body: [
                        ['Report Title', 'Engagement Ref', 'Audit Type', 'Version', 'Status', 'Author', 'Issued Date / Notes'].map(headerCell),
                        ...(data.reports.length > 0
                            ? data.reports.map((r) => [
                                bodyCell(r.title, { bold: true }),
                                bodyCell(r.engagementReference),
                                bodyCell(formatAuditType(r.auditType)),
                                bodyCell(`v${r.versionNumber}.0`),
                                bodyCell(formatStatusLabel(r.status)),
                                bodyCell(r.createdByName),
                                bodyCell(r.rejectionReason
                                    ? `Rejected: ${r.rejectionReason}`
                                    : r.issuedAt
                                        ? (0, date_fns_1.format)(new Date(r.issuedAt), 'dd MMM yyyy')
                                        : 'In progress'),
                            ])
                            : [emptyRow(7)]),
                    ],
                },
                layout: pdf_util_1.borderedTableLayout,
                margin: [0, 0, 0, 12],
            },
            // Section 5: Approvals
            {
                text: '5. Approvals Breakdown (Pending, Approved, Rejected, Escalated)',
                style: 'sectionTitle',
                margin: [0, 10, 0, 6],
            },
            {
                table: {
                    headerRows: 1,
                    widths: [85, '*', 65, 85, 55, 85, 135],
                    body: [
                        [
                            'Record Type',
                            'Subject / Reference',
                            'Status',
                            'Submitted By',
                            'Level',
                            'Last Reviewer',
                            'Reviewer Comment / Reason',
                        ].map(headerCell),
                        ...(data.approvals.length > 0
                            ? data.approvals.map((a) => [
                                bodyCell(formatEntityType(a.entityType)),
                                bodyCell(a.entityReference, { bold: true }),
                                bodyCell(`${formatStatusLabel(a.status)}${a.isEscalated && a.status !== 'escalated' ? ' (Escalated)' : ''}`, a.status === 'rejected'
                                    ? { bold: true, color: '#DC2626' }
                                    : a.status === 'approved'
                                        ? { bold: true, color: '#166534' }
                                        : a.status === 'escalated' || a.isEscalated
                                            ? { bold: true, color: '#6B21A8' }
                                            : undefined),
                                bodyCell(a.submittedByName),
                                bodyCell(`${a.currentLevel}/${a.totalLevels}`),
                                bodyCell(a.lastActedByName ?? '—'),
                                bodyCell(a.lastComment ?? '—'),
                            ])
                            : [emptyRow(7)]),
                    ],
                },
                layout: pdf_util_1.borderedTableLayout,
                margin: [0, 0, 0, 12],
            },
            // Section 6: Findings
            { text: '6. Findings & Remediation Summary', style: 'sectionTitle', margin: [0, 10, 0, 6] },
            {
                table: {
                    headerRows: 1,
                    widths: ['*', 75, 65, 70, 75, 85, 65, 65],
                    body: [
                        ['Finding Title', 'Engagement', 'Severity', 'Category', 'Status', 'Auditee', 'Due Date', 'Mgmt Resp.'].map(headerCell),
                        ...(data.findings.length > 0
                            ? data.findings.map((f) => [
                                bodyCell(f.title, { bold: true }),
                                bodyCell(f.engagementReference),
                                (0, pdf_util_1.severityBadge)(f.severity),
                                bodyCell(formatAuditType(f.category)),
                                bodyCell(formatStatusLabel(f.status)),
                                bodyCell(f.auditeeName),
                                bodyCell((0, date_fns_1.format)(new Date(f.dueDate), 'dd MMM yyyy')),
                                bodyCell(f.hasManagementResponse ? 'Received' : 'Pending'),
                            ])
                            : [emptyRow(8)]),
                    ],
                },
                layout: pdf_util_1.borderedTableLayout,
                margin: [0, 0, 0, 12],
            },
        ];
        const docDef = {
            pageSize: 'A4',
            pageOrientation: 'landscape',
            pageMargins: [(0, pdf_util_1.mm)(14), (0, pdf_util_1.mm)(14), (0, pdf_util_1.mm)(14), (0, pdf_util_1.mm)(18)],
            footer: (currentPage, pageCount) => ({
                text: `Galaxy Backbone Limited — Confidential Periodic Audit Activity Report (${data.periodLabel}) — Page ${currentPage} of ${pageCount}`,
                alignment: 'center',
                fontSize: 8,
                color: '#64748B',
                margin: [(0, pdf_util_1.mm)(14), 6, (0, pdf_util_1.mm)(14), 0],
            }),
            content,
            styles: {
                sectionTitle: {
                    fontSize: 11.5,
                    bold: true,
                    color: GBB_NAVY_HEX,
                },
            },
        };
        return (0, pdf_util_1.renderPdf)(docDef);
    }
}
exports.PeriodicReportService = PeriodicReportService;
//# sourceMappingURL=periodic-report.service.js.map