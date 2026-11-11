"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProjectPlusLinkService = void 0;
const prisma_client_1 = require("../../../../../shared/prisma/prisma.client");
const app_error_1 = require("../../../../../shared/errors/app.error");
const logger_util_1 = require("../../../../../shared/utils/logger.util");
const audit_log_service_1 = require("../../../../logging/service/implementation/audit-log.service");
const projectplus_response_dto_1 = require("../../dto/response/projectplus.response.dto");
const assertPermission = (actor, permission) => {
    if (!actor.permissions.includes(permission)) {
        throw app_error_1.AppError.forbidden(`Missing required permission: ${permission}`);
    }
};
/**
 * Optional engagement ↔ Project Plus entity association. Writes only to IAMS's
 * own table; Project Plus itself is only ever read.
 */
class ProjectPlusLinkService {
    client;
    constructor(client) {
        this.client = client;
    }
    async listLinks(engagementId, actor) {
        assertPermission(actor, 'projectplus:read');
        const links = await prisma_client_1.prisma.projectplus_Entity_Link.findMany({
            where: { engagement_id: engagementId, is_active: true, deleted_at: null },
            orderBy: { created_at: 'desc' },
        });
        return links.map(projectplus_response_dto_1.mapProjectPlusLinkToResponse);
    }
    async getLink(id) {
        return (0, projectplus_response_dto_1.mapProjectPlusLinkToResponse)(await this._getActive(id));
    }
    async linkEntity(engagementId, dto, actor) {
        assertPermission(actor, 'projectplus:link');
        const entities = await this.client.listEntities(dto.customerType);
        const code = dto.referenceCode.toLowerCase();
        const entity = entities.find((e) => e.referenceCode?.toLowerCase() === code);
        if (!entity?.referenceCode)
            throw app_error_1.AppError.notFound('Project Plus entity');
        const summary = {
            full_name: entity.fullName,
            entity_type: entity.entityType,
            entity_sub_type: entity.entitySubType,
            rc_number: entity.rcNumber,
            tin: entity.tin,
            last_status: entity.status,
            last_synced_at: new Date(),
        };
        const link = await prisma_client_1.prisma.projectplus_Entity_Link.upsert({
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
        logger_util_1.logger.info('Project Plus entity linked to audit engagement', {
            linkId: link.id, engagementId, referenceCode: entity.referenceCode, actorId: actor.id,
        });
        audit_log_service_1.auditLogService.logAsync({
            userId: actor.id,
            action: 'integration.projectplus.entity.link',
            module: 'integration',
            entityType: 'projectplus_entity_link',
            entityId: link.id,
            newValues: { engagementId, customerType: dto.customerType, referenceCode: entity.referenceCode },
        });
        return (0, projectplus_response_dto_1.mapProjectPlusLinkToResponse)(link);
    }
    async unlinkEntity(id, actor) {
        assertPermission(actor, 'projectplus:link');
        const link = await this._getActive(id);
        await prisma_client_1.prisma.projectplus_Entity_Link.update({
            where: { id },
            data: { is_active: false, deleted_at: new Date() },
        });
        logger_util_1.logger.info('Project Plus entity unlinked from audit engagement', {
            linkId: id, engagementId: link.engagement_id, actorId: actor.id,
        });
        audit_log_service_1.auditLogService.logAsync({
            userId: actor.id,
            action: 'integration.projectplus.entity.unlink',
            module: 'integration',
            entityType: 'projectplus_entity_link',
            entityId: id,
            oldValues: { engagementId: link.engagement_id, referenceCode: link.reference_code },
        });
    }
    async _getActive(id) {
        const link = await prisma_client_1.prisma.projectplus_Entity_Link.findFirst({
            where: { id, is_active: true, deleted_at: null },
        });
        if (!link)
            throw app_error_1.AppError.notFound('Project Plus entity link');
        return link;
    }
}
exports.ProjectPlusLinkService = ProjectPlusLinkService;
//# sourceMappingURL=projectplus-link.service.js.map