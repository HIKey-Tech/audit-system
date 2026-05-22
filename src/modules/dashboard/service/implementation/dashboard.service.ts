import { Prisma } from '@prisma/client';
import { prisma } from '../../../../shared/prisma/prisma.client';
import { DashboardActorContext } from '../../domain/entity/dashboard.entity';
import {
  daysBetween,
  isRestrictedAuditee,
  isRestrictedAuditor,
  startOfCurrentMonth,
  startOfCurrentYear,
  startOfNextMonth,
  daysFromNow,
} from '../../utility/dashboard.utility';
import {
  ApprovalInboxSummaryResponseDto,
  AuditAnalyticsResponseDto,
  AuditSummaryResponseDto,
  EscalationOverviewResponseDto,
  FindingsSummaryResponseDto,
  MyWorkResponseDto,
  RecentActivityItemDto,
  RiskOverviewResponseDto,
} from '../../dto/response/dashboard.response.dto';

const ENGAGEMENT_CLOSED_LIKE_STATUSES = ['reported', 'closed'] as const;
const FINDING_RESOLVED_STATUSES = ['closed', 'verified'] as const;
const FINDING_OPEN_NOT_CLOSED_STATUS = 'closed';
const ACTIVITY_MODULES = ['audit', 'workflow', 'risk', 'document', 'user'] as const;

interface EscalationCountRow {
  total_count: bigint | number | null;
}

interface EscalationLevelRow {
  escalation_level: number;
  total_count: bigint | number | null;
}

interface RecentEscalationRow {
  id: string;
  entity_type: string;
  entity_id: string;
  escalation_level: number;
  reason: string;
  notified_at: Date;
  display_name: string | null;
  first_name: string;
  last_name: string;
}

interface PendingApprovalStepRow {
  step_id: string;
  approval_id: string;
  entity_type: string;
  entity_id: string;
  current_level: number;
  created_at: Date;
}

interface ApprovalInboxSummaryRow {
  pending_count: bigint | number | null;
  oldest_created_at: Date | null;
}

// Prisma's groupBy result types `_count` as `true | { _all?: number; ... }`.
// This guard safely extracts `_all` when present.
const extractCount = (count: unknown): number => {
  if (typeof count === 'object' && count !== null && '_all' in count) {
    const value = (count as { _all?: number })._all;
    return typeof value === 'number' ? value : 0;
  }
  return 0;
};

const normalizeCount = (count: bigint | number | null): number => {
  if (typeof count === 'bigint') return Number(count);
  return typeof count === 'number' ? count : 0;
};

export class DashboardService {
  async getAuditAnalytics(actor: DashboardActorContext): Promise<AuditAnalyticsResponseDto> {
    const [lifecycle, workingPapers, findings, reporting, followUp, riskCoverage] = await Promise.all([
      this._getLifecycleAnalytics(actor),
      this._getWorkingPaperAnalytics(actor),
      this.getFindingsSummary(actor),
      this._getReportingAnalytics(actor),
      this._getFollowUpAnalytics(actor),
      this._getRiskCoverageAnalytics(),
    ]);

    return {
      generatedAt: new Date().toISOString(),
      lifecycle,
      workingPapers,
      findings,
      reporting,
      followUp,
      riskCoverage,
    };
  }

