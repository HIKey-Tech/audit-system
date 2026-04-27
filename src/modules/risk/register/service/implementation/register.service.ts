import { Prisma } from '@prisma/client';
import { prisma } from '../../../../../shared/prisma/prisma.client';
import { AppError } from '../../../../../shared/errors/app.error';
import { logger } from '../../../../../shared/utils/logger.util';
import { PaginationMeta, buildPaginationMeta, parsePagination } from '../../../../../shared/types/api-response.type';
import { auditLogService } from '../../../../logging/service/implementation/audit-log.service';
import { riskRegisterWithDetailsInclude, RiskRegisterWithDetails } from '../../../../../shared/prisma/prisma.types';
import { RiskActorContext } from '../../../domain/entity/risk.entity';
import { assertHasRole, calculateRiskScore, hasAuditeeRole, RISK_ADMIN_ROLES } from '../../../utility/risk.utility';
import {
  CreateRiskRequestDto,
  RiskRegisterQueryDto,
  UpdateRiskRequestDto,
  UpdateRiskStatusRequestDto,
} from '../../dto/request/register.request.dto';
import {
  RiskRegisterResponseDto,
  mapRiskRegisterToResponse,
} from '../../dto/response/register.response.dto';
import { IRegisterService } from '../interface/register.service.interface';

export class RiskRegisterService implements IRegisterService {
  async createRisk(
    dto: CreateRiskRequestDto,
    actor: RiskActorContext,
  ): Promise<RiskRegisterResponseDto> {
    assertHasRole(actor.roles, RISK_ADMIN_ROLES);

    const score = calculateRiskScore(dto.likelihood, dto.impact);

    const risk = await prisma.risk_Register.create({
      data: {
        title: dto.title,
        description: dto.description,
        category_id: dto.categoryId,
        owner_id: dto.ownerId,
        likelihood: dto.likelihood,
        impact: dto.impact,
        current_score: score,
        status: dto.status,
        universe_id: dto.universeId ?? null,
        created_by_id: actor.id,
      },
      include: riskRegisterWithDetailsInclude,
    }) as RiskRegisterWithDetails;

    logger.info('Risk created', { riskId: risk.id, actorId: actor.id, currentScore: score });
    auditLogService.logAsync({
      userId: actor.id,
      action: 'risk.register.create',
      module: 'risk',
      entityType: 'risk_register',
      entityId: risk.id,
      newValues: mapRiskRegisterToResponse(risk),
    });

    return mapRiskRegisterToResponse(risk);
  }

  async updateRisk(
    id: string,
    dto: UpdateRiskRequestDto,
    actor: RiskActorContext,
  ): Promise<RiskRegisterResponseDto> {
    assertHasRole(actor.roles, RISK_ADMIN_ROLES);
    const existing = await this._getExistingRisk(id);

    const likelihood = dto.likelihood ?? existing.likelihood;
    const impact = dto.impact ?? existing.impact;
    const score = calculateRiskScore(likelihood, impact);
    const scoreChanged = likelihood !== existing.likelihood || impact !== existing.impact;

    const risk = await prisma.risk_Register.update({
      where: { id },
      data: {
        ...(dto.title !== undefined && { title: dto.title }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.categoryId !== undefined && { category_id: dto.categoryId }),
        ...(dto.ownerId !== undefined && { owner_id: dto.ownerId }),
        ...(dto.likelihood !== undefined && { likelihood: dto.likelihood }),
        ...(dto.impact !== undefined && { impact: dto.impact }),
        ...(scoreChanged && { current_score: score }),
        ...(dto.universeId !== undefined && { universe_id: dto.universeId }),
      },
      include: riskRegisterWithDetailsInclude,
    }) as RiskRegisterWithDetails;

    logger.info('Risk updated', { riskId: id, actorId: actor.id });
    auditLogService.logAsync({
      userId: actor.id,
      action: 'risk.register.update',
      module: 'risk',
      entityType: 'risk_register',
      entityId: id,
      newValues: mapRiskRegisterToResponse(risk),
    });

    return mapRiskRegisterToResponse(risk);
  }

