import { Prisma } from '@prisma/client';
import { prisma } from '../../../../../shared/prisma/prisma.client';
import { AppError } from '../../../../../shared/errors/app.error';
import { logger } from '../../../../../shared/utils/logger.util';
import { PaginationMeta, buildPaginationMeta, parsePagination } from '../../../../../shared/types/api-response.type';
import { auditLogService } from '../../../../logging/service/implementation/audit-log.service';
import { ActorContext } from '../../../domain/entity/audit.entity';
import { UniverseStatus } from '../../../domain/enum/audit.enum';
import { assertHasPermission } from '../../../utility/audit.utility';
import {
  CreateUniverseRequestDto,
  UpdateUniverseRequestDto,
  UniverseQueryDto,
} from '../../dto/request/universe.request.dto';
import { UniverseResponseDto, mapUniverseToResponse } from '../../dto/response/universe.response.dto';
import { IUniverseService } from '../interface/universe.service.interface';
import { IRegisterService } from '../../../../risk/register/service/interface/register.service.interface';

export class UniverseService implements IUniverseService {
  constructor(private readonly riskRegisterService?: IRegisterService) {}

  async createEntity(dto: CreateUniverseRequestDto, actor: ActorContext): Promise<UniverseResponseDto> {
    assertHasPermission(actor.permissions, 'universe:create');

    const entity = await prisma.audit_Universe.create({
      data: {
        name: dto.name,
        description: dto.description,
        category: dto.category,
        owner_id: dto.ownerId,
        risk_score: dto.riskScore === undefined ? null : new Prisma.Decimal(dto.riskScore),
        last_audited_at: dto.lastAuditedAt ? new Date(dto.lastAuditedAt) : null,
        audit_frequency: dto.auditFrequency,
        created_by_id: actor.id,
      },
    });

    logger.info('Audit universe entity created', { entityId: entity.id, actorId: actor.id });
    auditLogService.logAsync({
      userId: actor.id,
      action: 'audit.universe.create',
      module: 'audit',
      entityType: 'audit_universe',
      entityId: entity.id,
      newValues: mapUniverseToResponse(entity),
    });

    return mapUniverseToResponse(entity);
  }

  async updateEntity(id: string, dto: UpdateUniverseRequestDto, actor: ActorContext): Promise<UniverseResponseDto> {
    assertHasPermission(actor.permissions, 'universe:update');
    await this._assertEntityExists(id);

    const entity = await prisma.audit_Universe.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.category !== undefined && { category: dto.category }),
        ...(dto.ownerId !== undefined && { owner_id: dto.ownerId }),
        ...(dto.riskScore !== undefined && {
          risk_score: dto.riskScore === null ? null : new Prisma.Decimal(dto.riskScore),
        }),
        ...(dto.lastAuditedAt !== undefined && {
          last_audited_at: dto.lastAuditedAt === null ? null : new Date(dto.lastAuditedAt),
        }),
        ...(dto.auditFrequency !== undefined && { audit_frequency: dto.auditFrequency }),
        ...(dto.status !== undefined && { status: dto.status }),
      },
    });

    logger.info('Audit universe entity updated', { entityId: id, actorId: actor.id });
    auditLogService.logAsync({
      userId: actor.id,
      action: 'audit.universe.update',
      module: 'audit',
      entityType: 'audit_universe',
      entityId: id,
      newValues: mapUniverseToResponse(entity),
    });

    return mapUniverseToResponse(entity);
  }

  async deactivateEntity(id: string, actor: ActorContext): Promise<void> {
    assertHasPermission(actor.permissions, 'universe:delete');
    await this._assertEntityExists(id);

    await prisma.audit_Universe.update({
      where: { id },
      data: {
        status: UniverseStatus.Inactive,
        deleted_at: new Date(),
      },
    });

    logger.info('Audit universe entity deactivated', { entityId: id, actorId: actor.id });
    auditLogService.logAsync({
      userId: actor.id,
      action: 'audit.universe.deactivate',
      module: 'audit',
      entityType: 'audit_universe',
      entityId: id,
    });
  }

  async getEntityById(id: string, actor: ActorContext): Promise<UniverseResponseDto> {
    const entity = await prisma.audit_Universe.findFirst({
      where: { id, deleted_at: null },
    });
    if (!entity) throw AppError.notFound('Audit universe entity');
    const response = mapUniverseToResponse(entity);
    if (!this.riskRegisterService) return response;

    const risks = await this.riskRegisterService.getRisksByUniverseEntity(id, actor);
    return { ...response, risks };
  }

  async listEntities(query: UniverseQueryDto): Promise<{ entities: UniverseResponseDto[]; meta: PaginationMeta }> {
    const { skip, take, page, pageSize } = parsePagination(query);
    const where: Prisma.Audit_UniverseWhereInput = {
      deleted_at: null,
      ...(query.category && { category: query.category }),
      ...(query.status && { status: query.status }),
    };

    const [total, entities] = await prisma.$transaction([
      prisma.audit_Universe.count({ where }),
      prisma.audit_Universe.findMany({
        where,
        orderBy: { [query.sortBy]: query.sortOrder },
        skip,
        take,
      }),
    ]);

    return {
      entities: entities.map(mapUniverseToResponse),
      meta: buildPaginationMeta(total, page, pageSize),
    };
  }

  private async _assertEntityExists(id: string): Promise<void> {
    const entity = await prisma.audit_Universe.findFirst({
      where: { id, deleted_at: null },
      select: { id: true },
    });
    if (!entity) throw AppError.notFound('Audit universe entity');
  }
}
