"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.warehouseService = exports.WarehouseService = void 0;
const prisma_client_1 = require("../../../../shared/prisma/prisma.client");
const logger_util_1 = require("../../../../shared/utils/logger.util");
const ACTIVE_ENGAGEMENT_STATUSES = ['planned', 'in_progress', 'under_review'];
const ACTIVE_FINDING_STATUSES = [
    'open',
    'management_response_received',
    'in_remediation',
    'verified',
    'pending_closure',
];
const startOfUtcDay = (date) => new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
const unique = (values) => [...new Set(values)];
const decimalToNumber = (value) => Number(value.toString());
/**
 * The warehouse is an internal, computed read-store for the predictive module.
 * It reads from IAMS' own database only and intentionally keeps document
 * content, request bodies and user contact details out of feature snapshots.
 */
class WarehouseService {
    async capturePredictiveSnapshots() {
        const snapshotDate = startOfUtcDay(new Date());
        const [engagements, findings, requests] = await Promise.all([
            this.getEngagementSignals(),
            this.getFindingSignals(),
            this.getEvidenceRequestSignals(),
        ]);
        await Promise.all([
            this._upsertSnapshots('audit_engagement', snapshotDate, engagements.map((engagement) => ({
                id: engagement.id,
                features: {
                    status: engagement.status,
                    checklistTotal: engagement.checklistTotal,
                    checklistTested: engagement.checklistTested,
                    workingPaperTotal: engagement.workingPaperTotal,
                    workingPaperApproved: engagement.workingPaperApproved,
                    openEvidenceRequests: engagement.openEvidenceRequests,
                    plannedHours: engagement.plannedHours,
                    actualHours: engagement.actualHours,
                    slaDeadline: engagement.slaDeadline.toISOString(),
                },
            }))),
            this._upsertSnapshots('audit_finding', snapshotDate, findings.map((finding) => ({
                id: finding.id,
                features: {
                    status: finding.status,
                    severity: finding.severity,
                    dueDate: finding.dueDate.toISOString(),
                    hasManagementResponse: finding.hasManagementResponse,
                    hasRemediationEvidence: finding.hasRemediationEvidence,
                },
            }))),
            this._upsertSnapshots('audit_evidence_request', snapshotDate, requests.map((request) => ({
                id: request.id,
                features: {
                    status: request.status,
                    dueDate: request.dueDate?.toISOString() ?? null,
                },
            }))),
        ]);
        const outcomesRecorded = await this._recordOutcomes();
        logger_util_1.logger.info('Predictive warehouse snapshot captured', {
            snapshotDate: snapshotDate.toISOString(),
            engagementSnapshots: engagements.length,
            findingSnapshots: findings.length,
            evidenceRequestSnapshots: requests.length,
            outcomesRecorded,
        });
        return {
            snapshotDate: snapshotDate.toISOString(),
            engagementSnapshots: engagements.length,
            findingSnapshots: findings.length,
            evidenceRequestSnapshots: requests.length,
            outcomesRecorded,
        };
    }
    async getSnapshotStatus() {
        const stats = await prisma_client_1.prisma.predictive_Snapshot.aggregate({
            _count: { _all: true },
            _max: { created_at: true },
        });
        return {
            snapshotCount: stats._count._all,
            lastSnapshotAt: stats._max.created_at?.toISOString() ?? null,
        };
    }
    async getEngagementSignals() {
        const engagements = await prisma_client_1.prisma.audit_Engagement.findMany({
            where: {
                deleted_at: null,
                status: { in: [...ACTIVE_ENGAGEMENT_STATUSES] },
            },
            select: {
                id: true,
                reference_number: true,
                title: true,
                status: true,
                planned_start_date: true,
                actual_start_date: true,
                sla_deadline: true,
                planned_hours: true,
                checklists: { select: { result: true } },
                working_papers: { where: { deleted_at: null }, select: { status: true } },
                evidence_requests: { where: { deleted_at: null }, select: { status: true } },
                time_entries: { where: { deleted_at: null }, select: { hours: true } },
            },
        });
        return engagements.map((engagement) => ({
            id: engagement.id,
            referenceNumber: engagement.reference_number,
            title: engagement.title,
            status: engagement.status,
            plannedStartDate: engagement.planned_start_date,
            actualStartDate: engagement.actual_start_date,
            slaDeadline: engagement.sla_deadline,
            checklistTotal: engagement.checklists.length,
            checklistTested: engagement.checklists.filter((checklist) => checklist.result !== 'not_tested').length,
            workingPaperTotal: engagement.working_papers.length,
            workingPaperApproved: engagement.working_papers.filter((paper) => paper.status === 'approved').length,
            openEvidenceRequests: engagement.evidence_requests.filter((request) => request.status === 'open').length,
            plannedHours: engagement.planned_hours,
            actualHours: engagement.time_entries.reduce((total, entry) => total + decimalToNumber(entry.hours), 0),
        }));
    }
    async getFindingSignals() {
        const findings = await prisma_client_1.prisma.audit_Finding.findMany({
            where: {
                deleted_at: null,
                status: { in: [...ACTIVE_FINDING_STATUSES] },
            },
            select: {
                id: true,
                title: true,
                status: true,
                severity: true,
                due_date: true,
                follow_up: {
                    select: {
                        management_response: true,
                        remediation_evidence_id: true,
                    },
                },
            },
        });
        return findings.map((finding) => ({
            id: finding.id,
            title: finding.title,
            status: finding.status,
            severity: finding.severity,
            dueDate: finding.due_date,
            hasManagementResponse: Boolean(finding.follow_up?.management_response?.trim()),
            hasRemediationEvidence: Boolean(finding.follow_up?.remediation_evidence_id),
        }));
    }
    async getEvidenceRequestSignals() {
        const requests = await prisma_client_1.prisma.audit_Evidence_Request.findMany({
            where: { deleted_at: null, status: 'open' },
            select: { id: true, title: true, status: true, due_date: true },
        });
        return requests.map((request) => ({
            id: request.id,
            title: request.title,
            status: request.status,
            dueDate: request.due_date,
        }));
    }
    async getInsightTargetDetails(targets) {
        const engagementIds = unique(targets.filter((target) => target.entityType === 'audit_engagement').map((target) => target.entityId));
        const findingIds = unique(targets.filter((target) => target.entityType === 'audit_finding').map((target) => target.entityId));
        const requestIds = unique(targets.filter((target) => target.entityType === 'audit_evidence_request').map((target) => target.entityId));
        const [engagements, findings, requests] = await Promise.all([
            engagementIds.length === 0 ? [] : prisma_client_1.prisma.audit_Engagement.findMany({
                where: { id: { in: engagementIds }, deleted_at: null },
                select: {
                    id: true,
                    lead_auditor_id: true,
                    audit_manager_id: true,
                    auditee_id: true,
                    workflow_assignments: { select: { user_id: true } },
                },
            }),
            findingIds.length === 0 ? [] : prisma_client_1.prisma.audit_Finding.findMany({
                where: { id: { in: findingIds }, deleted_at: null },
                select: {
                    id: true,
                    auditee_id: true,
                    responders: { select: { user_id: true } },
                    engagement: {
                        select: {
                            id: true,
                            lead_auditor_id: true,
                            audit_manager_id: true,
                            workflow_assignments: { select: { user_id: true } },
                            report: { select: { status: true } },
                        },
                    },
                },
            }),
            requestIds.length === 0 ? [] : prisma_client_1.prisma.audit_Evidence_Request.findMany({
                where: { id: { in: requestIds }, deleted_at: null },
                select: {
                    id: true,
                    assigned_to_id: true,
                    engagement: {
                        select: {
                            id: true,
                            lead_auditor_id: true,
                            audit_manager_id: true,
                            auditee_id: true,
                            workflow_assignments: { select: { user_id: true } },
                        },
                    },
                },
            }),
        ]);
        const engagementDetails = engagements.map((engagement) => ({
            entityType: 'audit_engagement',
            entityId: engagement.id,
            engagementId: engagement.id,
            actionUrl: `/audit/engagements/${engagement.id}`,
            teamUserIds: unique([
                engagement.lead_auditor_id,
                engagement.audit_manager_id,
                ...engagement.workflow_assignments.map((assignment) => assignment.user_id),
            ]),
            auditeeUserIds: [engagement.auditee_id],
            evidenceRequestAssigneeId: null,
            reportIssued: false,
        }));
        const findingDetails = findings.map((finding) => ({
            entityType: 'audit_finding',
            entityId: finding.id,
            engagementId: finding.engagement.id,
            actionUrl: `/audit/findings/${finding.id}`,
            teamUserIds: unique([
                finding.engagement.lead_auditor_id,
                finding.engagement.audit_manager_id,
                ...finding.engagement.workflow_assignments.map((assignment) => assignment.user_id),
            ]),
            auditeeUserIds: unique([finding.auditee_id, ...finding.responders.map((responder) => responder.user_id)]),
            evidenceRequestAssigneeId: null,
            reportIssued: finding.engagement.report?.status === 'issued',
        }));
        const requestDetails = requests.map((request) => ({
            entityType: 'audit_evidence_request',
            entityId: request.id,
            engagementId: request.engagement.id,
            actionUrl: `/audit/engagements/${request.engagement.id}?tab=evidence-requests`,
            teamUserIds: unique([
                request.engagement.lead_auditor_id,
                request.engagement.audit_manager_id,
                ...request.engagement.workflow_assignments.map((assignment) => assignment.user_id),
            ]),
            auditeeUserIds: [request.engagement.auditee_id],
            evidenceRequestAssigneeId: request.assigned_to_id,
            reportIssued: false,
        }));
        return [...engagementDetails, ...findingDetails, ...requestDetails];
    }
    async getNextActionCandidates(actor) {
        const [requests, findings, engagements, rejectedWorkingPapers] = await Promise.all([
            prisma_client_1.prisma.audit_Evidence_Request.findMany({
                where: { assigned_to_id: actor.id, status: 'open', deleted_at: null },
                select: { id: true, title: true, due_date: true, engagement_id: true },
            }),
            prisma_client_1.prisma.audit_Finding.findMany({
                where: {
                    deleted_at: null,
                    status: { in: ['open', 'in_remediation'] },
                    OR: [
                        { auditee_id: actor.id },
                        { responders: { some: { user_id: actor.id } } },
                    ],
                    engagement: { report: { status: 'issued' } },
                },
                select: { id: true, title: true, status: true, severity: true, due_date: true },
            }),
            prisma_client_1.prisma.audit_Engagement.findMany({
                where: {
                    deleted_at: null,
                    status: { in: ['planned', 'in_progress'] },
                    OR: [
                        { lead_auditor_id: actor.id },
                        { audit_manager_id: actor.id },
                        { workflow_assignments: { some: { user_id: actor.id } } },
                    ],
                },
                select: {
                    id: true,
                    title: true,
                    status: true,
                    sla_deadline: true,
                    checklists: { select: { result: true } },
                },
            }),
            prisma_client_1.prisma.audit_Working_Paper.findMany({
                where: { created_by_id: actor.id, status: 'rejected', deleted_at: null },
                select: { id: true, title: true, engagement_id: true, updated_at: true },
            }),
        ]);
        const requestActions = requests.map((request) => ({
            type: 'provide_evidence',
            entityType: 'audit_evidence_request',
            entityId: request.id,
            title: `Provide requested evidence: ${request.title}`,
            description: 'An auditor is waiting for this evidence request to be submitted.',
            dueAt: request.due_date,
            priority: request.due_date && request.due_date.getTime() < Date.now() ? 'high' : 'medium',
            actionUrl: `/audit/engagements/${request.engagement_id}?tab=evidence-requests`,
        }));
        const findingActions = findings.map((finding) => ({
            type: finding.status === 'open' ? 'submit_management_response' : 'upload_remediation_evidence',
            entityType: 'audit_finding',
            entityId: finding.id,
            title: finding.status === 'open'
                ? `Submit management response: ${finding.title}`
                : `Upload remediation evidence: ${finding.title}`,
            description: finding.status === 'open'
                ? 'This issued finding is awaiting the management response.'
                : 'Remediation is in progress and needs supporting evidence for verification.',
            dueAt: finding.due_date,
            priority: ['critical', 'high'].includes(finding.severity) ? 'high' : 'medium',
            actionUrl: `/audit/findings/${finding.id}`,
        }));
        const engagementActions = engagements.flatMap((engagement) => {
            if (engagement.status === 'planned') {
                return [{
                        type: 'start_fieldwork',
                        entityType: 'audit_engagement',
                        entityId: engagement.id,
                        title: `Start fieldwork: ${engagement.title}`,
                        description: 'The engagement is planned and ready for fieldwork to begin.',
                        dueAt: engagement.sla_deadline,
                        priority: 'medium',
                        actionUrl: `/audit/engagements/${engagement.id}`,
                    }];
            }
            const notTested = engagement.checklists.filter((checklist) => checklist.result === 'not_tested').length;
            return notTested === 0 ? [] : [{
                    type: 'continue_control_testing',
                    entityType: 'audit_engagement',
                    entityId: engagement.id,
                    title: `Continue control testing: ${engagement.title}`,
                    description: `${notTested} checklist item${notTested === 1 ? '' : 's'} still need testing.`,
                    dueAt: engagement.sla_deadline,
                    priority: 'medium',
                    actionUrl: `/audit/engagements/${engagement.id}`,
                }];
        });
        const workingPaperActions = rejectedWorkingPapers.map((paper) => ({
            type: 'revise_working_paper',
            entityType: 'audit_working_paper',
            entityId: paper.id,
            title: `Revise working paper: ${paper.title}`,
            description: 'A reviewer returned this working paper for rework.',
            dueAt: null,
            priority: 'high',
            actionUrl: `/audit/engagements/${paper.engagement_id}?tab=working-papers`,
        }));
        const candidates = [
            ...requestActions,
            ...findingActions,
            ...engagementActions,
            ...workingPaperActions,
        ];
        const priorityRank = { high: 0, medium: 1, low: 2 };
        return candidates.sort((left, right) => {
            const priorityDifference = priorityRank[left.priority] - priorityRank[right.priority];
            if (priorityDifference !== 0)
                return priorityDifference;
            return (left.dueAt?.getTime() ?? Number.MAX_SAFE_INTEGER) - (right.dueAt?.getTime() ?? Number.MAX_SAFE_INTEGER);
        });
    }
    async _upsertSnapshots(entityType, snapshotDate, rows) {
        await Promise.all(rows.map((row) => prisma_client_1.prisma.predictive_Snapshot.upsert({
            where: {
                entity_type_entity_id_snapshot_date: {
                    entity_type: entityType,
                    entity_id: row.id,
                    snapshot_date: snapshotDate,
                },
            },
            create: {
                entity_type: entityType,
                entity_id: row.id,
                snapshot_date: snapshotDate,
                feature_json: JSON.stringify(row.features),
            },
            update: { feature_json: JSON.stringify(row.features), feature_version: 'rules-v1' },
        })));
    }
    async _recordOutcomes() {
        const [engagements, findings, requests] = await Promise.all([
            prisma_client_1.prisma.audit_Engagement.findMany({
                where: { deleted_at: null, status: 'closed', actual_end_date: { not: null } },
                select: { id: true, sla_deadline: true, actual_end_date: true },
            }),
            prisma_client_1.prisma.audit_Finding.findMany({
                where: { deleted_at: null, status: 'closed', closed_at: { not: null } },
                select: { id: true, due_date: true, closed_at: true },
            }),
            prisma_client_1.prisma.audit_Evidence_Request.findMany({
                where: { deleted_at: null, status: 'fulfilled', due_date: { not: null }, fulfilled_at: { not: null } },
                select: { id: true, due_date: true, fulfilled_at: true },
            }),
        ]);
        const rows = [
            ...engagements.map((engagement) => ({
                entityType: 'audit_engagement', entityId: engagement.id, outcomeType: 'sla_deadline',
                value: engagement.actual_end_date <= engagement.sla_deadline ? 'met' : 'missed',
                observedAt: engagement.actual_end_date, deadline: engagement.sla_deadline,
            })),
            ...findings.map((finding) => ({
                entityType: 'audit_finding', entityId: finding.id, outcomeType: 'remediation_deadline',
                value: finding.closed_at <= finding.due_date ? 'met' : 'missed',
                observedAt: finding.closed_at, deadline: finding.due_date,
            })),
            ...requests.map((request) => ({
                entityType: 'audit_evidence_request', entityId: request.id, outcomeType: 'evidence_request_deadline',
                value: request.fulfilled_at <= request.due_date ? 'met' : 'missed',
                observedAt: request.fulfilled_at, deadline: request.due_date,
            })),
        ];
        await Promise.all(rows.map((row) => prisma_client_1.prisma.predictive_Outcome.upsert({
            where: {
                entity_type_entity_id_outcome_type: {
                    entity_type: row.entityType,
                    entity_id: row.entityId,
                    outcome_type: row.outcomeType,
                },
            },
            create: {
                entity_type: row.entityType,
                entity_id: row.entityId,
                outcome_type: row.outcomeType,
                value: row.value,
                observed_at: row.observedAt,
                metadata_json: JSON.stringify({ deadline: row.deadline.toISOString() }),
            },
            update: {
                value: row.value,
                observed_at: row.observedAt,
                metadata_json: JSON.stringify({ deadline: row.deadline.toISOString() }),
            },
        })));
        return rows.length;
    }
}
exports.WarehouseService = WarehouseService;
exports.warehouseService = new WarehouseService();
//# sourceMappingURL=warehouse.service.js.map