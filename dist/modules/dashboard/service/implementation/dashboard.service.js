"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.dashboardService = exports.DashboardService = void 0;
const client_1 = require("@prisma/client");
const prisma_client_1 = require("../../../../shared/prisma/prisma.client");
const dashboard_utility_1 = require("../../utility/dashboard.utility");
const ENGAGEMENT_CLOSED_LIKE_STATUSES = ['reported', 'closed'];
const FINDING_RESOLVED_STATUSES = ['closed', 'verified'];
const FINDING_OPEN_NOT_CLOSED_STATUS = 'closed';
const ACTIVITY_MODULES = ['audit', 'workflow', 'risk', 'document', 'user'];
// Prisma's groupBy result types `_count` as `true | { _all?: number; ... }`.
// This guard safely extracts `_all` when present.
const extractCount = (count) => {
    if (typeof count === 'object' && count !== null && '_all' in count) {
        const value = count._all;
        return typeof value === 'number' ? value : 0;
    }
    return 0;
};
const normalizeCount = (count) => {
    if (typeof count === 'bigint')
        return Number(count);
    return typeof count === 'number' ? count : 0;
};
class DashboardService {
    // =============================================================
    // Audit summary
    // =============================================================
    async getAuditSummary(actor) {
        const now = new Date();
        const yearStart = (0, dashboard_utility_1.startOfCurrentYear)(now);
        const sevenDaysFromNow = (0, dashboard_utility_1.daysFromNow)(7, now);
        const restrictToLead = (0, dashboard_utility_1.isRestrictedAuditor)(actor.roles);
        const engagementWhereBase = {
            deleted_at: null,
            ...(restrictToLead ? { lead_auditor_id: actor.id } : {}),
        };
        const [totalEngagementsThisYear, closedEngagementsThisYear, overdueEngagements, dueSoon, statusGroups, totalPlansThisYear, approvedPlans,] = await prisma_client_1.prisma.$transaction([
            prisma_client_1.prisma.audit_Engagement.count({
                where: { ...engagementWhereBase, created_at: { gte: yearStart } },
            }),
            prisma_client_1.prisma.audit_Engagement.count({
                where: {
                    ...engagementWhereBase,
                    created_at: { gte: yearStart },
                    status: 'closed',
                },
            }),
            prisma_client_1.prisma.audit_Engagement.count({
                where: {
                    ...engagementWhereBase,
                    sla_deadline: { lt: now },
                    status: { notIn: ENGAGEMENT_CLOSED_LIKE_STATUSES },
                },
            }),
            prisma_client_1.prisma.audit_Engagement.count({
                where: {
                    ...engagementWhereBase,
                    sla_deadline: { gte: now, lte: sevenDaysFromNow },
                    status: { notIn: ENGAGEMENT_CLOSED_LIKE_STATUSES },
                },
            }),
            prisma_client_1.prisma.audit_Engagement.groupBy({
                by: ['status'],
                where: engagementWhereBase,
                _count: { _all: true },
                orderBy: { status: 'asc' },
            }),
            prisma_client_1.prisma.audit_Plan.count({
                where: { deleted_at: null, year: now.getFullYear() },
            }),
            prisma_client_1.prisma.audit_Plan.count({
                where: { deleted_at: null, year: now.getFullYear(), status: 'approved' },
            }),
        ]);
        const byStatus = {
            planned: 0,
            in_progress: 0,
            under_review: 0,
            reported: 0,
            closed: 0,
        };
        for (const group of statusGroups) {
            if (group.status in byStatus) {
                const key = group.status;
                byStatus[key] = extractCount(group._count);
            }
        }
        const completionRate = totalEngagementsThisYear === 0
            ? 0
            : Math.round((closedEngagementsThisYear / totalEngagementsThisYear) * 10000) / 100;
        return {
            totalEngagementsThisYear,
            byStatus,
            overdueEngagements,
            dueSoon,
            completionRate,
            totalPlansThisYear,
            approvedPlans,
        };
    }
    // =============================================================
    // Findings summary
    // =============================================================
    async getFindingsSummary(actor) {
        const now = new Date();
        const monthStart = (0, dashboard_utility_1.startOfCurrentMonth)(now);
        const monthEnd = (0, dashboard_utility_1.startOfNextMonth)(now);
        const restrictToAuditee = (0, dashboard_utility_1.isRestrictedAuditee)(actor.roles);
        const findingWhereBase = {
            deleted_at: null,
            ...(restrictToAuditee ? { auditee_id: actor.id } : {}),
        };
        const openWhere = {
            ...findingWhereBase,
            status: { not: FINDING_OPEN_NOT_CLOSED_STATUS },
        };
        const [totalOpen, severityGroups, statusGroups, overdue, resolvedThisMonth,] = await prisma_client_1.prisma.$transaction([
            prisma_client_1.prisma.audit_Finding.count({ where: openWhere }),
            prisma_client_1.prisma.audit_Finding.groupBy({
                by: ['severity'],
                where: openWhere,
                _count: { _all: true },
                orderBy: { severity: 'asc' },
            }),
            prisma_client_1.prisma.audit_Finding.groupBy({
                by: ['status'],
                where: findingWhereBase,
                _count: { _all: true },
                orderBy: { status: 'asc' },
            }),
            prisma_client_1.prisma.audit_Finding.count({
                where: {
                    ...findingWhereBase,
                    due_date: { lt: now },
                    status: { notIn: FINDING_RESOLVED_STATUSES },
                },
            }),
            prisma_client_1.prisma.audit_Finding.count({
                where: {
                    ...findingWhereBase,
                    status: 'closed',
                    closed_at: { gte: monthStart, lt: monthEnd },
                },
            }),
        ]);
        const avgRows = await this._averageDaysToCloseRaw(restrictToAuditee ? actor.id : null);
        const bySeverity = {
            critical: 0,
            high: 0,
            medium: 0,
            low: 0,
            informational: 0,
        };
        for (const group of severityGroups) {
            if (group.severity in bySeverity) {
                const key = group.severity;
                bySeverity[key] = extractCount(group._count);
            }
        }
        const byStatus = {
            open: 0,
            management_response_received: 0,
            in_remediation: 0,
            verified: 0,
            closed: 0,
        };
        for (const group of statusGroups) {
            if (group.status in byStatus) {
                const key = group.status;
                byStatus[key] = extractCount(group._count);
            }
        }
        const averageDaysToClose = avgRows.length > 0 && avgRows[0].avg_days !== null
            ? Math.round(Number(avgRows[0].avg_days) * 100) / 100
            : null;
        return {
            totalOpen,
            bySeverity,
            byStatus,
            overdue,
            averageDaysToClose,
            resolvedThisMonth,
        };
    }
    // =============================================================
    // Risk overview
    // =============================================================
    async getRiskOverview(_actor) {
        const staleCutoff = new Date();
        staleCutoff.setDate(staleCutoff.getDate() - 90);
        const baseWhere = { deleted_at: null };
        const [totalRisks, critical, high, medium, low, statusGroups, topFiveRaw, staleRisks,] = await prisma_client_1.prisma.$transaction([
            prisma_client_1.prisma.risk_Register.count({ where: baseWhere }),
            prisma_client_1.prisma.risk_Register.count({
                where: { ...baseWhere, current_score: { gte: 20, lte: 25 } },
            }),
            prisma_client_1.prisma.risk_Register.count({
                where: { ...baseWhere, current_score: { gte: 13, lte: 19 } },
            }),
            prisma_client_1.prisma.risk_Register.count({
                where: { ...baseWhere, current_score: { gte: 6, lte: 12 } },
            }),
            prisma_client_1.prisma.risk_Register.count({
                where: { ...baseWhere, current_score: { gte: 1, lte: 5 } },
            }),
            prisma_client_1.prisma.risk_Register.groupBy({
                by: ['status'],
                where: baseWhere,
                _count: { _all: true },
                orderBy: { status: 'asc' },
            }),
            prisma_client_1.prisma.risk_Register.findMany({
                where: baseWhere,
                orderBy: { current_score: 'desc' },
                take: 5,
                select: {
                    id: true,
                    title: true,
                    current_score: true,
                    status: true,
                    category: { select: { name: true } },
                    owner: {
                        select: {
                            first_name: true,
                            last_name: true,
                            display_name: true,
                        },
                    },
                },
            }),
            prisma_client_1.prisma.risk_Register.count({
                where: {
                    ...baseWhere,
                    status: { in: ['open', 'mitigated'] },
                    OR: [
                        { last_assessed_at: null },
                        { last_assessed_at: { lt: staleCutoff } },
                    ],
                },
            }),
        ]);
        const byStatus = {
            open: 0,
            mitigated: 0,
            accepted: 0,
            closed: 0,
        };
        for (const group of statusGroups) {
            if (group.status in byStatus) {
                const key = group.status;
                byStatus[key] = extractCount(group._count);
            }
        }
        const topFiveRisks = topFiveRaw.map((risk) => ({
            id: risk.id,
            title: risk.title,
            score: risk.current_score,
            status: risk.status,
            categoryName: risk.category.name,
            ownerName: risk.owner.display_name
                ?? `${risk.owner.first_name} ${risk.owner.last_name}`,
        }));
        return {
            totalRisks,
            byScoreBand: { critical, high, medium, low },
            byStatus,
            topFiveRisks,
            staleRisks,
        };
    }
    // =============================================================
    // Recent activity
    // =============================================================
    async getRecentActivity(actor, limit) {
        const where = {
            module: { in: ACTIVITY_MODULES },
            ...((0, dashboard_utility_1.isRestrictedAuditor)(actor.roles) ? { user_id: actor.id } : {}),
        };
        const logs = await prisma_client_1.prisma.audit_Log.findMany({
            where,
            orderBy: { created_at: 'desc' },
            take: limit,
            select: {
                id: true,
                action: true,
                module: true,
                entity_type: true,
                entity_id: true,
                status: true,
                user_id: true,
                created_at: true,
            },
        });
        return logs.map((log) => ({
            id: log.id,
            action: log.action,
            module: log.module,
            entityType: log.entity_type,
            entityId: log.entity_id,
            status: log.status,
            userId: log.user_id,
            createdAt: log.created_at.toISOString(),
        }));
    }
    // =============================================================
    // Escalation overview
    // =============================================================
    async getEscalationOverview(actor) {
        const activeEscalationCondition = this._activeEscalationCondition(actor);
        const [totalRows, levelRows, recentRows] = await prisma_client_1.prisma.$transaction([
            prisma_client_1.prisma.$queryRaw(client_1.Prisma.sql `
          SELECT COUNT_BIG(1) AS total_count
          FROM workflow_escalations we
          WHERE ${activeEscalationCondition}
        `),
            prisma_client_1.prisma.$queryRaw(client_1.Prisma.sql `
          SELECT we.escalation_level, COUNT_BIG(1) AS total_count
          FROM workflow_escalations we
          WHERE ${activeEscalationCondition}
          GROUP BY we.escalation_level
          ORDER BY we.escalation_level ASC
        `),
            prisma_client_1.prisma.$queryRaw(client_1.Prisma.sql `
          SELECT TOP (10)
            we.id,
            we.entity_type,
            we.entity_id,
            we.escalation_level,
            we.reason,
            we.notified_at,
            u.display_name,
            u.first_name,
            u.last_name
          FROM workflow_escalations we
          INNER JOIN users u ON u.id = we.escalated_to_id
          WHERE ${activeEscalationCondition}
          ORDER BY we.notified_at DESC
        `),
        ]);
        const byLevel = {
            level1: 0,
            level2: 0,
            level3: 0,
            level4: 0,
        };
        for (const row of levelRows) {
            const key = `level${row.escalation_level}`;
            if (key in byLevel) {
                byLevel[key] = normalizeCount(row.total_count);
            }
        }
        const recentEscalations = recentRows.map((esc) => ({
            id: esc.id,
            entityType: esc.entity_type,
            entityId: esc.entity_id,
            escalationLevel: esc.escalation_level,
            reason: esc.reason,
            notifiedUserName: esc.display_name ?? `${esc.first_name} ${esc.last_name}`,
            notifiedAt: esc.notified_at.toISOString(),
        }));
        return {
            totalActive: normalizeCount(totalRows[0]?.total_count ?? null),
            byLevel,
            recentEscalations,
        };
    }
    // =============================================================
    // My work
    // =============================================================
    async getMyWork(userId) {
        const now = new Date();
        const myActiveEngagementWhere = {
            deleted_at: null,
            lead_auditor_id: userId,
            status: { notIn: ENGAGEMENT_CLOSED_LIKE_STATUSES },
        };
        const [activeRaw, pendingStepsRaw, overdueRaw, findingsRaw,] = await prisma_client_1.prisma.$transaction([
            prisma_client_1.prisma.audit_Engagement.findMany({
                where: myActiveEngagementWhere,
                orderBy: { sla_deadline: 'asc' },
                select: {
                    id: true,
                    title: true,
                    reference_number: true,
                    status: true,
                    sla_deadline: true,
                    priority: true,
                },
            }),
            this._pendingApprovalStepsForUserRaw(userId),
            prisma_client_1.prisma.audit_Engagement.findMany({
                where: {
                    ...myActiveEngagementWhere,
                    sla_deadline: { lt: now },
                },
                orderBy: { sla_deadline: 'asc' },
                select: {
                    id: true,
                    title: true,
                    reference_number: true,
                    status: true,
                    sla_deadline: true,
                    priority: true,
                },
            }),
            prisma_client_1.prisma.audit_Finding.findMany({
                where: {
                    deleted_at: null,
                    status: 'in_remediation',
                    engagement: { lead_auditor_id: userId, deleted_at: null },
                },
                orderBy: { due_date: 'asc' },
                select: {
                    id: true,
                    title: true,
                    severity: true,
                    status: true,
                    due_date: true,
                    engagement: { select: { id: true, reference_number: true } },
                },
            }),
        ]);
        const mapEngagement = (e) => ({
            id: e.id,
            title: e.title,
            referenceNumber: e.reference_number,
            status: e.status,
            slaDeadline: e.sla_deadline.toISOString(),
            priority: e.priority,
        });
        return {
            myActiveEngagements: activeRaw.map(mapEngagement),
            myPendingApprovals: pendingStepsRaw.map((step) => ({
                stepId: step.step_id,
                approvalId: step.approval_id,
                entityType: step.entity_type,
                entityId: step.entity_id,
                currentLevel: step.current_level,
                createdAt: step.created_at.toISOString(),
            })),
            myOverdueEngagements: overdueRaw.map(mapEngagement),
            myFindingsToVerify: findingsRaw.map((finding) => ({
                id: finding.id,
                title: finding.title,
                severity: finding.severity,
                status: finding.status,
                dueDate: finding.due_date.toISOString(),
                engagementId: finding.engagement.id,
                engagementReference: finding.engagement.reference_number,
            })),
        };
    }
    // =============================================================
    // Approval inbox summary
    // =============================================================
    async getApprovalInboxSummary(userId) {
        const rows = await prisma_client_1.prisma.$queryRaw(client_1.Prisma.sql `
        SELECT
          COUNT_BIG(1) AS pending_count,
          MIN(step.created_at) AS oldest_created_at
        FROM workflow_approval_steps step
        INNER JOIN workflow_approvals approval ON approval.id = step.approval_id
        WHERE step.approver_id = ${userId}
          AND step.status = 'pending'
          AND approval.status = 'pending'
          AND step.level = approval.current_level
      `);
        const summary = rows[0];
        const pendingCount = normalizeCount(summary?.pending_count ?? null);
        const oldestPendingDays = summary?.oldest_created_at
            ? Math.max(0, (0, dashboard_utility_1.daysBetween)(summary.oldest_created_at, new Date()))
            : 0;
        return { pendingCount, oldestPendingDays };
    }
    // =============================================================
    // Internal helpers
    // =============================================================
    async _averageDaysToCloseRaw(auditeeId) {
        if (auditeeId) {
            return prisma_client_1.prisma.$queryRaw(client_1.Prisma.sql `
          SELECT AVG(CAST(DATEDIFF(DAY, created_at, closed_at) AS FLOAT)) AS avg_days
          FROM audit_findings
          WHERE deleted_at IS NULL
            AND status = 'closed'
            AND closed_at IS NOT NULL
            AND auditee_id = ${auditeeId}
        `);
        }
        return prisma_client_1.prisma.$queryRaw(client_1.Prisma.sql `
        SELECT AVG(CAST(DATEDIFF(DAY, created_at, closed_at) AS FLOAT)) AS avg_days
        FROM audit_findings
        WHERE deleted_at IS NULL
          AND status = 'closed'
          AND closed_at IS NOT NULL
      `);
    }
    _activeEscalationCondition(actor) {
        const restrictToLead = (0, dashboard_utility_1.isRestrictedAuditor)(actor.roles);
        const engagementLeadFilter = restrictToLead
            ? client_1.Prisma.sql `AND engagement.lead_auditor_id = ${actor.id}`
            : client_1.Prisma.empty;
        const approvalLeadFilter = restrictToLead
            ? client_1.Prisma.sql `
          AND (
            (
              approval.entity_type = 'audit_working_paper'
              AND EXISTS (
                SELECT 1
                FROM audit_working_papers wp
                INNER JOIN audit_engagements engagement
                  ON engagement.id = wp.engagement_id
                WHERE wp.id = approval.entity_id
                  AND wp.deleted_at IS NULL
                  AND engagement.deleted_at IS NULL
                  AND engagement.lead_auditor_id = ${actor.id}
              )
            )
            OR (
              approval.entity_type = 'audit_report'
              AND EXISTS (
                SELECT 1
                FROM audit_reports report
                INNER JOIN audit_engagements engagement
                  ON engagement.id = report.engagement_id
                WHERE report.id = approval.entity_id
                  AND report.deleted_at IS NULL
                  AND engagement.deleted_at IS NULL
                  AND engagement.lead_auditor_id = ${actor.id}
              )
            )
          )
        `
            : client_1.Prisma.empty;
        return client_1.Prisma.sql `
      (
        (
          we.entity_type = 'audit_engagement'
          AND EXISTS (
            SELECT 1
            FROM audit_engagements engagement
            WHERE engagement.id = we.entity_id
              AND engagement.deleted_at IS NULL
              AND engagement.status <> 'closed'
              ${engagementLeadFilter}
          )
        )
        OR (
          we.entity_type = 'workflow_approval'
          AND EXISTS (
            SELECT 1
            FROM workflow_approvals approval
            WHERE approval.id = we.entity_id
              AND approval.status = 'pending'
              ${approvalLeadFilter}
          )
        )
      )
    `;
    }
    _pendingApprovalStepsForUserRaw(userId) {
        return prisma_client_1.prisma.$queryRaw(client_1.Prisma.sql `
        SELECT
          step.id AS step_id,
          step.approval_id,
          approval.entity_type,
          approval.entity_id,
          approval.current_level,
          step.created_at
        FROM workflow_approval_steps step
        INNER JOIN workflow_approvals approval ON approval.id = step.approval_id
        WHERE step.approver_id = ${userId}
          AND step.status = 'pending'
          AND approval.status = 'pending'
          AND step.level = approval.current_level
        ORDER BY step.created_at ASC
      `);
    }
}
exports.DashboardService = DashboardService;
// Singleton for re-use across HTTP requests.
exports.dashboardService = new DashboardService();
//# sourceMappingURL=dashboard.service.js.map