import { Prisma } from '@prisma/client';
import { prisma } from '../../../../../shared/prisma/prisma.client';
import { AppError } from '../../../../../shared/errors/app.error';
import { PaginationMeta, buildPaginationMeta, parsePagination } from '../../../../../shared/types/api-response.type';
import { riskRegisterWithDetailsInclude, RiskRegisterWithDetails } from '../../../../../shared/prisma/prisma.types';
import { RiskActorContext } from '../../../domain/entity/risk.entity';
import { RiskStatus } from '../../../domain/enum/risk.enum';
import { assertHasPermission, getRiskScoreBand } from '../../../utility/risk.utility';
import { EmergingRiskQueryDto, HighRiskQueryDto } from '../../dto/request/monitoring.request.dto';
import {
  EmergingRiskResponseDto,
  OrganizationRiskSummaryResponseDto,
  RiskScoreTrendResponseDto,
} from '../../dto/response/monitoring.response.dto';
import { RiskRegisterResponseDto, mapRiskRegisterToResponse } from '../../../register/dto/response/register.response.dto';
import { IMonitoringService } from '../interface/monitoring.service.interface';

export class RiskMonitoringService implements IMonitoringService {
  async getEmergingRisks(query: EmergingRiskQueryDto, actor: RiskActorContext): Promise<EmergingRiskResponseDto[]> {
    assertHasPermission(actor.permissions, 'risk_monitoring:read');
    const since = new Date(Date.now() - query.days * 86_400_000);
    const restrictToOwner = !actor.permissions.includes('risk:read_all');

    const risks = await prisma.risk_Register.findMany({
      where: {
        deleted_at: null,
        status: { in: [RiskStatus.Open, RiskStatus.Accepted] },
        ...(restrictToOwner && { owner_id: actor.id }),
        OR: [{ created_at: { gte: since } }, { assessments: { some: { assessed_at: { gte: since } } } }],
      },
      include: {
        category: { select: { name: true } },
        owner: { select: { display_name: true, first_name: true, last_name: true } },
        assessments: { orderBy: { assessed_at: 'desc' }, select: { score: true, assessed_at: true } },
      },
    });

    const emerging: EmergingRiskResponseDto[] = [];
    for (const risk of risks) {
      // The score the risk carried when the window opened, if it existed then.
      const before = risk.assessments.find((a) => a.assessed_at < since);
      const isNew = risk.created_at >= since;
      if (!isNew && (!before || risk.current_score <= before.score)) continue;
      emerging.push({
        riskId: risk.id,
        title: risk.title,
        categoryName: risk.category?.name ?? null,
        ownerName: risk.owner ? risk.owner.display_name ?? `${risk.owner.first_name} ${risk.owner.last_name}`.trim() : null,
        trend: isNew ? 'new' : 'rising',
        currentScore: risk.current_score,
        previousScore: isNew ? null : before!.score,
        change: isNew ? risk.current_score : risk.current_score - before!.score,
        status: risk.status,
        lastAssessedAt: risk.last_assessed_at?.toISOString() ?? null,
      });
    }
    return emerging
      .sort((a, b) => b.currentScore - a.currentScore || b.change - a.change)
      .slice(0, query.limit);
  }

  async getHighRiskItems(
    query: HighRiskQueryDto,
    actor: RiskActorContext,
  ): Promise<{ risks: RiskRegisterResponseDto[]; meta: PaginationMeta }> {
    const { skip, take, page, pageSize } = parsePagination(query);
    const restrictToOwner = !actor.permissions.includes('risk:read_all');
    const where: Prisma.Risk_RegisterWhereInput = {
      deleted_at: null,
      current_score: { gte: query.threshold },
      ...(restrictToOwner && { owner_id: actor.id }),
    };

    const [total, risks] = await prisma.$transaction([
      prisma.risk_Register.count({ where }),
      prisma.risk_Register.findMany({
        where,
        include: riskRegisterWithDetailsInclude,
        orderBy: { current_score: 'desc' },
        skip,
        take,
      }),
    ]);

    return {
      risks: (risks as RiskRegisterWithDetails[]).map(mapRiskRegisterToResponse),
      meta: buildPaginationMeta(total, page, pageSize),
    };
  }

  async getRisksRequiringAttention(actor: RiskActorContext): Promise<RiskRegisterResponseDto[]> {
    assertHasPermission(actor.permissions, 'risk_monitoring:read');

    const staleCutoff = new Date();
    staleCutoff.setDate(staleCutoff.getDate() - 90);
    const restrictToOwner = !actor.permissions.includes('risk:read_all');

    const risks = await prisma.risk_Register.findMany({
      where: {
        deleted_at: null,
        status: { in: [RiskStatus.Open, RiskStatus.Mitigated] },
        current_score: { gte: 13 },
        ...(restrictToOwner && { owner_id: actor.id }),
        OR: [
          { last_assessed_at: null },
          { last_assessed_at: { lt: staleCutoff } },
        ],
      },
      include: riskRegisterWithDetailsInclude,
      orderBy: { current_score: 'desc' },
    }) as RiskRegisterWithDetails[];

    return risks.map(mapRiskRegisterToResponse);
  }

  async getRiskScoreTrend(riskId: string, actor: RiskActorContext): Promise<RiskScoreTrendResponseDto[]> {
    const restrictToOwner = !actor.permissions.includes('risk:read_all');
    const risk = await prisma.risk_Register.findFirst({
      where: {
        id: riskId,
        deleted_at: null,
        ...(restrictToOwner && { owner_id: actor.id }),
      },
      select: { id: true },
    });
    if (!risk) throw AppError.notFound('Risk');

    const assessments = await prisma.risk_Assessment.findMany({
      where: { risk_id: riskId },
      orderBy: { assessed_at: 'asc' },
      select: {
        id: true,
        likelihood: true,
        impact: true,
        score: true,
        assessed_at: true,
      },
    });

    return assessments.map((assessment) => ({
      assessmentId: assessment.id,
      likelihood: assessment.likelihood,
      impact: assessment.impact,
      score: assessment.score,
      assessedAt: assessment.assessed_at.toISOString(),
    }));
  }

  async getOrganizationRiskSummary(actor: RiskActorContext): Promise<OrganizationRiskSummaryResponseDto> {
    const restrictToOwner = !actor.permissions.includes('risk:read_all');
    const risks = await prisma.risk_Register.findMany({
      where: {
        deleted_at: null,
        ...(restrictToOwner && { owner_id: actor.id }),
      },
      select: { current_score: true, status: true },
    });

    const summary: OrganizationRiskSummaryResponseDto = {
      byScoreBand: {
        low: 0,
        medium: 0,
        high: 0,
        critical: 0,
      },
      byStatus: {
        open: 0,
        mitigated: 0,
        accepted: 0,
        closed: 0,
      },
      total: risks.length,
    };

    risks.forEach((risk) => {
      summary.byScoreBand[getRiskScoreBand(risk.current_score)] += 1;
      if (risk.status in summary.byStatus) {
        const status = risk.status as keyof OrganizationRiskSummaryResponseDto['byStatus'];
        summary.byStatus[status] += 1;
      }
    });

    return summary;
  }
}
