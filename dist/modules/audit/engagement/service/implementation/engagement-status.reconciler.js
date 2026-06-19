"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.reconcileEngagementForApprovalEntity = exports.reconcileEngagementStatus = void 0;
const prisma_client_1 = require("../../../../../shared/prisma/prisma.client");
const logger_util_1 = require("../../../../../shared/utils/logger.util");
const audit_log_service_1 = require("../../../../logging/service/implementation/audit-log.service");
const audit_enum_1 = require("../../../domain/enum/audit.enum");
const engagement_gates_1 = require("./engagement-gates");
/** Compute the immediate forward target if its gates are met, else null. Forward-only. */
const nextForwardStatus = async (status, engagementId) => {
    if (status === audit_enum_1.EngagementStatus.InProgress && (await (0, engagement_gates_1.canEnterUnderReview)(engagementId))) {
        return audit_enum_1.EngagementStatus.UnderReview;
    }
    if (status === audit_enum_1.EngagementStatus.UnderReview && (await (0, engagement_gates_1.canEnterReported)(engagementId))) {
        return audit_enum_1.EngagementStatus.Reported;
    }
    if (status === audit_enum_1.EngagementStatus.Reported && (await (0, engagement_gates_1.canClose)(engagementId))) {
        return audit_enum_1.EngagementStatus.Closed;
    }
    return null;
};
/**
 * Advance an engagement as far forward as its gates allow. Idempotent and safe to
 * call repeatedly. Never crosses the manual planned -> in_progress transition.
 * Mirrors the side effects of EngagementService.updateStatus for the transitions
 * it performs (actual_end_date + universe.last_audited_at on close).
 */
const reconcileEngagementStatus = async (engagementId, actorId) => {
    // Bounded loop: at most 3 forward hops (in_progress -> under_review -> reported -> closed).
    for (let hop = 0; hop < 3; hop += 1) {
        const engagement = await prisma_client_1.prisma.audit_Engagement.findFirst({
            where: { id: engagementId, deleted_at: null },
            select: { id: true, status: true, universe_id: true },
        });
        if (!engagement)
            return;
        const target = await nextForwardStatus(engagement.status, engagementId);
        if (!target)
            return;
        await prisma_client_1.prisma.$transaction(async (tx) => {
            await tx.audit_Engagement.update({
                where: { id: engagementId },
                data: {
                    status: target,
                    ...(target === audit_enum_1.EngagementStatus.Closed && { actual_end_date: new Date() }),
                },
            });
            if (target === audit_enum_1.EngagementStatus.Closed) {
                await tx.audit_Universe.update({
                    where: { id: engagement.universe_id },
                    data: { last_audited_at: new Date() },
                });
            }
        });
        logger_util_1.logger.info('Audit engagement auto-advanced', { engagementId, from: engagement.status, to: target, actorId });
        audit_log_service_1.auditLogService.logAsync({
            userId: actorId,
            action: 'audit.engagement.status.auto_advance',
            module: 'audit',
            entityType: 'audit_engagement',
            entityId: engagementId,
            newValues: { status: target, from: engagement.status },
        });
    }
};
exports.reconcileEngagementStatus = reconcileEngagementStatus;
/** Resolve the engagement behind a just-approved working paper / finding closure, then reconcile. */
const reconcileEngagementForApprovalEntity = async (entityType, entityId, actorId) => {
    let engagementId = null;
    if (entityType === 'audit_working_paper') {
        const wp = await prisma_client_1.prisma.audit_Working_Paper.findUnique({ where: { id: entityId }, select: { engagement_id: true } });
        engagementId = wp?.engagement_id ?? null;
    }
    else {
        const finding = await prisma_client_1.prisma.audit_Finding.findUnique({ where: { id: entityId }, select: { engagement_id: true } });
        engagementId = finding?.engagement_id ?? null;
    }
    if (engagementId)
        await (0, exports.reconcileEngagementStatus)(engagementId, actorId);
};
exports.reconcileEngagementForApprovalEntity = reconcileEngagementForApprovalEntity;
//# sourceMappingURL=engagement-status.reconciler.js.map