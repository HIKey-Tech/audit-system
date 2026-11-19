import { Prisma } from '@prisma/client';
import { prisma } from '../../../../../shared/prisma/prisma.client';
import { AppError } from '../../../../../shared/errors/app.error';
import { logger } from '../../../../../shared/utils/logger.util';
import { PaginationMeta, buildPaginationMeta, parsePagination } from '../../../../../shared/types/api-response.type';
import { auditLogService } from '../../../../logging/service/implementation/audit-log.service';
import { ActorContext } from '../../../domain/entity/audit.entity';
import { FindingStatus, UniverseStatus } from '../../../domain/enum/audit.enum';
import { assertHasPermission } from '../../../utility/audit.utility';
import { invalidatePlanningRecommendationsCache } from '../../../planning/utility/recommendations-cache.utility';
import {
  CreateUniverseRequestDto,
  UpdateUniverseRequestDto,
  UniverseQueryDto,
} from '../../dto/request/universe.request.dto';
import { UniverseResponseDto, mapUniverseToResponse } from '../../dto/response/universe.response.dto';
import { listUniverseReferenceBlockers, resolveUniverseOwners } from '../../utility/universe.utility';
import { IUniverseService } from '../interface/universe.service.interface';
import { notificationQueueService } from '../../../../messaging/service/implementation/notification-queue.service';
import { config } from '../../../../../shared/config/app.config';
import { IRegisterService } from '../../../../risk/register/service/interface/register.service.interface';

const userBriefSelect = { id: true, display_name: true, first_name: true, last_name: true } as const;

const universeInclude = {
  owner: { select: userBriefSelect },
  additional_owners: {
    include: { user: { select: userBriefSelect } },
    orderBy: { created_at: 'asc' as const },
  },
};

export class UniverseService implements IUniverseService {
  constructor(private readonly riskRegisterService?: IRegisterService) {}

  async createEntity(dto: CreateUniverseRequestDto, actor: ActorContext): Promise<UniverseResponseDto> {
    assertHasPermission(actor.permissions, 'universe:create');

    const resolvedOwners = resolveUniverseOwners(dto);
    if (!resolvedOwners) {
      throw AppError.badRequest('At least one staff in charge is required');
    }
    await this._assertOwnersActive([resolvedOwners.primaryOwnerId, ...resolvedOwners.additionalOwnerIds]);

    const entity = await prisma.$transaction(async (tx) => {
      const created = await tx.audit_Universe.create({
        data: {
          name: dto.name,
          description: dto.description,
          category: dto.category,
          owner_id: resolvedOwners.primaryOwnerId,
          risk_score: dto.riskScore === undefined ? null : new Prisma.Decimal(dto.riskScore),
          last_audited_at: dto.lastAuditedAt ? new Date(dto.lastAuditedAt) : null,
          audit_frequency: dto.auditFrequency,
          created_by_id: actor.id,
        },
        include: universeInclude,
      });

      if (resolvedOwners.additionalOwnerIds.length > 0) {
        await tx.audit_Universe_Owner.createMany({
          data: resolvedOwners.additionalOwnerIds.map((userId) => ({
            universe_id: created.id,
            user_id: userId,
          })),
        });
        return tx.audit_Universe.findUniqueOrThrow({
          where: { id: created.id },
          include: universeInclude,
        });
      }

      return created;
    });

    invalidatePlanningRecommendationsCache();
    await this._notifyStaffInCharge(entity.id, entity.name, [resolvedOwners.primaryOwnerId, ...resolvedOwners.additionalOwnerIds], actor.id);
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
    const before = await prisma.audit_Universe.findFirst({
      where: { id, deleted_at: null },
      include: universeInclude,
    });
    if (!before) throw AppError.notFound('Audit universe entity');

    const resolvedOwners = resolveUniverseOwners(dto, {
      primaryOwnerId: before.owner_id,
      additionalOwnerIds: before.additional_owners.map((o) => o.user_id),
    });

    if (dto.ownerIds !== undefined && !resolvedOwners) {
      throw AppError.badRequest('At least one staff in charge is required');
    }

    if (resolvedOwners) {
      await this._assertOwnersActive([resolvedOwners.primaryOwnerId, ...resolvedOwners.additionalOwnerIds]);
    }

    const entity = await prisma.$transaction(async (tx) => {
      const updated = await tx.audit_Universe.update({
        where: { id },
        data: {
          ...(dto.name !== undefined && { name: dto.name }),
          ...(dto.description !== undefined && { description: dto.description }),
          ...(dto.category !== undefined && { category: dto.category }),
          ...(resolvedOwners && { owner_id: resolvedOwners.primaryOwnerId }),
          ...(dto.riskScore !== undefined && {
            risk_score: dto.riskScore === null ? null : new Prisma.Decimal(dto.riskScore),
          }),
          ...(dto.lastAuditedAt !== undefined && {
            last_audited_at: dto.lastAuditedAt === null ? null : new Date(dto.lastAuditedAt),
          }),
          ...(dto.auditFrequency !== undefined && { audit_frequency: dto.auditFrequency }),
          ...(dto.status !== undefined && { status: dto.status }),
        },
        include: universeInclude,
      });

      if (resolvedOwners) {
        await tx.audit_Universe_Owner.deleteMany({ where: { universe_id: id } });
        if (resolvedOwners.additionalOwnerIds.length > 0) {
          await tx.audit_Universe_Owner.createMany({
            data: resolvedOwners.additionalOwnerIds.map((userId) => ({
              universe_id: id,
              user_id: userId,
            })),
          });
        }
        return tx.audit_Universe.findUniqueOrThrow({
          where: { id },
          include: universeInclude,
        });
      }

      return updated;
    });

    invalidatePlanningRecommendationsCache();
    if (resolvedOwners) {
      // Only the people newly put in charge are told; someone who already was is not emailed again.
      const before_ids = new Set([before.owner_id, ...before.additional_owners.map((o) => o.user_id)]);
      const now_ids = [resolvedOwners.primaryOwnerId, ...resolvedOwners.additionalOwnerIds];
      await this._notifyStaffInCharge(id, entity.name, now_ids.filter((uid) => !before_ids.has(uid)), actor.id);
    }
    logger.info('Audit universe entity updated', { entityId: id, actorId: actor.id });
    auditLogService.logAsync({
      userId: actor.id,
      action: 'audit.universe.update',
      module: 'audit',
      entityType: 'audit_universe',
      entityId: id,
      oldValues: mapUniverseToResponse(before),
      newValues: mapUniverseToResponse(entity),
    });

    return mapUniverseToResponse(entity);
  }

