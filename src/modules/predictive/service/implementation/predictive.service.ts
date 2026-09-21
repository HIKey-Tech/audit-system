import { prisma } from '../../../../shared/prisma/prisma.client';
import { AppError } from '../../../../shared/errors/app.error';
import { logger } from '../../../../shared/utils/logger.util';
import { ActorContext } from '../../../audit/domain/entity/audit.entity';
import { InsightFeedbackDto } from '../../dto/request/predictive.request.dto';
import {
  PredictiveInsightResponseDto,
  PredictiveOverviewResponseDto,
  PredictiveRefreshResponseDto,
  PredictiveRationaleResponseDto,
} from '../../dto/response/predictive.response.dto';
import { IPredictiveService } from '../interface/predictive.service.interface';
import {
  PredictiveRationaleFactor,
  scoreEngagementDeliveryRisk,
  scoreEvidenceRequestDelayRisk,
  scoreFindingRemediationRisk,
} from '../../utility/predictive.utility';
import {
  IWarehouseService,
  WarehouseEntityType,
  WarehouseInsightTargetDetail,
} from '../../../warehouse/service/interface/warehouse.service.interface';

const RULES_VERSION = 'rules-v1';
const MINIMUM_INSIGHT_SCORE = 35;

interface GeneratedInsight {
  insightType: string;
  entityType: WarehouseEntityType;
  entityId: string;
  severity: string;
  score: number;
  title: string;
  summary: string;
  rationale: PredictiveRationaleFactor[];
}

const insightKey = (insight: Pick<GeneratedInsight, 'insightType' | 'entityType' | 'entityId'>): string =>
  `${insight.insightType}:${insight.entityType}:${insight.entityId}`;

const parseRationale = (raw: string): PredictiveRationaleResponseDto[] => {
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((factor): factor is PredictiveRationaleResponseDto =>
      typeof factor === 'object' && factor !== null &&
      typeof (factor as Record<string, unknown>).code === 'string' &&
      typeof (factor as Record<string, unknown>).label === 'string' &&
      typeof (factor as Record<string, unknown>).value === 'string' &&
      typeof (factor as Record<string, unknown>).weight === 'number',
    );
  } catch {
    return [];
  }
};

export class PredictiveService implements IPredictiveService {
  constructor(private readonly warehouse: IWarehouseService) {}

  async getOverview(actor: ActorContext): Promise<PredictiveOverviewResponseDto> {
    const [insights, nextActions, snapshotStatus, scoringStats] = await Promise.all([
      this._getVisibleInsights(actor),
      this.warehouse.getNextActionCandidates(actor),
      this.warehouse.getSnapshotStatus(),
      prisma.predictive_Insight.aggregate({ _max: { generated_at: true } }),
    ]);

    return {
      generatedAt: new Date().toISOString(),
      mode: 'explainable_rules',
      dataReadiness: {
        snapshotCount: snapshotStatus.snapshotCount,
        lastSnapshotAt: snapshotStatus.lastSnapshotAt,
        lastScoredAt: scoringStats._max.generated_at?.toISOString() ?? null,
        message: snapshotStatus.snapshotCount === 0
          ? 'Live learning has started. The first warehouse snapshot will be captured by the scheduled job.'
          : 'These are explainable early-warning scores based on current IAMS workflow data, not ML probabilities.',
      },
      insights,
      nextActions: nextActions.slice(0, 8).map((action) => ({
        type: action.type,
        entityType: action.entityType,
        entityId: action.entityId,
        title: action.title,
        description: action.description,
        dueAt: action.dueAt?.toISOString() ?? null,
        priority: action.priority,
        actionUrl: action.actionUrl,
      })),
    };
  }

  async recordFeedback(insightId: string, dto: InsightFeedbackDto, actor: ActorContext): Promise<void> {
    const visibleInsight = (await this._getVisibleInsights(actor, insightId))[0];
    if (!visibleInsight) throw AppError.notFound('Predictive insight');

    await prisma.predictive_Insight_Feedback.upsert({
      where: { insight_id_user_id: { insight_id: insightId, user_id: actor.id } },
      create: {
        insight_id: insightId,
        user_id: actor.id,
        feedback: dto.feedback,
        comment: dto.comment,
      },
      update: {
        feedback: dto.feedback,
        comment: dto.comment,
      },
    });
    logger.info('Predictive insight feedback recorded', {
      insightId,
      actorId: actor.id,
      feedback: dto.feedback,
    });
  }

