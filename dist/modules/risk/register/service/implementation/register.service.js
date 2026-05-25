"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RiskRegisterService = void 0;
const prisma_client_1 = require("../../../../../shared/prisma/prisma.client");
const app_error_1 = require("../../../../../shared/errors/app.error");
const logger_util_1 = require("../../../../../shared/utils/logger.util");
const api_response_type_1 = require("../../../../../shared/types/api-response.type");
const audit_log_service_1 = require("../../../../logging/service/implementation/audit-log.service");
const prisma_types_1 = require("../../../../../shared/prisma/prisma.types");
const risk_utility_1 = require("../../../utility/risk.utility");
const register_response_dto_1 = require("../../dto/response/register.response.dto");
class RiskRegisterService {
    async createRisk(dto, actor) {
        (0, risk_utility_1.assertHasPermission)(actor.permissions, 'risk:create');
        const score = (0, risk_utility_1.calculateRiskScore)(dto.likelihood, dto.impact);
        const risk = await prisma_client_1.prisma.risk_Register.create({
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
            include: prisma_types_1.riskRegisterWithDetailsInclude,
        });
        logger_util_1.logger.info('Risk created', { riskId: risk.id, actorId: actor.id, currentScore: score });
        audit_log_service_1.auditLogService.logAsync({
            userId: actor.id,
            action: 'risk.register.create',
            module: 'risk',
            entityType: 'risk_register',
            entityId: risk.id,
            newValues: (0, register_response_dto_1.mapRiskRegisterToResponse)(risk),
        });
        return (0, register_response_dto_1.mapRiskRegisterToResponse)(risk);
    }
    async updateRisk(id, dto, actor) {
        (0, risk_utility_1.assertHasPermission)(actor.permissions, 'risk:update');
        const existing = await this._getExistingRisk(id);
        const likelihood = dto.likelihood ?? existing.likelihood;
        const impact = dto.impact ?? existing.impact;
        const score = (0, risk_utility_1.calculateRiskScore)(likelihood, impact);
        const scoreChanged = likelihood !== existing.likelihood || impact !== existing.impact;
        const risk = await prisma_client_1.prisma.risk_Register.update({
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
            include: prisma_types_1.riskRegisterWithDetailsInclude,
        });
        logger_util_1.logger.info('Risk updated', { riskId: id, actorId: actor.id });
        audit_log_service_1.auditLogService.logAsync({
            userId: actor.id,
            action: 'risk.register.update',
            module: 'risk',
            entityType: 'risk_register',
            entityId: id,
            newValues: (0, register_response_dto_1.mapRiskRegisterToResponse)(risk),
        });
        return (0, register_response_dto_1.mapRiskRegisterToResponse)(risk);
    }
    async updateRiskStatus(id, dto, actor) {
        (0, risk_utility_1.assertHasPermission)(actor.permissions, 'risk:update');
        await this._getExistingRisk(id);
        const risk = await prisma_client_1.prisma.risk_Register.update({
            where: { id },
            data: { status: dto.status },
            include: prisma_types_1.riskRegisterWithDetailsInclude,
        });
        logger_util_1.logger.info('Risk status updated', { riskId: id, actorId: actor.id, status: dto.status });
        audit_log_service_1.auditLogService.logAsync({
            userId: actor.id,
            action: 'risk.register.status_update',
            module: 'risk',
            entityType: 'risk_register',
            entityId: id,
            newValues: { status: dto.status },
        });
        return (0, register_response_dto_1.mapRiskRegisterToResponse)(risk);
    }
    async deleteRisk(id, actor) {
        (0, risk_utility_1.assertHasPermission)(actor.permissions, 'risk:delete');
        await this._getExistingRisk(id);
        await prisma_client_1.prisma.risk_Register.update({
            where: { id },
            data: { deleted_at: new Date() },
        });
        logger_util_1.logger.info('Risk soft-deleted', { riskId: id, actorId: actor.id });
        audit_log_service_1.auditLogService.logAsync({
            userId: actor.id,
            action: 'risk.register.delete',
            module: 'risk',
            entityType: 'risk_register',
            entityId: id,
        });
    }
    async getRiskById(id, actor) {
        const restrictToOwner = !actor.permissions.includes('risk:read_all');
        const risk = await prisma_client_1.prisma.risk_Register.findFirst({
            where: {
                id,
                deleted_at: null,
                ...(restrictToOwner && { owner_id: actor.id }),
            },
            include: prisma_types_1.riskRegisterWithDetailsInclude,
        });
        if (!risk)
            throw app_error_1.AppError.notFound('Risk');
        return (0, register_response_dto_1.mapRiskRegisterToResponse)(risk);
    }
    async listRisks(query, actor) {
        const { skip, take, page, pageSize } = (0, api_response_type_1.parsePagination)(query);
        const restrictToOwner = !actor.permissions.includes('risk:read_all');
        const where = {
            deleted_at: null,
            ...(query.categoryId && { category_id: query.categoryId }),
            ...(query.status && { status: query.status }),
            ...(query.ownerId && { owner_id: query.ownerId }),
            ...(restrictToOwner && { owner_id: actor.id }),
        };
        const [total, risks] = await prisma_client_1.prisma.$transaction([
            prisma_client_1.prisma.risk_Register.count({ where }),
            prisma_client_1.prisma.risk_Register.findMany({
                where,
                include: prisma_types_1.riskRegisterWithDetailsInclude,
                orderBy: { [query.sortBy]: query.sortOrder },
                skip,
                take,
            }),
        ]);
        return {
            risks: risks.map(register_response_dto_1.mapRiskRegisterToResponse),
            meta: (0, api_response_type_1.buildPaginationMeta)(total, page, pageSize),
        };
    }
    async getRisksByUniverseEntity(universeId, actor) {
        const restrictToOwner = actor ? !actor.permissions.includes('risk:read_all') : false;
        const risks = await prisma_client_1.prisma.risk_Register.findMany({
            where: {
                universe_id: universeId,
                deleted_at: null,
                ...(restrictToOwner && actor && { owner_id: actor.id }),
            },
            include: prisma_types_1.riskRegisterWithDetailsInclude,
            orderBy: { current_score: 'desc' },
        });
        return risks.map(register_response_dto_1.mapRiskRegisterToResponse);
    }
    async _getExistingRisk(id) {
        const risk = await prisma_client_1.prisma.risk_Register.findFirst({
            where: { id, deleted_at: null },
            select: { id: true, likelihood: true, impact: true },
        });
        if (!risk)
            throw app_error_1.AppError.notFound('Risk');
        return risk;
    }
}
exports.RiskRegisterService = RiskRegisterService;
//# sourceMappingURL=register.service.js.map