  async deactivateEntity(id: string, actor: ActorContext): Promise<void> {
    assertHasPermission(actor.permissions, 'universe:delete');
    const existing = await prisma.audit_Universe.findFirst({
      where: { id, deleted_at: null },
      include: universeInclude,
    });
    if (!existing) throw AppError.notFound('Audit universe entity');

    const [planItems, engagements, risks, assets, systemDocs] = await prisma.$transaction([
      prisma.audit_Plan_Item.count({
        where: { universe_id: id, plan: { deleted_at: null } },
      }),
      prisma.audit_Engagement.count({
        where: { universe_id: id, deleted_at: null },
      }),
      prisma.risk_Register.count({
        where: { universe_id: id, deleted_at: null },
      }),
      prisma.audit_Universe_Asset.count({
        where: { universe_id: id },
      }),
      prisma.system_Document.count({
        where: { universe_id: id, deleted_at: null },
      }),
    ]);

    const blockers = listUniverseReferenceBlockers({
      planItems,
      engagements,
      risks,
      assets,
      systemDocs,
    });
    if (blockers.length > 0) {
      throw AppError.badRequest(
        `Cannot remove '${existing.name}' because it is linked to ${blockers.join(', ')}. Edit it and set Status to Inactive to retire it without losing history.`,
      );
    }

    await prisma.audit_Universe.update({
      where: { id },
      data: {
        status: UniverseStatus.Inactive,
        deleted_at: new Date(),
      },
    });

    invalidatePlanningRecommendationsCache();
    logger.info('Audit universe entity deactivated', { entityId: id, actorId: actor.id });
    auditLogService.logAsync({
      userId: actor.id,
      action: 'audit.universe.deactivate',
      module: 'audit',
      entityType: 'audit_universe',
      entityId: id,
      oldValues: mapUniverseToResponse(existing),
    });
  }

