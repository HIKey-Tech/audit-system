"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AccessReviewService = void 0;
const prisma_client_1 = require("../../../../../shared/prisma/prisma.client");
const app_error_1 = require("../../../../../shared/errors/app.error");
const logger_util_1 = require("../../../../../shared/utils/logger.util");
const api_response_type_1 = require("../../../../../shared/types/api-response.type");
const tabular_export_util_1 = require("../../../../../shared/utils/tabular-export.util");
const prisma_types_1 = require("../../../../../shared/prisma/prisma.types");
const audit_log_service_1 = require("../../../../logging/service/implementation/audit-log.service");
const system_audit_enum_1 = require("../../../domain/enum/system-audit.enum");
const access_review_response_dto_1 = require("../../dto/response/access-review.response.dto");
class AccessReviewService {
    analyticsService;
    constructor(analyticsService) {
        this.analyticsService = analyticsService;
    }
    async listItems(runId, query, actor) {
        await this._assertAccessReview(runId, actor);
        const { skip, take, page, pageSize } = (0, api_response_type_1.parsePagination)(query);
        const where = {
            run_id: runId,
            ...(query.decision && { decision: query.decision }),
            ...(query.flagged !== undefined && { flags: query.flagged ? { not: null } : null }),
            ...(query.privileged !== undefined && { is_privileged: query.privileged }),
            ...(query.search && {
                OR: [
                    { account_id: { contains: query.search } },
                    { display_name: { contains: query.search } },
                    { email: { contains: query.search } },
                    { department: { contains: query.search } },
                ],
            }),
        };
        const [total, items] = await prisma_client_1.prisma.$transaction([
            prisma_client_1.prisma.access_Review_Item.count({ where }),
            prisma_client_1.prisma.access_Review_Item.findMany({
                where,
                include: prisma_types_1.accessReviewItemInclude,
                orderBy: [{ is_privileged: 'desc' }, { account_id: 'asc' }],
                skip,
                take,
            }),
        ]);
        return { items: items.map(access_review_response_dto_1.mapAccessItemToResponse), meta: (0, api_response_type_1.buildPaginationMeta)(total, page, pageSize) };
    }
    async decideItems(runId, dto, actor) {
        const run = await this._assertAccessReview(runId, actor);
        if (run.reviewStatus === system_audit_enum_1.RunReviewStatus.Completed) {
            throw app_error_1.AppError.badRequest('This access review is signed off — decisions can no longer change');
        }
        const ids = Array.from(new Set(dto.itemIds));
        const found = await prisma_client_1.prisma.access_Review_Item.count({ where: { id: { in: ids }, run_id: runId } });
        if (found !== ids.length)
            throw app_error_1.AppError.badRequest('Every account must belong to this access review');
        const resetting = dto.decision === system_audit_enum_1.AccessDecision.Pending;
        if (dto.decision === system_audit_enum_1.AccessDecision.Appropriate && (dto.note?.trim().length ?? 0) < 5) {
            // Accepting privileged or conflicting access is a judgement call and must be explained.
            const needsJustification = await prisma_client_1.prisma.access_Review_Item.count({
                where: {
                    id: { in: ids },
                    run_id: runId,
                    OR: [{ is_privileged: true }, { flags: { contains: 'SOD_CONFLICT' } }],
                },
            });
            if (needsJustification > 0) {
                throw app_error_1.AppError.badRequest(`A justification is required to mark ${needsJustification} privileged or conflicting account(s) as appropriate`);
            }
        }
        const previous = await prisma_client_1.prisma.access_Review_Item.groupBy({
            by: ['decision'],
            where: { id: { in: ids }, run_id: runId },
            _count: { _all: true },
        });
        const result = await prisma_client_1.prisma.access_Review_Item.updateMany({
            where: { id: { in: ids }, run_id: runId },
            data: {
                decision: dto.decision,
                decision_note: resetting ? null : dto.note ?? null,
                decided_by_id: resetting ? null : actor.id,
                decided_at: resetting ? null : new Date(),
            },
        });
        logger_util_1.logger.info('Access review decisions recorded', { runId, actorId: actor.id, decision: dto.decision, count: result.count });
        audit_log_service_1.auditLogService.logAsync({
            userId: actor.id,
            action: 'system_audit.access_review.decide',
            module: 'system-audit',
            entityType: 'system_audit_run',
            entityId: runId,
            oldValues: { decisions: Object.fromEntries(previous.map((row) => [row.decision, row._count._all])) },
            newValues: { count: ids.length, decision: dto.decision, note: dto.note, itemIds: ids },
        });
        return { updated: result.count };
    }
    async exportItems(runId, format, actor) {
        await this._assertAccessReview(runId, actor);
        const run = await prisma_client_1.prisma.system_Audit_Run.findUniqueOrThrow({ where: { id: runId }, select: { reference: true } });
        const items = (await prisma_client_1.prisma.access_Review_Item.findMany({
            where: { run_id: runId },
            include: prisma_types_1.accessReviewItemInclude,
            orderBy: [{ is_privileged: 'desc' }, { account_id: 'asc' }],
            take: tabular_export_util_1.EXPORT_MAX_ROWS,
        })).map(access_review_response_dto_1.mapAccessItemToResponse);
        audit_log_service_1.auditLogService.logAsync({
            userId: actor.id,
            action: 'system_audit.access_review.export',
            module: 'system-audit',
            entityType: 'system_audit_run',
            entityId: runId,
            newValues: { format, count: items.length },
        });
        return (0, tabular_export_util_1.buildTabularExport)(items, [
            { header: 'Account', value: (i) => i.accountId },
            { header: 'Name', value: (i) => i.displayName },
            { header: 'Email', value: (i) => i.email },
            { header: 'Department', value: (i) => i.department },
            { header: 'Status', value: (i) => i.accountStatus },
            { header: 'Privileged', value: (i) => (i.isPrivileged ? 'Yes' : 'No') },
            { header: 'Last login', value: (i) => i.lastLoginAt },
            { header: 'Access', value: (i) => i.entitlements.join('; ') },
            { header: 'Flags', value: (i) => i.flags.join('; ') },
            { header: 'Decision', value: (i) => i.decision },
            { header: 'Decision note', value: (i) => i.decisionNote },
            { header: 'Decided by', value: (i) => i.decidedBy?.name },
            { header: 'Decided on', value: (i) => i.decidedAt },
        ], { baseName: `${run.reference}-access-review`, format, sheetName: 'Access review' });
    }
    async _assertAccessReview(runId, actor) {
        const run = await this.analyticsService.assertRunVisible(runId, actor);
        if (run.analysisType !== system_audit_enum_1.AnalysisType.AccessListing) {
            throw app_error_1.AppError.badRequest('This analysis is not a user access review');
        }
        return run;
    }
}
exports.AccessReviewService = AccessReviewService;
//# sourceMappingURL=access-review.service.js.map