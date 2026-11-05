import { prisma } from '../../../../../shared/prisma/prisma.client';
import { AppError } from '../../../../../shared/errors/app.error';
import { logger } from '../../../../../shared/utils/logger.util';
import { auditLogService } from '../../../../logging/service/implementation/audit-log.service';
import { ActorContext } from '../../../../audit/domain/entity/audit.entity';
import { LinkProjectPlusEntityDto } from '../../dto/request/projectplus.request.dto';
import {
  mapProjectPlusLinkToResponse,
  ProjectPlusEntityLinkResponseDto,
} from '../../dto/response/projectplus.response.dto';
import { IProjectPlusClient } from '../client/projectplus.client';
import { IProjectPlusLinkService } from '../interface/projectplus-link.service.interface';

const assertPermission = (actor: ActorContext, permission: string): void => {
  if (!actor.permissions.includes(permission)) {
    throw AppError.forbidden(`Missing required permission: ${permission}`);
  }
};

/**
 * Optional engagement ↔ Project Plus entity association. Writes only to IAMS's
 * own table; Project Plus itself is only ever read.
 */
export class ProjectPlusLinkService implements IProjectPlusLinkService {
  constructor(private readonly client: IProjectPlusClient) {}

  async listLinks(engagementId: string, actor: ActorContext): Promise<ProjectPlusEntityLinkResponseDto[]> {
    assertPermission(actor, 'projectplus:read');
    const links = await prisma.projectplus_Entity_Link.findMany({
      where: { engagement_id: engagementId, is_active: true, deleted_at: null },
      orderBy: { created_at: 'desc' },
    });
    return links.map(mapProjectPlusLinkToResponse);
  }

  async getLink(id: string): Promise<ProjectPlusEntityLinkResponseDto> {
    return mapProjectPlusLinkToResponse(await this._getActive(id));
  }

  async linkEntity(
    engagementId: string,
    dto: LinkProjectPlusEntityDto,
    actor: ActorContext,
  ): Promise<ProjectPlusEntityLinkResponseDto> {
    assertPermission(actor, 'projectplus:link');
    const entities = await this.client.listEntities(dto.customerType);
    const code = dto.referenceCode.toLowerCase();
    const entity = entities.find((e) => e.referenceCode?.toLowerCase() === code);
    if (!entity?.referenceCode) throw AppError.notFound('Project Plus entity');

    const summary = {
      full_name: entity.fullName,
      entity_type: entity.entityType,
      entity_sub_type: entity.entitySubType,
      rc_number: entity.rcNumber,
      tin: entity.tin,
      last_status: entity.status,
      last_synced_at: new Date(),
    };
    const link = await prisma.projectplus_Entity_Link.upsert({
      where: {
        engagement_id_customer_type_reference_code: {
          engagement_id: engagementId,
          customer_type: dto.customerType,
          reference_code: entity.referenceCode,
        },
      },
      create: {
        engagement_id: engagementId,
        customer_type: dto.customerType,
        reference_code: entity.referenceCode,
        created_by_id: actor.id,
        ...summary,
      },
      update: { is_active: true, deleted_at: null, ...summary },
    });
    logger.info('Project Plus entity linked to audit engagement', {
      linkId: link.id, engagementId, referenceCode: entity.referenceCode, actorId: actor.id,
    });
    auditLogService.logAsync({
      userId: actor.id,
      action: 'integration.projectplus.entity.link',
      module: 'integration',
      entityType: 'projectplus_entity_link',
      entityId: link.id,
      newValues: { engagementId, customerType: dto.customerType, referenceCode: entity.referenceCode },
    });
    return mapProjectPlusLinkToResponse(link);
  }

  async unlinkEntity(id: string, actor: ActorContext): Promise<void> {
    assertPermission(actor, 'projectplus:link');
    const link = await this._getActive(id);
    await prisma.projectplus_Entity_Link.update({
      where: { id },
      data: { is_active: false, deleted_at: new Date() },
    });
    logger.info('Project Plus entity unlinked from audit engagement', {
      linkId: id, engagementId: link.engagement_id, actorId: actor.id,
    });
    auditLogService.logAsync({
      userId: actor.id,
      action: 'integration.projectplus.entity.unlink',
      module: 'integration',
      entityType: 'projectplus_entity_link',
      entityId: id,
      oldValues: { engagementId: link.engagement_id, referenceCode: link.reference_code },
    });
  }

  private async _getActive(id: string) {
    const link = await prisma.projectplus_Entity_Link.findFirst({
      where: { id, is_active: true, deleted_at: null },
    });
    if (!link) throw AppError.notFound('Project Plus entity link');
    return link;
  }
}
