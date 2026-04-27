"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FollowUpService = void 0;
const prisma_client_1 = require("../../../../../shared/prisma/prisma.client");
const app_error_1 = require("../../../../../shared/errors/app.error");
const logger_util_1 = require("../../../../../shared/utils/logger.util");
const audit_log_service_1 = require("../../../../logging/service/implementation/audit-log.service");
const notification_service_1 = require("../../../../messaging/service/implementation/notification.service");
const audit_enum_1 = require("../../../domain/enum/audit.enum");
const audit_utility_1 = require("../../../utility/audit.utility");
const follow_up_response_dto_1 = require("../../dto/response/follow-up.response.dto");
class FollowUpService {
    async createFollowUp(findingId) {
        const finding = await prisma_client_1.prisma.audit_Finding.findFirst({
            where: { id: findingId, deleted_at: null },
            select: { id: true },
        });
        if (!finding)
            throw app_error_1.AppError.notFound('Audit finding');
        const followUp = await prisma_client_1.prisma.audit_Follow_Up.upsert({
            where: { finding_id: findingId },
            create: { finding_id: findingId, verification_status: audit_enum_1.VerificationStatus.Pending },
            update: {},
        });
        audit_log_service_1.auditLogService.logAsync({
            action: 'audit.follow_up.create',
            module: 'audit',
            entityType: 'audit_follow_up',
            entityId: followUp.id,
            newValues: { findingId },
        });
        return (0, follow_up_response_dto_1.mapFollowUpToResponse)(followUp);
    }
    async submitManagementResponse(findingId, dto, actor) {
        const finding = await this._getFinding(findingId);
        if (finding.auditee_id !== actor.id)
            throw app_error_1.AppError.forbidden('Only the assigned auditee can submit a management response');
        const followUp = await prisma_client_1.prisma.$transaction(async (tx) => {
            await tx.audit_Finding.update({
                where: { id: findingId },
                data: { status: audit_enum_1.FindingStatus.ManagementResponseReceived },
            });
            return tx.audit_Follow_Up.upsert({
                where: { finding_id: findingId },
                create: {
                    finding_id: findingId,
                    management_response: dto.managementResponse,
                    management_response_by_id: actor.id,
                    management_response_at: new Date(),
                },
                update: {
                    management_response: dto.managementResponse,
                    management_response_by_id: actor.id,
                    management_response_at: new Date(),
                },
            });
        });
        logger_util_1.logger.info('Management response submitted', { findingId, actorId: actor.id });
        audit_log_service_1.auditLogService.logAsync({ userId: actor.id, action: 'audit.follow_up.response.submit', module: 'audit', entityType: 'audit_follow_up', entityId: followUp.id });
        return (0, follow_up_response_dto_1.mapFollowUpToResponse)(followUp);
    }
    async submitRemediationEvidence(findingId, evidenceId, actor) {
        const finding = await this._getFinding(findingId);
        if (finding.auditee_id !== actor.id)
            throw app_error_1.AppError.forbidden('Only the assigned auditee can submit remediation evidence');
        const evidence = await prisma_client_1.prisma.audit_Evidence.findUnique({
            where: { id: evidenceId },
            select: { engagement_id: true },
        });
        if (!evidence)
            throw app_error_1.AppError.notFound('Audit evidence');
        if (evidence.engagement_id !== finding.engagement_id)
            throw app_error_1.AppError.badRequest('Evidence must belong to the same engagement as the finding');
        const followUp = await prisma_client_1.prisma.$transaction(async (tx) => {
            await tx.audit_Finding.update({
                where: { id: findingId },
                data: { status: audit_enum_1.FindingStatus.InRemediation },
            });
            return tx.audit_Follow_Up.upsert({
                where: { finding_id: findingId },
                create: {
                    finding_id: findingId,
                    remediation_evidence_id: evidenceId,
                    verification_status: audit_enum_1.VerificationStatus.Pending,
                },
                update: {
                    remediation_evidence_id: evidenceId,
                    verification_status: audit_enum_1.VerificationStatus.Pending,
                },
            });
        });
        logger_util_1.logger.info('Remediation evidence submitted', { findingId, evidenceId, actorId: actor.id });
        audit_log_service_1.auditLogService.logAsync({ userId: actor.id, action: 'audit.follow_up.evidence.submit', module: 'audit', entityType: 'audit_follow_up', entityId: followUp.id, newValues: { evidenceId } });
        return (0, follow_up_response_dto_1.mapFollowUpToResponse)(followUp);
    }
    async verifyRemediation(findingId, dto, actor) {
        (0, audit_utility_1.assertHasRole)(actor.roles, audit_utility_1.AUDIT_REVIEW_ROLES);
        const finding = await this._getFinding(findingId);
        const followUp = await prisma_client_1.prisma.$transaction(async (tx) => {
            if (dto.verificationStatus === audit_enum_1.VerificationStatus.Verified) {
                await tx.audit_Finding.update({
                    where: { id: findingId },
                    data: { status: audit_enum_1.FindingStatus.Verified },
                });
            }
            return tx.audit_Follow_Up.update({
                where: { finding_id: findingId },
                data: {
                    verification_status: dto.verificationStatus,
                    verified_by_id: actor.id,
                    verified_at: new Date(),
                    verification_notes: dto.verificationNotes,
                },
            });
        });
        await notification_service_1.notificationService.sendInAppNotification({
            userId: finding.auditee_id,
            title: dto.verificationStatus === audit_enum_1.VerificationStatus.Verified ? 'Remediation verified' : 'Remediation rejected',
            body: dto.verificationStatus === audit_enum_1.VerificationStatus.Verified
                ? `Remediation for "${finding.title}" has been verified.`
                : `Remediation for "${finding.title}" was rejected. Please resubmit evidence.`,
            type: dto.verificationStatus === audit_enum_1.VerificationStatus.Verified ? 'success' : 'warning',
            referenceType: 'audit_finding',
            referenceId: findingId,
        });
        logger_util_1.logger.info('Remediation verification updated', { findingId, status: dto.verificationStatus, actorId: actor.id });
        audit_log_service_1.auditLogService.logAsync({ userId: actor.id, action: 'audit.follow_up.verify', module: 'audit', entityType: 'audit_follow_up', entityId: followUp.id, newValues: dto });
        return (0, follow_up_response_dto_1.mapFollowUpToResponse)(followUp);
    }
    async getFollowUp(findingId) {
        const followUp = await prisma_client_1.prisma.audit_Follow_Up.findUnique({
            where: { finding_id: findingId },
            include: { finding: true, remediation_evidence: true },
        });
        if (!followUp)
            throw app_error_1.AppError.notFound('Audit follow-up');
        return (0, follow_up_response_dto_1.mapFollowUpToResponse)(followUp);
    }
    async listPendingFollowUps(engagementId) {
        const followUps = await prisma_client_1.prisma.audit_Follow_Up.findMany({
            where: {
                finding: { engagement_id: engagementId, deleted_at: null },
                verification_status: { in: [audit_enum_1.VerificationStatus.Pending, audit_enum_1.VerificationStatus.Rejected] },
            },
            include: { finding: true, remediation_evidence: true },
            orderBy: { updated_at: 'desc' },
        });
        return followUps.map(follow_up_response_dto_1.mapFollowUpToResponse);
    }
    async _getFinding(findingId) {
        const finding = await prisma_client_1.prisma.audit_Finding.findFirst({
            where: { id: findingId, deleted_at: null },
            select: { id: true, engagement_id: true, auditee_id: true, title: true },
        });
        if (!finding)
            throw app_error_1.AppError.notFound('Audit finding');
        return finding;
    }
}
exports.FollowUpService = FollowUpService;
//# sourceMappingURL=follow-up.service.js.map