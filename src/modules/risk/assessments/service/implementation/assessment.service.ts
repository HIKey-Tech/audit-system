import { Prisma } from '@prisma/client';
import { prisma } from '../../../../../shared/prisma/prisma.client';
import { AppError } from '../../../../../shared/errors/app.error';
import { logger } from '../../../../../shared/utils/logger.util';
import { PaginationMeta, buildPaginationMeta, parsePagination } from '../../../../../shared/types/api-response.type';
import { auditLogService } from '../../../../logging/service/implementation/audit-log.service';
import { riskAssessmentWithAssessorInclude, RiskAssessmentWithAssessor } from '../../../../../shared/prisma/prisma.types';
import { RiskActorContext } from '../../../domain/entity/risk.entity';
import { assertHasRole, calculateRiskScore, hasAuditeeRole, RISK_ASSESSOR_ROLES } from '../../../utility/risk.utility';
import {
  CreateRiskAssessmentRequestDto,
  RiskAssessmentQueryDto,
} from '../../dto/request/assessment.request.dto';
import {
  RiskAssessmentResponseDto,
  mapRiskAssessmentToResponse,
} from '../../dto/response/assessment.response.dto';
import { IAssessmentService } from '../interface/assessment.service.interface';

type RiskAssessmentWithRiskOwner = RiskAssessmentWithAssessor & {
  risk: {
    owner_id: string;
    deleted_at: Date | null;
  };
};

export class RiskAssessmentService implements IAssessmentService {
  async createAssessment(
    riskId: string,
    dto: CreateRiskAssessmentRequestDto,
    actor: RiskActorContext,
  ): Promise<RiskAssessmentResponseDto> {
    assertHasRole(actor.roles, RISK_ASSESSOR_ROLES);

    const score = calculateRiskScore(dto.likelihood, dto.impact);
    const assessedAt = dto.assessedAt ? new Date(dto.assessedAt) : new Date();

    const assessment = await prisma.$transaction(async (tx) => {
      const risk = await tx.risk_Register.findFirst({
        where: { id: riskId, deleted_at: null },
        select: { id: true, universe_id: true },
      });
      if (!risk) throw AppError.notFound('Risk');

      const created = await tx.risk_Assessment.create({
        data: {
          risk_id: riskId,
          likelihood: dto.likelihood,
          impact: dto.impact,
          score,
          notes: dto.notes ?? null,
          assessed_by_id: actor.id,
          assessed_at: assessedAt,
        },
        include: riskAssessmentWithAssessorInclude,
      });

      await tx.risk_Register.update({
        where: { id: riskId },
        data: {
          likelihood: dto.likelihood,
          impact: dto.impact,
          current_score: score,
          last_assessed_at: assessedAt,
        },
      });

      if (risk.universe_id) {
        const universeRiskScore = await tx.risk_Register.aggregate({
          where: {
            universe_id: risk.universe_id,
            deleted_at: null,
            status: { not: 'closed' },
          },
          _max: { current_score: true },
        });

        await tx.audit_Universe.update({
          where: { id: risk.universe_id },
          data: {
            risk_score: universeRiskScore._max.current_score === null
              ? null
              : new Prisma.Decimal(universeRiskScore._max.current_score),
          },
        });
      }

      return created;
    }) as RiskAssessmentWithAssessor;

    logger.info('Risk assessment created', {
      assessmentId: assessment.id,
      riskId,
      actorId: actor.id,
      score,
    });
    auditLogService.logAsync({
      userId: actor.id,
      action: 'risk.assessment.create',
      module: 'risk',
      entityType: 'risk_assessment',
      entityId: assessment.id,
      newValues: mapRiskAssessmentToResponse(assessment),
    });

    return mapRiskAssessmentToResponse(assessment);
  }

  async getAssessmentById(id: string, actor: RiskActorContext): Promise<RiskAssessmentResponseDto> {
    const assessment = await prisma.risk_Assessment.findUnique({
      where: { id },
      include: {
        ...riskAssessmentWithAssessorInclude,
        risk: { select: { owner_id: true, deleted_at: true } },
      },
    }) as RiskAssessmentWithRiskOwner | null;

    if (
      !assessment ||
      assessment.risk.deleted_at !== null ||
      (hasAuditeeRole(actor.roles) && assessment.risk.owner_id !== actor.id)
    ) {
      throw AppError.notFound('Risk assessment');
    }
    return mapRiskAssessmentToResponse(assessment);
  }

  async listAssessments(
    riskId: string,
    query: RiskAssessmentQueryDto,
    actor: RiskActorContext,
  ): Promise<{ assessments: RiskAssessmentResponseDto[]; meta: PaginationMeta }> {
    await this._assertRiskExists(riskId, actor);
    const { skip, take, page, pageSize } = parsePagination(query);

    const where: Prisma.Risk_AssessmentWhereInput = { risk_id: riskId };
    const [total, assessments] = await prisma.$transaction([
      prisma.risk_Assessment.count({ where }),
      prisma.risk_Assessment.findMany({
        where,
        include: riskAssessmentWithAssessorInclude,
        orderBy: { assessed_at: 'desc' },
        skip,
        take,
      }),
    ]);

    return {
      assessments: (assessments as RiskAssessmentWithAssessor[]).map(mapRiskAssessmentToResponse),
      meta: buildPaginationMeta(total, page, pageSize),
    };
  }

  async getLatestAssessment(riskId: string, actor: RiskActorContext): Promise<RiskAssessmentResponseDto | null> {
    await this._assertRiskExists(riskId, actor);

    const assessment = await prisma.risk_Assessment.findFirst({
      where: { risk_id: riskId },
      include: riskAssessmentWithAssessorInclude,
      orderBy: { assessed_at: 'desc' },
    }) as RiskAssessmentWithAssessor | null;

    return assessment ? mapRiskAssessmentToResponse(assessment) : null;
  }

  private async _assertRiskExists(riskId: string, actor: RiskActorContext): Promise<void> {
    const risk = await prisma.risk_Register.findFirst({
      where: {
        id: riskId,
        deleted_at: null,
        ...(hasAuditeeRole(actor.roles) && { owner_id: actor.id }),
      },
      select: { id: true },
    });
    if (!risk) throw AppError.notFound('Risk');
  }
}
