"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RiskAssessmentService = void 0;
const client_1 = require("@prisma/client");
const prisma_client_1 = require("../../../../../shared/prisma/prisma.client");
const app_error_1 = require("../../../../../shared/errors/app.error");
const logger_util_1 = require("../../../../../shared/utils/logger.util");
const api_response_type_1 = require("../../../../../shared/types/api-response.type");
const audit_log_service_1 = require("../../../../logging/service/implementation/audit-log.service");
const prisma_types_1 = require("../../../../../shared/prisma/prisma.types");
const risk_utility_1 = require("../../../utility/risk.utility");
const assessment_response_dto_1 = require("../../dto/response/assessment.response.dto");
class RiskAssessmentService {
    async createAssessment(riskId, dto, actor) {
        (0, risk_utility_1.assertHasPermission)(actor.permissions, 'risk:assess');
        const score = (0, risk_utility_1.calculateRiskScore)(dto.likelihood, dto.impact);
        const assessedAt = dto.assessedAt ? new Date(dto.assessedAt) : new Date();
        const assessment = await prisma_client_1.prisma.$transaction(async (tx) => {
            const risk = await tx.risk_Register.findFirst({
                where: { id: riskId, deleted_at: null },
                select: { id: true, universe_id: true },
            });
            if (!risk)
                throw app_error_1.AppError.notFound('Risk');
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
                include: prisma_types_1.riskAssessmentWithAssessorInclude,
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
                            : new client_1.Prisma.Decimal(universeRiskScore._max.current_score),
                    },
                });
            }
            return created;
        });
        logger_util_1.logger.info('Risk assessment created', {
            assessmentId: assessment.id,
            riskId,
            actorId: actor.id,
            score,
        });
        audit_log_service_1.auditLogService.logAsync({
            userId: actor.id,
            action: 'risk.assessment.create',
            module: 'risk',
            entityType: 'risk_assessment',
            entityId: assessment.id,
            newValues: (0, assessment_response_dto_1.mapRiskAssessmentToResponse)(assessment),
        });
        return (0, assessment_response_dto_1.mapRiskAssessmentToResponse)(assessment);
    }
    async getAssessmentById(id, actor) {
        const assessment = await prisma_client_1.prisma.risk_Assessment.findUnique({
            where: { id },
            include: {
                ...prisma_types_1.riskAssessmentWithAssessorInclude,
                risk: { select: { owner_id: true, deleted_at: true } },
            },
        });
        const restrictToOwner = !actor.permissions.includes('risk:read_all');
        if (!assessment ||
            assessment.risk.deleted_at !== null ||
            (restrictToOwner && assessment.risk.owner_id !== actor.id)) {
            throw app_error_1.AppError.notFound('Risk assessment');
        }
        return (0, assessment_response_dto_1.mapRiskAssessmentToResponse)(assessment);
    }
    async listAssessments(riskId, query, actor) {
        await this._assertRiskExists(riskId, actor);
        const { skip, take, page, pageSize } = (0, api_response_type_1.parsePagination)(query);
        const where = { risk_id: riskId };
        const [total, assessments] = await prisma_client_1.prisma.$transaction([
            prisma_client_1.prisma.risk_Assessment.count({ where }),
            prisma_client_1.prisma.risk_Assessment.findMany({
                where,
                include: prisma_types_1.riskAssessmentWithAssessorInclude,
                orderBy: { assessed_at: 'desc' },
                skip,
                take,
            }),
        ]);
        return {
            assessments: assessments.map(assessment_response_dto_1.mapRiskAssessmentToResponse),
            meta: (0, api_response_type_1.buildPaginationMeta)(total, page, pageSize),
        };
    }
    async getLatestAssessment(riskId, actor) {
        await this._assertRiskExists(riskId, actor);
        const assessment = await prisma_client_1.prisma.risk_Assessment.findFirst({
            where: { risk_id: riskId },
            include: prisma_types_1.riskAssessmentWithAssessorInclude,
            orderBy: { assessed_at: 'desc' },
        });
        return assessment ? (0, assessment_response_dto_1.mapRiskAssessmentToResponse)(assessment) : null;
    }
    async _assertRiskExists(riskId, actor) {
        const restrictToOwner = !actor.permissions.includes('risk:read_all');
        const risk = await prisma_client_1.prisma.risk_Register.findFirst({
            where: {
                id: riskId,
                deleted_at: null,
                ...(restrictToOwner && { owner_id: actor.id }),
            },
            select: { id: true },
        });
        if (!risk)
            throw app_error_1.AppError.notFound('Risk');
    }
}
exports.RiskAssessmentService = RiskAssessmentService;
//# sourceMappingURL=assessment.service.js.map