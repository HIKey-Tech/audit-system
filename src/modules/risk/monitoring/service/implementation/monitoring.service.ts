import { Prisma } from '@prisma/client';
import { prisma } from '../../../../../shared/prisma/prisma.client';
import { AppError } from '../../../../../shared/errors/app.error';
import { PaginationMeta, buildPaginationMeta, parsePagination } from '../../../../../shared/types/api-response.type';
import { riskRegisterWithDetailsInclude, RiskRegisterWithDetails } from '../../../../../shared/prisma/prisma.types';
import { RiskActorContext } from '../../../domain/entity/risk.entity';
import { RiskStatus } from '../../../domain/enum/risk.enum';
import { assertHasRole, getRiskScoreBand, hasAuditeeRole, RISK_ASSESSOR_ROLES } from '../../../utility/risk.utility';
import { HighRiskQueryDto } from '../../dto/request/monitoring.request.dto';
import {
  OrganizationRiskSummaryResponseDto,
  RiskScoreTrendResponseDto,
} from '../../dto/response/monitoring.response.dto';
import { RiskRegisterResponseDto, mapRiskRegisterToResponse } from '../../../register/dto/response/register.response.dto';
import { IMonitoringService } from '../interface/monitoring.service.interface';

export class RiskMonitoringService implements IMonitoringService {
  async getHighRiskItems(
    query: HighRiskQueryDto,
    actor: RiskActorContext,
  ): Promise<{ risks: RiskRegisterResponseDto[]; meta: PaginationMeta }> {
    const { skip, take, page, pageSize } = parsePagination(query);
    const where: Prisma.Risk_RegisterWhereInput = {
      deleted_at: null,
      current_score: { gte: query.threshold },
      ...(hasAuditeeRole(actor.roles) && { owner_id: actor.id }),
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
    assertHasRole(actor.roles, RISK_ASSESSOR_ROLES);

    const staleCutoff = new Date();
    staleCutoff.setDate(staleCutoff.getDate() - 90);

    const risks = await prisma.risk_Register.findMany({
      where: {
        deleted_at: null,
        status: { in: [RiskStatus.Open, RiskStatus.Mitigated] },
        current_score: { gte: 13 },
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
    const risk = await prisma.risk_Register.findFirst({
      where: {
        id: riskId,
        deleted_at: null,
        ...(hasAuditeeRole(actor.roles) && { owner_id: actor.id }),
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
    const risks = await prisma.risk_Register.findMany({
      where: {
        deleted_at: null,
        ...(hasAuditeeRole(actor.roles) && { owner_id: actor.id }),
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
