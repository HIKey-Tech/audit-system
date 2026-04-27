"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RiskMonitoringService = void 0;
const prisma_client_1 = require("../../../../../shared/prisma/prisma.client");
const app_error_1 = require("../../../../../shared/errors/app.error");
const api_response_type_1 = require("../../../../../shared/types/api-response.type");
const prisma_types_1 = require("../../../../../shared/prisma/prisma.types");
const risk_enum_1 = require("../../../domain/enum/risk.enum");
const risk_utility_1 = require("../../../utility/risk.utility");
const register_response_dto_1 = require("../../../register/dto/response/register.response.dto");
class RiskMonitoringService {
    async getHighRiskItems(query, actor) {
        const { skip, take, page, pageSize } = (0, api_response_type_1.parsePagination)(query);
        const where = {
            deleted_at: null,
            current_score: { gte: query.threshold },
            ...((0, risk_utility_1.hasAuditeeRole)(actor.roles) && { owner_id: actor.id }),
        };
        const [total, risks] = await prisma_client_1.prisma.$transaction([
            prisma_client_1.prisma.risk_Register.count({ where }),
            prisma_client_1.prisma.risk_Register.findMany({
                where,
                include: prisma_types_1.riskRegisterWithDetailsInclude,
                orderBy: { current_score: 'desc' },
                skip,
                take,
            }),
        ]);
        return {
            risks: risks.map(register_response_dto_1.mapRiskRegisterToResponse),
            meta: (0, api_response_type_1.buildPaginationMeta)(total, page, pageSize),
        };
    }
    async getRisksRequiringAttention(actor) {
        (0, risk_utility_1.assertHasRole)(actor.roles, risk_utility_1.RISK_ASSESSOR_ROLES);
        const staleCutoff = new Date();
        staleCutoff.setDate(staleCutoff.getDate() - 90);
        const risks = await prisma_client_1.prisma.risk_Register.findMany({
            where: {
                deleted_at: null,
                status: { in: [risk_enum_1.RiskStatus.Open, risk_enum_1.RiskStatus.Mitigated] },
                current_score: { gte: 13 },
                OR: [
                    { last_assessed_at: null },
                    { last_assessed_at: { lt: staleCutoff } },
                ],
            },
            include: prisma_types_1.riskRegisterWithDetailsInclude,
            orderBy: { current_score: 'desc' },
        });
        return risks.map(register_response_dto_1.mapRiskRegisterToResponse);
    }
    async getRiskScoreTrend(riskId, actor) {
        const risk = await prisma_client_1.prisma.risk_Register.findFirst({
            where: {
                id: riskId,
                deleted_at: null,
                ...((0, risk_utility_1.hasAuditeeRole)(actor.roles) && { owner_id: actor.id }),
            },
            select: { id: true },
        });
        if (!risk)
            throw app_error_1.AppError.notFound('Risk');
        const assessments = await prisma_client_1.prisma.risk_Assessment.findMany({
            where: { risk_id: riskId },
            orderBy: { assessed_at: 'asc' },
            select: {
                id: true,
                likelihood: true,
                impact: true,
                score: true,
                assessed_at: true,
            },
        });
        return assessments.map((assessment) => ({
            assessmentId: assessment.id,
            likelihood: assessment.likelihood,
            impact: assessment.impact,
            score: assessment.score,
            assessedAt: assessment.assessed_at.toISOString(),
        }));
    }
    async getOrganizationRiskSummary(actor) {
        const risks = await prisma_client_1.prisma.risk_Register.findMany({
            where: {
                deleted_at: null,
                ...((0, risk_utility_1.hasAuditeeRole)(actor.roles) && { owner_id: actor.id }),
            },
            select: { current_score: true, status: true },
        });
        const summary = {
            byScoreBand: {
                low: 0,
                medium: 0,
                high: 0,
                critical: 0,
            },
            byStatus: {
                open: 0,
                mitigated: 0,
                accepted: 0,
                closed: 0,
            },
            total: risks.length,
        };
        risks.forEach((risk) => {
            summary.byScoreBand[(0, risk_utility_1.getRiskScoreBand)(risk.current_score)] += 1;
            if (risk.status in summary.byStatus) {
                const status = risk.status;
                summary.byStatus[status] += 1;
            }
        });
        return summary;
    }
}
exports.RiskMonitoringService = RiskMonitoringService;
//# sourceMappingURL=monitoring.service.js.map