  // =============================================================
  // Audit summary
  // =============================================================
  async getAuditSummary(
    actor: DashboardActorContext,
  ): Promise<AuditSummaryResponseDto> {
    const now = new Date();
    const yearStart = startOfCurrentYear(now);
    const sevenDaysFromNow = daysFromNow(7, now);

    const restrictToLead = isRestrictedAuditor(actor.roles);
    const engagementWhereBase: Prisma.Audit_EngagementWhereInput = {
      deleted_at: null,
      ...(restrictToLead ? { lead_auditor_id: actor.id } : {}),
    };

    const [
      totalEngagementsThisYear,
      closedEngagementsThisYear,
      overdueEngagements,
      dueSoon,
      statusGroups,
      totalPlansThisYear,
      approvedPlans,
    ] = await prisma.$transaction([
      prisma.audit_Engagement.count({
        where: { ...engagementWhereBase, created_at: { gte: yearStart } },
      }),
      prisma.audit_Engagement.count({
        where: {
          ...engagementWhereBase,
          created_at: { gte: yearStart },
          status: 'closed',
        },
      }),
      prisma.audit_Engagement.count({
        where: {
          ...engagementWhereBase,
          sla_deadline: { lt: now },
          status: { notIn: ENGAGEMENT_CLOSED_LIKE_STATUSES as unknown as string[] },
        },
      }),
      prisma.audit_Engagement.count({
        where: {
          ...engagementWhereBase,
          sla_deadline: { gte: now, lte: sevenDaysFromNow },
          status: { notIn: ENGAGEMENT_CLOSED_LIKE_STATUSES as unknown as string[] },
        },
      }),
      prisma.audit_Engagement.groupBy({
        by: ['status'],
        where: engagementWhereBase,
        _count: { _all: true },
        orderBy: { status: 'asc' },
      }),
      prisma.audit_Plan.count({
        where: { deleted_at: null, year: now.getFullYear() },
      }),
      prisma.audit_Plan.count({
        where: { deleted_at: null, year: now.getFullYear(), status: 'approved' },
      }),
    ]);

    const byStatus: AuditSummaryResponseDto['byStatus'] = {
      planned: 0,
      in_progress: 0,
      under_review: 0,
      reported: 0,
      closed: 0,
    };
    for (const group of statusGroups) {
      if (group.status in byStatus) {
        const key = group.status as keyof AuditSummaryResponseDto['byStatus'];
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
  async getFindingsSummary(
    actor: DashboardActorContext,
  ): Promise<FindingsSummaryResponseDto> {
    const now = new Date();
    const monthStart = startOfCurrentMonth(now);
    const monthEnd = startOfNextMonth(now);

    const restrictToAuditee = isRestrictedAuditee(actor.roles);
    const findingWhereBase: Prisma.Audit_FindingWhereInput = {
      deleted_at: null,
      ...(restrictToAuditee ? { auditee_id: actor.id } : {}),
    };

    const openWhere: Prisma.Audit_FindingWhereInput = {
      ...findingWhereBase,
      status: { not: FINDING_OPEN_NOT_CLOSED_STATUS },
    };

    const [
      totalOpen,
      severityGroups,
      statusGroups,
      overdue,
      resolvedThisMonth,
    ] = await prisma.$transaction([
      prisma.audit_Finding.count({ where: openWhere }),
      prisma.audit_Finding.groupBy({
        by: ['severity'],
        where: openWhere,
        _count: { _all: true },
        orderBy: { severity: 'asc' },
      }),
      prisma.audit_Finding.groupBy({
        by: ['status'],
        where: findingWhereBase,
        _count: { _all: true },
        orderBy: { status: 'asc' },
      }),
      prisma.audit_Finding.count({
        where: {
          ...findingWhereBase,
          due_date: { lt: now },
          status: { notIn: FINDING_RESOLVED_STATUSES as unknown as string[] },
        },
      }),
      prisma.audit_Finding.count({
        where: {
          ...findingWhereBase,
          status: 'closed',
          closed_at: { gte: monthStart, lt: monthEnd },
        },
      }),
    ]);

    const avgRows = await this._averageDaysToCloseRaw(
      restrictToAuditee ? actor.id : null,
    );

    const bySeverity: FindingsSummaryResponseDto['bySeverity'] = {
      critical: 0,
      high: 0,
      medium: 0,
      low: 0,
      informational: 0,
    };
    for (const group of severityGroups) {
      if (group.severity in bySeverity) {
        const key = group.severity as keyof FindingsSummaryResponseDto['bySeverity'];
        bySeverity[key] = extractCount(group._count);
      }
    }

    const byStatus: FindingsSummaryResponseDto['byStatus'] = {
      open: 0,
      management_response_received: 0,
      in_remediation: 0,
      verified: 0,
      closed: 0,
    };
    for (const group of statusGroups) {
      if (group.status in byStatus) {
        const key = group.status as keyof FindingsSummaryResponseDto['byStatus'];
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
  async getRiskOverview(
    _actor: DashboardActorContext,
  ): Promise<RiskOverviewResponseDto> {
    const staleCutoff = new Date();
    staleCutoff.setDate(staleCutoff.getDate() - 90);

    const baseWhere: Prisma.Risk_RegisterWhereInput = { deleted_at: null };

    const [
      totalRisks,
      critical,
      high,
      medium,
      low,
      statusGroups,
      topFiveRaw,
      staleRisks,
    ] = await prisma.$transaction([
      prisma.risk_Register.count({ where: baseWhere }),
      prisma.risk_Register.count({
        where: { ...baseWhere, current_score: { gte: 20, lte: 25 } },
      }),
      prisma.risk_Register.count({
        where: { ...baseWhere, current_score: { gte: 13, lte: 19 } },
      }),
      prisma.risk_Register.count({
        where: { ...baseWhere, current_score: { gte: 6, lte: 12 } },
      }),
      prisma.risk_Register.count({
        where: { ...baseWhere, current_score: { gte: 1, lte: 5 } },
      }),
      prisma.risk_Register.groupBy({
        by: ['status'],
        where: baseWhere,
        _count: { _all: true },
        orderBy: { status: 'asc' },
      }),
      prisma.risk_Register.findMany({
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
      prisma.risk_Register.count({
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

    const byStatus: RiskOverviewResponseDto['byStatus'] = {
      open: 0,
      mitigated: 0,
      accepted: 0,
      closed: 0,
    };
    for (const group of statusGroups) {
      if (group.status in byStatus) {
        const key = group.status as keyof RiskOverviewResponseDto['byStatus'];
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
  async getRecentActivity(
    actor: DashboardActorContext,
    limit: number,
  ): Promise<RecentActivityItemDto[]> {
    const HTTP_PREFIXES = ['POST:', 'GET:', 'PUT:', 'PATCH:', 'DELETE:'];

    const where: Prisma.Audit_LogWhereInput = {
      module: { in: ACTIVITY_MODULES as unknown as string[] },
      ...(isRestrictedAuditor(actor.roles) ? { user_id: actor.id } : {}),
      // Exclude raw HTTP request logs — only keep structured service audit logs.
      // A structured log either has a proper entityType or uses dot.notation for action.
      AND: [
        // Reject any action that starts with an HTTP method prefix
        ...HTTP_PREFIXES.map((prefix) => ({
          action: { not: { startsWith: prefix } },
        })),
        // Accept only logs that have an entityType OR a dot-notation action
        {
          OR: [
            { entity_type: { not: null } },
            { action: { contains: '.' } },
          ],
        },
      ],
    };

    const logs = await prisma.audit_Log.findMany({
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
  async getEscalationOverview(
    actor: DashboardActorContext,
  ): Promise<EscalationOverviewResponseDto> {
    const activeEscalationCondition = this._activeEscalationCondition(actor);

    const [totalRows, levelRows, recentRows] = await prisma.$transaction([
      prisma.$queryRaw<EscalationCountRow[]>(
        Prisma.sql`
          SELECT COUNT_BIG(1) AS total_count
          FROM workflow_escalations we
          WHERE ${activeEscalationCondition}
        `,
      ),
      prisma.$queryRaw<EscalationLevelRow[]>(
        Prisma.sql`
          SELECT we.escalation_level, COUNT_BIG(1) AS total_count
          FROM workflow_escalations we
          WHERE ${activeEscalationCondition}
          GROUP BY we.escalation_level
          ORDER BY we.escalation_level ASC
        `,
      ),
      prisma.$queryRaw<RecentEscalationRow[]>(
        Prisma.sql`
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
        `,
      ),
    ]);

    const byLevel: EscalationOverviewResponseDto['byLevel'] = {
      level1: 0,
      level2: 0,
      level3: 0,
      level4: 0,
    };
    for (const row of levelRows) {
      const key = `level${row.escalation_level}` as keyof EscalationOverviewResponseDto['byLevel'];
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
  async getMyWork(userId: string): Promise<MyWorkResponseDto> {
    const now = new Date();
    const myActiveEngagementWhere: Prisma.Audit_EngagementWhereInput = {
      deleted_at: null,
      lead_auditor_id: userId,
      status: { notIn: ENGAGEMENT_CLOSED_LIKE_STATUSES as unknown as string[] },
    };

    const [
      activeRaw,
      pendingStepsRaw,
      overdueRaw,
      findingsRaw,
    ] = await prisma.$transaction([
      prisma.audit_Engagement.findMany({
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
      prisma.audit_Engagement.findMany({
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
      prisma.audit_Finding.findMany({
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

    const mapEngagement = (e: typeof activeRaw[number]) => ({
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
  async getApprovalInboxSummary(
    userId: string,
  ): Promise<ApprovalInboxSummaryResponseDto> {
    const rows = await prisma.$queryRaw<ApprovalInboxSummaryRow[]>(
      Prisma.sql`
        SELECT
          COUNT_BIG(1) AS pending_count,
          MIN(step.created_at) AS oldest_created_at
        FROM workflow_approval_steps step
        INNER JOIN workflow_approvals approval ON approval.id = step.approval_id
        WHERE step.approver_id = ${userId}
          AND step.status = 'pending'
          AND approval.status = 'pending'
          AND step.level = approval.current_level
      `,
    );
    const summary = rows[0];
    const pendingCount = normalizeCount(summary?.pending_count ?? null);

    const oldestPendingDays = summary?.oldest_created_at
      ? Math.max(0, daysBetween(summary.oldest_created_at, new Date()))
      : 0;

    return { pendingCount, oldestPendingDays };
  }

  // =============================================================
  // Internal helpers
  // =============================================================
  private async _averageDaysToCloseRaw(
    auditeeId: string | null,
  ): Promise<Array<{ avg_days: number | null }>> {
    if (auditeeId) {
      return prisma.$queryRaw<Array<{ avg_days: number | null }>>(
        Prisma.sql`
          SELECT AVG(CAST(DATEDIFF(DAY, created_at, closed_at) AS FLOAT)) AS avg_days
          FROM audit_findings
          WHERE deleted_at IS NULL
            AND status = 'closed'
            AND closed_at IS NOT NULL
            AND auditee_id = ${auditeeId}
        `,
      );
    }
    return prisma.$queryRaw<Array<{ avg_days: number | null }>>(
      Prisma.sql`
        SELECT AVG(CAST(DATEDIFF(DAY, created_at, closed_at) AS FLOAT)) AS avg_days
        FROM audit_findings
        WHERE deleted_at IS NULL
          AND status = 'closed'
          AND closed_at IS NOT NULL
      `,
    );
  }

  private _activeEscalationCondition(actor: DashboardActorContext): Prisma.Sql {
    const restrictToLead = isRestrictedAuditor(actor.roles);
    const engagementLeadFilter = restrictToLead
      ? Prisma.sql`AND engagement.lead_auditor_id = ${actor.id}`
      : Prisma.empty;
    const approvalLeadFilter = restrictToLead
      ? Prisma.sql`
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
      : Prisma.empty;

    return Prisma.sql`
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

  private _pendingApprovalStepsForUserRaw(
    userId: string,
  ): Prisma.PrismaPromise<PendingApprovalStepRow[]> {
    return prisma.$queryRaw<PendingApprovalStepRow[]>(
      Prisma.sql`
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
      `,
    );
  }

  private async _getLifecycleAnalytics(
    actor: DashboardActorContext,
  ): Promise<AuditAnalyticsResponseDto['lifecycle']> {
    const summary = await this.getAuditSummary(actor);
    const restrictToLead = isRestrictedAuditor(actor.roles);
    const where: Prisma.Audit_EngagementWhereInput = {
      deleted_at: null,
      ...(restrictToLead ? { lead_auditor_id: actor.id } : {}),
    };

    const engagements = await prisma.audit_Engagement.findMany({
      where,
      select: {
        planned_start_date: true,
        actual_start_date: true,
        actual_end_date: true,
        updated_at: true,
        status: true,
      },
    });

    const cycleDurations = engagements
      .filter((engagement) => engagement.actual_end_date)
      .map((engagement) => daysBetween(engagement.planned_start_date, engagement.actual_end_date!));
    const fieldworkDurations = engagements
      .filter((engagement) => engagement.actual_start_date && engagement.actual_end_date)
      .map((engagement) => daysBetween(engagement.actual_start_date!, engagement.actual_end_date!));
    const reportingDurations = engagements
      .filter((engagement) => engagement.status === 'reported' || engagement.status === 'closed')
      .map((engagement) => daysBetween(engagement.planned_start_date, engagement.updated_at));

    return {
      byStatus: summary.byStatus,
      overdueEngagements: summary.overdueEngagements,
      dueSoon: summary.dueSoon,
      averageCycleDays: average(cycleDurations),
      averageFieldworkDays: average(fieldworkDurations),
      averageReportingDays: average(reportingDurations),
    };
  }

  private async _getWorkingPaperAnalytics(
    actor: DashboardActorContext,
  ): Promise<AuditAnalyticsResponseDto['workingPapers']> {
    const restrictToLead = isRestrictedAuditor(actor.roles);
    const where: Prisma.Audit_Working_PaperWhereInput = {
      deleted_at: null,
      ...(restrictToLead ? { engagement: { lead_auditor_id: actor.id } } : {}),
    };
    const [total, imported, submittedAwaitingReview, groups] = await prisma.$transaction([
      prisma.audit_Working_Paper.count({ where }),
      prisma.audit_Working_Paper.count({
        where: { ...where, source_document_id: { not: null } },
      }),
      prisma.audit_Working_Paper.count({ where: { ...where, status: 'submitted' } }),
      prisma.audit_Working_Paper.groupBy({
        by: ['status'],
        where,
        _count: { _all: true },
        orderBy: { status: 'asc' },
      }),
    ]);

    return {
      total,
      imported,
      submittedAwaitingReview,
      byStatus: toBreakdown(groups, 'status'),
    };
  }

  private async _getReportingAnalytics(
    actor: DashboardActorContext,
  ): Promise<AuditAnalyticsResponseDto['reporting']> {
    const restrictToLead = isRestrictedAuditor(actor.roles);
    const where: Prisma.Audit_ReportWhereInput = {
      deleted_at: null,
      ...(restrictToLead ? { engagement: { lead_auditor_id: actor.id } } : {}),
    };
    const [total, groups, issuedReports] = await prisma.$transaction([
      prisma.audit_Report.count({ where }),
      prisma.audit_Report.groupBy({
        by: ['status'],
        where,
        _count: { _all: true },
        orderBy: { status: 'asc' },
      }),
      prisma.audit_Report.findMany({
        where: { ...where, issued_at: { not: null } },
        select: { created_at: true, issued_at: true },
      }),
    ]);

    return {
      total,
      byStatus: toBreakdown(groups, 'status'),
      averageDaysToIssue: average(
        issuedReports.map((report) => daysBetween(report.created_at, report.issued_at!)),
      ),
    };
  }

  private async _getFollowUpAnalytics(
    actor: DashboardActorContext,
  ): Promise<AuditAnalyticsResponseDto['followUp']> {
    const restrictToAuditee = isRestrictedAuditee(actor.roles);
    const where: Prisma.Audit_Follow_UpWhereInput = {
      ...(restrictToAuditee ? { finding: { auditee_id: actor.id } } : {}),
    };
    const now = new Date();
    const [total, pending, verified, rejected, overdueFindings] = await prisma.$transaction([
      prisma.audit_Follow_Up.count({ where }),
      prisma.audit_Follow_Up.count({ where: { ...where, verification_status: 'pending' } }),
      prisma.audit_Follow_Up.count({ where: { ...where, verification_status: 'verified' } }),
      prisma.audit_Follow_Up.count({ where: { ...where, verification_status: 'rejected' } }),
      prisma.audit_Finding.count({
        where: {
          deleted_at: null,
          due_date: { lt: now },
          status: { notIn: FINDING_RESOLVED_STATUSES as unknown as string[] },
          ...(restrictToAuditee ? { auditee_id: actor.id } : {}),
        },
      }),
    ]);

    return { total, pending, verified, rejected, overdueFindings };
  }

  private async _getRiskCoverageAnalytics(): Promise<AuditAnalyticsResponseDto['riskCoverage']> {
    const now = new Date();
    const yearStart = startOfCurrentYear(now);
    const highRiskWhere: Prisma.Audit_UniverseWhereInput = {
      deleted_at: null,
      risk_score: { gte: new Prisma.Decimal(15) },
    };
    const [universeItems, highRiskUniverseItems, highRiskAuditedThisYear] = await prisma.$transaction([
      prisma.audit_Universe.count({ where: { deleted_at: null } }),
      prisma.audit_Universe.count({ where: highRiskWhere }),
      prisma.audit_Universe.count({
        where: {
          ...highRiskWhere,
          engagements: {
            some: {
              deleted_at: null,
              created_at: { gte: yearStart },
            },
          },
        },
      }),
    ]);

    return {
      universeItems,
      highRiskUniverseItems,
      highRiskAuditedThisYear,
      highRiskCoverageRate: highRiskUniverseItems === 0
        ? 0
        : Math.round((highRiskAuditedThisYear / highRiskUniverseItems) * 10000) / 100,
    };
  }
}

// Singleton for re-use across HTTP requests.
export const dashboardService = new DashboardService();

const average = (values: number[]): number | null => {
  if (values.length === 0) return null;
  return Math.round((values.reduce((sum, value) => sum + value, 0) / values.length) * 100) / 100;
};

const toBreakdown = <T extends Record<string, unknown>>(
  groups: Array<T & { _count?: true | { _all?: number } }>,
  key: keyof T,
): Record<string, number> =>
  groups.reduce<Record<string, number>>((acc, group) => {
    const value = group[key];
    const count = typeof group._count === 'object' ? group._count._all ?? 0 : 0;
    if (typeof value === 'string') acc[value] = count;
    return acc;
  }, {});
