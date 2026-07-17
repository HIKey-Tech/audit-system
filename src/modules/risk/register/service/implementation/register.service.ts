import { Prisma } from '@prisma/client';
import { prisma } from '../../../../../shared/prisma/prisma.client';
import { AppError } from '../../../../../shared/errors/app.error';
import { logger } from '../../../../../shared/utils/logger.util';
import { PaginationMeta, buildPaginationMeta, parsePagination } from '../../../../../shared/types/api-response.type';
import { auditLogService } from '../../../../logging/service/implementation/audit-log.service';
import { riskRegisterWithDetailsInclude, RiskRegisterWithDetails } from '../../../../../shared/prisma/prisma.types';
import { RiskActorContext } from '../../../domain/entity/risk.entity';
import { assertHasPermission, calculateRiskScore } from '../../../utility/risk.utility';
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
    assertHasPermission(actor.permissions, 'risk:create');

    const score = calculateRiskScore(dto.likelihood, dto.impact);
    this._assertCanAssignOwner(dto.ownerId, actor);
    await this._assertReferencesValid(dto.categoryId, dto.ownerId, dto.universeId ?? null);

    const risk = await prisma.$transaction(async (tx) => {
      const created = await tx.risk_Register.create({
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
      });
      // Record the initial scoring as the first assessment snapshot, so the
      // register's current_score is always backed by an assessment (the trend
      // and history start from creation instead of showing "no assessments").
      await tx.risk_Assessment.create({
        data: {
          risk_id: created.id,
          likelihood: dto.likelihood,
          impact: dto.impact,
          score,
          notes: 'Initial assessment recorded at risk creation.',
          assessed_by_id: actor.id,
        },
      });
      if (dto.universeId) await this._syncUniverseRiskScore(tx, dto.universeId);
      return created;
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
    assertHasPermission(actor.permissions, 'risk:update');
    const existing = await this._getExistingRisk(id);
    await this._assertCanMutateRisk(existing, actor);
    if (dto.ownerId) this._assertCanAssignOwner(dto.ownerId, actor);
    await this._assertReferencesValid(dto.categoryId, dto.ownerId, dto.universeId);

    const likelihood = dto.likelihood ?? existing.likelihood;
    const impact = dto.impact ?? existing.impact;
    const score = calculateRiskScore(likelihood, impact);
    const scoreChanged = likelihood !== existing.likelihood || impact !== existing.impact;

    const risk = await prisma.$transaction(async (tx) => {
      const updated = await tx.risk_Register.update({
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
      });
      await this._syncAffectedUniverseRiskScores(tx, existing.universe_id, updated.universe_id);
      return updated;
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
    assertHasPermission(actor.permissions, 'risk:update');
    const existing = await this._getExistingRisk(id);
    await this._assertCanMutateRisk(existing, actor);

    const risk = await prisma.$transaction(async (tx) => {
      const updated = await tx.risk_Register.update({
        where: { id },
        data: { status: dto.status },
        include: riskRegisterWithDetailsInclude,
      });
      await this._syncAffectedUniverseRiskScores(tx, existing.universe_id, updated.universe_id);
      return updated;
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
    assertHasPermission(actor.permissions, 'risk:delete');
    const existing = await this._getExistingRisk(id);
    await this._assertCanMutateRisk(existing, actor);

    await prisma.$transaction(async (tx) => {
      await tx.risk_Register.update({
        where: { id },
        data: { deleted_at: new Date() },
      });
      if (existing.universe_id) await this._syncUniverseRiskScore(tx, existing.universe_id);
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
    const restrictToOwner = !actor.permissions.includes('risk:read_all');
    const risk = await prisma.risk_Register.findFirst({
      where: {
        id,
        deleted_at: null,
        ...(restrictToOwner && { owner_id: actor.id }),
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
    const restrictToOwner = !actor.permissions.includes('risk:read_all');
    const where: Prisma.Risk_RegisterWhereInput = {
      deleted_at: null,
      ...(query.categoryId && { category_id: query.categoryId }),
      ...(query.status && { status: query.status }),
      ...(query.ownerId && { owner_id: query.ownerId }),
      ...(restrictToOwner && { owner_id: actor.id }),
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
    const restrictToOwner = actor ? !actor.permissions.includes('risk:read_all') : false;
    const risks = await prisma.risk_Register.findMany({
      where: {
        universe_id: universeId,
        deleted_at: null,
        ...(restrictToOwner && actor && { owner_id: actor.id }),
      },
      include: riskRegisterWithDetailsInclude,
      orderBy: { current_score: 'desc' },
    }) as RiskRegisterWithDetails[];

    return risks.map(mapRiskRegisterToResponse);
  }
  private _assertCanAssignOwner(ownerId: string, actor: RiskActorContext): void {
    if (actor.permissions.includes('risk:read_all')) return;
    if (ownerId === actor.id) return;
    throw AppError.forbidden('You are not authorized to assign this risk to another owner');
  }

  private async _syncAffectedUniverseRiskScores(
    tx: Prisma.TransactionClient,
    previousUniverseId: string | null,
    nextUniverseId: string | null,
  ): Promise<void> {
    if (previousUniverseId) await this._syncUniverseRiskScore(tx, previousUniverseId);
    if (nextUniverseId && nextUniverseId !== previousUniverseId) {
      await this._syncUniverseRiskScore(tx, nextUniverseId);
    }
  }

  private async _syncUniverseRiskScore(
    tx: Prisma.TransactionClient,
    universeId: string,
  ): Promise<void> {
    const aggregate = await tx.risk_Register.aggregate({
      where: {
        universe_id: universeId,
        deleted_at: null,
        status: { not: 'closed' },
      },
      _max: { current_score: true },
    });

    await tx.audit_Universe.update({
      where: { id: universeId },
      data: {
        risk_score: aggregate._max.current_score === null
          ? null
          : new Prisma.Decimal(aggregate._max.current_score),
      },
    });
  }

  private async _assertReferencesValid(
    categoryId?: string,
    ownerId?: string,
    universeId?: string | null,
  ): Promise<void> {
    const checks: Promise<unknown>[] = [];

    if (categoryId !== undefined) {
      checks.push(
        prisma.risk_Category.findFirst({
          where: { id: categoryId, is_active: true },
          select: { id: true },
        }).then((category) => {
          if (!category) throw AppError.notFound('Active risk category');
        }),
      );
    }

    if (ownerId !== undefined) {
      checks.push(
        prisma.user.findFirst({
          where: { id: ownerId, deleted_at: null, is_active: true },
          select: { id: true },
        }).then((owner) => {
          if (!owner) throw AppError.notFound('Active risk owner');
        }),
      );
    }

    if (universeId !== undefined && universeId !== null) {
      checks.push(
        prisma.audit_Universe.findFirst({
          where: { id: universeId, deleted_at: null },
          select: { id: true },
        }).then((universe) => {
          if (!universe) throw AppError.notFound('Audit universe entity');
        }),
      );
    }

    await Promise.all(checks);
  }

  private async _assertCanMutateRisk(
    risk: { owner_id: string },
    actor: RiskActorContext,
  ): Promise<void> {
    if (actor.permissions.includes('risk:read_all')) return;
    if (risk.owner_id === actor.id) return;
    throw AppError.forbidden('You are not authorized to modify this risk');
  }

  private async _getExistingRisk(id: string): Promise<{
    id: string;
    likelihood: number;
    impact: number;
    owner_id: string;
    universe_id: string | null;
  }> {
    const risk = await prisma.risk_Register.findFirst({
      where: { id, deleted_at: null },
      select: { id: true, likelihood: true, impact: true, owner_id: true, universe_id: true },
    });
    if (!risk) throw AppError.notFound('Risk');
    return risk;
  }
}