  async refreshInsights(): Promise<PredictiveRefreshResponseDto> {
    const now = new Date();
    const [engagements, findings, evidenceRequests] = await Promise.all([
      this.warehouse.getEngagementSignals(),
      this.warehouse.getFindingSignals(),
      this.warehouse.getEvidenceRequestSignals(),
    ]);

    const generated: GeneratedInsight[] = [];
    for (const engagement of engagements) {
      const risk = scoreEngagementDeliveryRisk(engagement, now);
      if (risk.score < MINIMUM_INSIGHT_SCORE) continue;
      generated.push({
        insightType: 'engagement_delivery_risk',
        entityType: 'audit_engagement',
        entityId: engagement.id,
        severity: risk.severity,
        score: risk.score,
        title: `Engagement may miss its SLA: ${engagement.referenceNumber}`,
        summary: 'This early warning is based on live progress, deadline, evidence, and budget signals. Review the factors below before deciding what to do.',
        rationale: risk.rationale,
      });
    }

    for (const finding of findings) {
      const risk = scoreFindingRemediationRisk(finding, now);
      if (risk.score < MINIMUM_INSIGHT_SCORE) continue;
      generated.push({
        insightType: 'finding_remediation_risk',
        entityType: 'audit_finding',
        entityId: finding.id,
        severity: risk.severity,
        score: risk.score,
        title: `Finding remediation needs attention: ${finding.title}`,
        summary: 'This early warning is based on the due date, remediation state, available evidence, and finding severity.',
        rationale: risk.rationale,
      });
    }

    for (const request of evidenceRequests) {
      const risk = scoreEvidenceRequestDelayRisk(request, now);
      if (risk.score < MINIMUM_INSIGHT_SCORE) continue;
      generated.push({
        insightType: 'evidence_request_delay',
        entityType: 'audit_evidence_request',
        entityId: request.id,
        severity: risk.severity,
        score: risk.score,
        title: `Evidence request may delay fieldwork: ${request.title}`,
        summary: 'This early warning is based on the evidence-request deadline and its current submission state.',
        rationale: risk.rationale,
      });
    }

    await Promise.all(generated.map((insight) => prisma.predictive_Insight.upsert({
      where: {
        insight_type_entity_type_entity_id_model_version: {
          insight_type: insight.insightType,
          entity_type: insight.entityType,
          entity_id: insight.entityId,
          model_version: RULES_VERSION,
        },
      },
      create: {
        insight_type: insight.insightType,
        entity_type: insight.entityType,
        entity_id: insight.entityId,
        severity: insight.severity,
        score: insight.score,
        title: insight.title,
        summary: insight.summary,
        rationale_json: JSON.stringify(insight.rationale),
        model_version: RULES_VERSION,
        status: 'active',
        generated_at: now,
      },
      update: {
        severity: insight.severity,
        score: insight.score,
        title: insight.title,
        summary: insight.summary,
        rationale_json: JSON.stringify(insight.rationale),
        status: 'active',
        generated_at: now,
        resolved_at: null,
      },
    })));

    const active = await prisma.predictive_Insight.findMany({
      where: { status: 'active', model_version: RULES_VERSION },
      select: { id: true, insight_type: true, entity_type: true, entity_id: true },
    });
    const currentKeys = new Set(generated.map(insightKey));
    const staleIds = active
      .filter((insight) => !currentKeys.has(insightKey({
        insightType: insight.insight_type,
        entityType: insight.entity_type as WarehouseEntityType,
        entityId: insight.entity_id,
      })))
      .map((insight) => insight.id);

    if (staleIds.length > 0) {
      await prisma.predictive_Insight.updateMany({
        where: { id: { in: staleIds } },
        data: { status: 'resolved', resolved_at: now },
      });
    }

    logger.info('Predictive early-warning insights refreshed', {
      generated: generated.length,
      resolved: staleIds.length,
      scoredAt: now.toISOString(),
    });
    return { generated: generated.length, resolved: staleIds.length, scoredAt: now.toISOString() };
  }

  private async _getVisibleInsights(
    actor: ActorContext,
    onlyInsightId?: string,
  ): Promise<PredictiveInsightResponseDto[]> {
    const insights = await prisma.predictive_Insight.findMany({
      where: {
        status: 'active',
        ...(onlyInsightId ? { id: onlyInsightId } : {}),
      },
      include: {
        feedback: {
          where: { user_id: actor.id },
          select: { feedback: true },
        },
      },
      orderBy: [{ score: 'desc' }, { generated_at: 'desc' }],
      take: onlyInsightId ? 1 : 100,
    });
    if (insights.length === 0) return [];

    const details = await this.warehouse.getInsightTargetDetails(insights.map((insight) => ({
      entityType: insight.entity_type as WarehouseEntityType,
      entityId: insight.entity_id,
    })));
    const detailsByKey = new Map(details.map((detail) => [
      `${detail.entityType}:${detail.entityId}`,
      detail,
    ]));

    return insights.flatMap((insight) => {
      const detail = detailsByKey.get(`${insight.entity_type}:${insight.entity_id}`);
      if (!detail || !this._canViewInsight(detail, actor)) return [];
      return [{
        id: insight.id,
        type: insight.insight_type,
        entityType: insight.entity_type,
        entityId: insight.entity_id,
        severity: insight.severity as PredictiveInsightResponseDto['severity'],
        score: insight.score,
        title: insight.title,
        summary: insight.summary,
        rationale: parseRationale(insight.rationale_json),
        scoringVersion: insight.model_version,
        generatedAt: insight.generated_at.toISOString(),
        actionUrl: detail.actionUrl,
        feedback: (insight.feedback[0]?.feedback ?? null) as PredictiveInsightResponseDto['feedback'],
      }];
    });
  }

  private _canViewInsight(detail: WarehouseInsightTargetDetail, actor: ActorContext): boolean {
    const oversight = actor.permissions.includes('engagement:read_all');
    if (oversight || detail.teamUserIds.includes(actor.id)) return true;

    if (detail.entityType === 'audit_finding') {
      return detail.reportIssued && detail.auditeeUserIds.includes(actor.id);
    }
    if (detail.entityType === 'audit_evidence_request') {
      return detail.evidenceRequestAssigneeId === actor.id;
    }
    return false;
  }
}
