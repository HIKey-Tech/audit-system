"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UniverseService = void 0;
const client_1 = require("@prisma/client");
const prisma_client_1 = require("../../../../../shared/prisma/prisma.client");
const app_error_1 = require("../../../../../shared/errors/app.error");
const logger_util_1 = require("../../../../../shared/utils/logger.util");
const api_response_type_1 = require("../../../../../shared/types/api-response.type");
const audit_log_service_1 = require("../../../../logging/service/implementation/audit-log.service");
const audit_enum_1 = require("../../../domain/enum/audit.enum");
const audit_utility_1 = require("../../../utility/audit.utility");
const universe_response_dto_1 = require("../../dto/response/universe.response.dto");
class UniverseService {
    riskRegisterService;
    constructor(riskRegisterService) {
        this.riskRegisterService = riskRegisterService;
    }
    async createEntity(dto, actor) {
        (0, audit_utility_1.assertHasRole)(actor.roles, audit_utility_1.AUDIT_ADMIN_ROLES);
        const entity = await prisma_client_1.prisma.audit_Universe.create({
            data: {
                name: dto.name,
                description: dto.description,
                category: dto.category,
                owner_id: dto.ownerId,
                risk_score: dto.riskScore === undefined ? null : new client_1.Prisma.Decimal(dto.riskScore),
                last_audited_at: dto.lastAuditedAt ? new Date(dto.lastAuditedAt) : null,
                audit_frequency: dto.auditFrequency,
                created_by_id: actor.id,
            },
        });
        logger_util_1.logger.info('Audit universe entity created', { entityId: entity.id, actorId: actor.id });
        audit_log_service_1.auditLogService.logAsync({
            userId: actor.id,
            action: 'audit.universe.create',
            module: 'audit',
            entityType: 'audit_universe',
            entityId: entity.id,
            newValues: (0, universe_response_dto_1.mapUniverseToResponse)(entity),
        });
        return (0, universe_response_dto_1.mapUniverseToResponse)(entity);
    }
    async updateEntity(id, dto, actor) {
        (0, audit_utility_1.assertHasRole)(actor.roles, audit_utility_1.AUDIT_ADMIN_ROLES);
        await this._assertEntityExists(id);
        const entity = await prisma_client_1.prisma.audit_Universe.update({
            where: { id },
            data: {
                ...(dto.name !== undefined && { name: dto.name }),
                ...(dto.description !== undefined && { description: dto.description }),
                ...(dto.category !== undefined && { category: dto.category }),
                ...(dto.ownerId !== undefined && { owner_id: dto.ownerId }),
                ...(dto.riskScore !== undefined && {
                    risk_score: dto.riskScore === null ? null : new client_1.Prisma.Decimal(dto.riskScore),
                }),
                ...(dto.lastAuditedAt !== undefined && {
                    last_audited_at: dto.lastAuditedAt === null ? null : new Date(dto.lastAuditedAt),
                }),
                ...(dto.auditFrequency !== undefined && { audit_frequency: dto.auditFrequency }),
                ...(dto.status !== undefined && { status: dto.status }),
            },
        });
        logger_util_1.logger.info('Audit universe entity updated', { entityId: id, actorId: actor.id });
        audit_log_service_1.auditLogService.logAsync({
            userId: actor.id,
            action: 'audit.universe.update',
            module: 'audit',
            entityType: 'audit_universe',
            entityId: id,
            newValues: (0, universe_response_dto_1.mapUniverseToResponse)(entity),
        });
        return (0, universe_response_dto_1.mapUniverseToResponse)(entity);
    }
    async deactivateEntity(id, actor) {
        (0, audit_utility_1.assertHasRole)(actor.roles, audit_utility_1.AUDIT_ADMIN_ROLES);
        await this._assertEntityExists(id);
        await prisma_client_1.prisma.audit_Universe.update({
            where: { id },
            data: {
                status: audit_enum_1.UniverseStatus.Inactive,
                deleted_at: new Date(),
            },
        });
        logger_util_1.logger.info('Audit universe entity deactivated', { entityId: id, actorId: actor.id });
        audit_log_service_1.auditLogService.logAsync({
            userId: actor.id,
            action: 'audit.universe.deactivate',
            module: 'audit',
            entityType: 'audit_universe',
            entityId: id,
        });
    }
    async getEntityById(id, actor) {
        const entity = await prisma_client_1.prisma.audit_Universe.findFirst({
            where: { id, deleted_at: null },
        });
        if (!entity)
            throw app_error_1.AppError.notFound('Audit universe entity');
        const response = (0, universe_response_dto_1.mapUniverseToResponse)(entity);
        if (!this.riskRegisterService)
            return response;
        const risks = await this.riskRegisterService.getRisksByUniverseEntity(id, actor);
        return { ...response, risks };
    }
    async listEntities(query) {
        const { skip, take, page, pageSize } = (0, api_response_type_1.parsePagination)(query);
        const where = {
            deleted_at: null,
            ...(query.category && { category: query.category }),
            ...(query.status && { status: query.status }),
        };
        const [total, entities] = await prisma_client_1.prisma.$transaction([
            prisma_client_1.prisma.audit_Universe.count({ where }),
            prisma_client_1.prisma.audit_Universe.findMany({
                where,
                orderBy: { [query.sortBy]: query.sortOrder },
                skip,
                take,
            }),
        ]);
        return {
            entities: entities.map(universe_response_dto_1.mapUniverseToResponse),
            meta: (0, api_response_type_1.buildPaginationMeta)(total, page, pageSize),
        };
    }
    async _assertEntityExists(id) {
        const entity = await prisma_client_1.prisma.audit_Universe.findFirst({
            where: { id, deleted_at: null },
            select: { id: true },
        });
        if (!entity)
            throw app_error_1.AppError.notFound('Audit universe entity');
    }
}
exports.UniverseService = UniverseService;
//# sourceMappingURL=universe.service.js.map