  async getEntityById(id: string, actor: ActorContext): Promise<UniverseResponseDto> {
    const entity = await prisma.audit_Universe.findFirst({
      where: { id, deleted_at: null },
      include: universeInclude,
    });
    if (!entity) throw AppError.notFound('Audit universe entity');
    const response = mapUniverseToResponse(entity);

    const engagements = await prisma.audit_Engagement.findMany({
      where: { universe_id: id, deleted_at: null },
      orderBy: { created_at: 'desc' },
      select: {
        id: true,
        reference_number: true,
        title: true,
        audit_type: true,
        status: true,
        actual_start_date: true,
        planned_start_date: true,
        actual_end_date: true,
        planned_end_date: true,
      },
    });
    response.engagementHistory = engagements.map((e) => ({
      id: e.id,
      referenceNumber: e.reference_number,
      title: e.title,
      auditType: e.audit_type,
      status: e.status,
      startDate: (e.actual_start_date ?? e.planned_start_date)?.toISOString() ?? null,
      endDate: (e.actual_end_date ?? e.planned_end_date)?.toISOString() ?? null,
    }));

    if (this.riskRegisterService) {
      const risks = await this.riskRegisterService.getRisksByUniverseEntity(id, actor);
      response.linkedRisks = risks.map((r) => ({
        id: r.id,
        title: r.title,
        currentScore: r.currentScore,
        status: r.status,
        categoryName: r.categoryName,
      }));
    }

    // Audit results feeding back into the entity's risk picture: how many
    // findings raised against this entity's engagements are still unresolved.
    response.openFindingsCount = await prisma.audit_Finding.count({
      where: {
        deleted_at: null,
        status: { not: FindingStatus.Closed },
        engagement: { universe_id: id, deleted_at: null },
      },
    });

    return response;
  }

  async listEntities(query: UniverseQueryDto): Promise<{ entities: UniverseResponseDto[]; meta: PaginationMeta }> {
    const { skip, take, page, pageSize } = parsePagination(query);
    const where: Prisma.Audit_UniverseWhereInput = {
      deleted_at: null,
      ...(query.category && { category: query.category }),
      ...(query.auditFrequency && { audit_frequency: query.auditFrequency }),
      ...(query.status && { status: query.status }),
      ...(query.search && {
        OR: [
          { name: { contains: query.search } },
          { description: { contains: query.search } },
        ],
      }),
    };

    const [total, entities] = await prisma.$transaction([
      prisma.audit_Universe.count({ where }),
      prisma.audit_Universe.findMany({
        where,
        include: universeInclude,
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

  /** Tells people they have been put in charge of an area. Never tells the person who just did it, and never fails the save. */
  private async _notifyStaffInCharge(entityId: string, entityName: string, userIds: string[], actorId: string): Promise<void> {
    const ids = [...new Set(userIds)].filter((id) => id !== actorId);
    if (ids.length === 0) return;
    try {
      const users = await prisma.user.findMany({
        where: { id: { in: ids }, deleted_at: null, is_active: true },
        select: { id: true, email: true, display_name: true, first_name: true, last_name: true },
      });
      const actionUrl = `${config.app.frontendUrl.replace(/\/$/, '')}/audit/universe/${entityId}`;
      for (const user of users) {
        const recipientName = user.display_name ?? `${user.first_name} ${user.last_name}`.trim();
        const variables = { recipientName, entityName, actionUrl };
        await notificationQueueService.enqueueSafe('in_app', {
          userId: user.id,
          title: `You are in charge of ${entityName}`,
          body: `You have been named the staff in charge of "${entityName}" in the Audit Universe.`,
          type: 'info',
          referenceType: 'audit_universe',
          referenceId: entityId,
          eventKey: 'audit.universe.staff_in_charge',
          variables,
        });
        if (user.email) {
          await notificationQueueService.enqueueSafe('email', {
            to: user.email,
            subject: `You have been put in charge of ${entityName}`,
            text: `Dear ${recipientName},\n\nYou have been named the staff in charge of "${entityName}" in the IAMS Audit Universe. You will be the Internal Audit contact for this area: its audits, programme items and risk are yours to follow.\n\nOpen it: ${actionUrl}\n\nRegards,\nIAMS — Internal Audit System`,
            eventKey: 'audit.universe.staff_in_charge',
            variables,
          });
        }
      }
    } catch (err) {
      logger.warn('Staff in charge notification failed', { entityId, err });
    }
  }

  private async _assertOwnersActive(ownerIds: string[]): Promise<void> {
    const uniqueIds = [...new Set(ownerIds)];
    if (uniqueIds.length === 0) return;

    const users = await prisma.user.findMany({
      where: { id: { in: uniqueIds }, deleted_at: null, is_active: true },
      select: { id: true },
    });
    const found = new Set(users.map((u) => u.id));
    if (found.size !== uniqueIds.length) {
      throw AppError.badRequest('One or more selected staff in charge do not exist or are inactive');
    }
  }
}