  async updateRiskStatus(
    id: string,
    dto: UpdateRiskStatusRequestDto,
    actor: RiskActorContext,
  ): Promise<RiskRegisterResponseDto> {
    assertHasRole(actor.roles, RISK_ADMIN_ROLES);
    await this._getExistingRisk(id);

    const risk = await prisma.risk_Register.update({
      where: { id },
      data: { status: dto.status },
      include: riskRegisterWithDetailsInclude,
    }) as RiskRegisterWithDetails;

    logger.info('Risk status updated', { riskId: id, actorId: actor.id, status: dto.status });
    auditLogService.logAsync({
      userId: actor.id,
      action: 'risk.register.status_update',
      module: 'risk',
      entityType: 'risk_register',
      entityId: id,
      newValues: { status: dto.status },
    });

    return mapRiskRegisterToResponse(risk);
  }

  async deleteRisk(id: string, actor: RiskActorContext): Promise<void> {
    assertHasRole(actor.roles, RISK_ADMIN_ROLES);
    await this._getExistingRisk(id);

    await prisma.risk_Register.update({
      where: { id },
      data: { deleted_at: new Date() },
    });

    logger.info('Risk soft-deleted', { riskId: id, actorId: actor.id });
    auditLogService.logAsync({
      userId: actor.id,
      action: 'risk.register.delete',
      module: 'risk',
      entityType: 'risk_register',
      entityId: id,
    });
  }

  async getRiskById(id: string, actor: RiskActorContext): Promise<RiskRegisterResponseDto> {
    const risk = await prisma.risk_Register.findFirst({
      where: {
        id,
        deleted_at: null,
        ...(hasAuditeeRole(actor.roles) && { owner_id: actor.id }),
      },
      include: riskRegisterWithDetailsInclude,
    }) as RiskRegisterWithDetails | null;

    if (!risk) throw AppError.notFound('Risk');
    return mapRiskRegisterToResponse(risk);
  }

  async listRisks(
    query: RiskRegisterQueryDto,
    actor: RiskActorContext,
  ): Promise<{ risks: RiskRegisterResponseDto[]; meta: PaginationMeta }> {
    const { skip, take, page, pageSize } = parsePagination(query);
    const where: Prisma.Risk_RegisterWhereInput = {
      deleted_at: null,
      ...(query.categoryId && { category_id: query.categoryId }),
      ...(query.status && { status: query.status }),
      ...(query.ownerId && { owner_id: query.ownerId }),
      ...(hasAuditeeRole(actor.roles) && { owner_id: actor.id }),
    };

    const [total, risks] = await prisma.$transaction([
      prisma.risk_Register.count({ where }),
      prisma.risk_Register.findMany({
        where,
        include: riskRegisterWithDetailsInclude,
        orderBy: { [query.sortBy]: query.sortOrder },
        skip,
        take,
      }),
    ]);

    return {
      risks: (risks as RiskRegisterWithDetails[]).map(mapRiskRegisterToResponse),
      meta: buildPaginationMeta(total, page, pageSize),
    };
  }

  async getRisksByUniverseEntity(universeId: string, actor?: RiskActorContext): Promise<RiskRegisterResponseDto[]> {
    const risks = await prisma.risk_Register.findMany({
      where: {
        universe_id: universeId,
        deleted_at: null,
        ...(actor && hasAuditeeRole(actor.roles) && { owner_id: actor.id }),
      },
      include: riskRegisterWithDetailsInclude,
      orderBy: { current_score: 'desc' },
    }) as RiskRegisterWithDetails[];

    return risks.map(mapRiskRegisterToResponse);
  }

  private async _getExistingRisk(id: string): Promise<{
    id: string;
    likelihood: number;
    impact: number;
  }> {
    const risk = await prisma.risk_Register.findFirst({
      where: { id, deleted_at: null },
      select: { id: true, likelihood: true, impact: true },
    });
    if (!risk) throw AppError.notFound('Risk');
    return risk;
  }
}
