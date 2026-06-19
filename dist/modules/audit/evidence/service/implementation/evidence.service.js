"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EvidenceService = void 0;
const prisma_client_1 = require("../../../../../shared/prisma/prisma.client");
const app_error_1 = require("../../../../../shared/errors/app.error");
const logger_util_1 = require("../../../../../shared/utils/logger.util");
const api_response_type_1 = require("../../../../../shared/types/api-response.type");
const audit_log_service_1 = require("../../../../logging/service/implementation/audit-log.service");
const audit_enum_1 = require("../../../domain/enum/audit.enum");
const audit_utility_1 = require("../../../utility/audit.utility");
const engagement_visibility_util_1 = require("../../../engagement/utility/engagement-visibility.util");
const evidence_response_dto_1 = require("../../dto/response/evidence.response.dto");
class EvidenceService {
    documentService;
    constructor(documentService) {
        this.documentService = documentService;
    }
    async uploadEvidence(engagementId, file, actor) {
        (0, audit_utility_1.assertHasPermission)(actor.permissions, 'evidence:upload');
        await this._assertEngagementInProgress(engagementId);
        if (file.workingPaperId) {
            await this._assertWorkingPaperInEngagement(file.workingPaperId, engagementId);
        }
        if (file.findingId) {
            await this._assertFindingInEngagement(file.findingId, engagementId);
        }
        const document = await this.documentService.upload({
            uploadedById: actor.id,
            originalName: file.originalName,
            mimeType: file.mimeType,
            fileSize: file.fileSize,
            buffer: file.buffer,
            module: 'audit',
            entityType: 'audit_engagement',
            entityId: engagementId,
        });
        const evidence = await prisma_client_1.prisma.audit_Evidence.create({
            data: {
                engagement_id: engagementId,
                working_paper_id: file.workingPaperId,
                finding_id: file.findingId,
                document_id: document.id,
                file_name: file.originalName,
                file_type: file.mimeType,
                uploaded_by_id: actor.id,
            },
        });
        logger_util_1.logger.info('Audit evidence uploaded', { evidenceId: evidence.id, engagementId, actorId: actor.id });
        audit_log_service_1.auditLogService.logAsync({ userId: actor.id, action: 'audit.evidence.upload', module: 'audit', entityType: 'audit_evidence', entityId: evidence.id });
        return (0, evidence_response_dto_1.mapEvidenceToResponse)(evidence);
    }
    async linkToWorkingPaper(evidenceId, workingPaperId, actor) {
        (0, audit_utility_1.assertHasPermission)(actor.permissions, 'evidence:upload');
        const evidence = await this._getEvidence(evidenceId);
        const paper = await prisma_client_1.prisma.audit_Working_Paper.findFirst({
            where: { id: workingPaperId, deleted_at: null },
            select: { engagement_id: true },
        });
        if (!paper)
            throw app_error_1.AppError.notFound('Audit working paper');
        if (paper.engagement_id !== evidence.engagement_id)
            throw app_error_1.AppError.badRequest('Evidence and working paper must belong to the same engagement');
        const updated = await prisma_client_1.prisma.audit_Evidence.update({ where: { id: evidenceId }, data: { working_paper_id: workingPaperId } });
        logger_util_1.logger.info('Evidence linked to working paper', { evidenceId, workingPaperId, actorId: actor.id });
        audit_log_service_1.auditLogService.logAsync({ userId: actor.id, action: 'audit.evidence.link_working_paper', module: 'audit', entityType: 'audit_evidence', entityId: evidenceId, newValues: { workingPaperId } });
        return (0, evidence_response_dto_1.mapEvidenceToResponse)(updated);
    }
    async linkToFinding(evidenceId, findingId, actor) {
        (0, audit_utility_1.assertHasPermission)(actor.permissions, 'evidence:upload');
        const evidence = await this._getEvidence(evidenceId);
        const finding = await prisma_client_1.prisma.audit_Finding.findFirst({
            where: { id: findingId, deleted_at: null },
            select: { engagement_id: true },
        });
        if (!finding)
            throw app_error_1.AppError.notFound('Audit finding');
        if (finding.engagement_id !== evidence.engagement_id)
            throw app_error_1.AppError.badRequest('Evidence and finding must belong to the same engagement');
        const updated = await prisma_client_1.prisma.audit_Evidence.update({ where: { id: evidenceId }, data: { finding_id: findingId } });
        logger_util_1.logger.info('Evidence linked to finding', { evidenceId, findingId, actorId: actor.id });
        audit_log_service_1.auditLogService.logAsync({ userId: actor.id, action: 'audit.evidence.link_finding', module: 'audit', entityType: 'audit_evidence', entityId: evidenceId, newValues: { findingId } });
        return (0, evidence_response_dto_1.mapEvidenceToResponse)(updated);
    }
    async disputeEvidence(evidenceId, reason, actor) {
        (0, audit_utility_1.assertHasPermission)(actor.permissions, 'evidence:dispute');
        await this._getEvidence(evidenceId);
        const updated = await prisma_client_1.prisma.audit_Evidence.update({
            where: { id: evidenceId },
            data: { is_disputed: true, dispute_reason: reason },
        });
        logger_util_1.logger.info('Evidence disputed', { evidenceId, actorId: actor.id });
        audit_log_service_1.auditLogService.logAsync({ userId: actor.id, action: 'audit.evidence.dispute', module: 'audit', entityType: 'audit_evidence', entityId: evidenceId, newValues: { reason } });
        return (0, evidence_response_dto_1.mapEvidenceToResponse)(updated);
    }
    async listEvidence(engagementId, query, actor) {
        await (0, engagement_visibility_util_1.assertCanViewInternalArtifacts)(engagementId, actor);
        const evidence = await prisma_client_1.prisma.audit_Evidence.findMany({
            where: {
                engagement_id: engagementId,
                ...(query.workingPaperId && { working_paper_id: query.workingPaperId }),
                ...(query.findingId && { finding_id: query.findingId }),
            },
            orderBy: { uploaded_at: 'desc' },
        });
        return evidence.map(evidence_response_dto_1.mapEvidenceToResponse);
    }
    // ──────────── Centralized evidence repository (cross-engagement) ────────────
    async listRepository(query, actor) {
        (0, audit_utility_1.assertHasPermission)(actor.permissions, 'evidence:read');
        const { skip, take, page, pageSize } = (0, api_response_type_1.parsePagination)(query);
        const where = {
            engagement: { deleted_at: null },
            ...(query.engagementId && { engagement_id: query.engagementId }),
            ...(query.findingId && { finding_id: query.findingId }),
            ...(query.workingPaperId && { working_paper_id: query.workingPaperId }),
            ...(query.uploadedById && { uploaded_by_id: query.uploadedById }),
            ...(query.fileType && { file_type: query.fileType }),
            ...(query.isDisputed !== undefined && { is_disputed: query.isDisputed }),
            ...((query.uploadedFrom || query.uploadedTo) && {
                uploaded_at: {
                    ...(query.uploadedFrom && { gte: query.uploadedFrom }),
                    ...(query.uploadedTo && { lte: query.uploadedTo }),
                },
            }),
            ...(query.search && {
                OR: [
                    { file_name: { contains: query.search } },
                    { engagement: { is: { reference_number: { contains: query.search } } } },
                    { engagement: { is: { title: { contains: query.search } } } },
                ],
            }),
        };
        const [rows, total] = await prisma_client_1.prisma.$transaction([
            prisma_client_1.prisma.audit_Evidence.findMany({
                where,
                include: evidence_response_dto_1.evidenceRepositoryInclude,
                orderBy: { uploaded_at: 'desc' },
                skip,
                take,
            }),
            prisma_client_1.prisma.audit_Evidence.count({ where }),
        ]);
        return {
            evidence: rows.map(evidence_response_dto_1.mapEvidenceToRepositoryResponse),
            meta: (0, api_response_type_1.buildPaginationMeta)(total, page, pageSize),
        };
    }
    async getRepositoryEvidence(evidenceId, actor) {
        (0, audit_utility_1.assertHasPermission)(actor.permissions, 'evidence:read');
        const evidence = await prisma_client_1.prisma.audit_Evidence.findFirst({
            where: { id: evidenceId, engagement: { deleted_at: null } },
            include: evidence_response_dto_1.evidenceRepositoryInclude,
        });
        if (!evidence)
            throw app_error_1.AppError.notFound('Audit evidence');
        return (0, evidence_response_dto_1.mapEvidenceToRepositoryResponse)(evidence);
    }
    async getDownloadUrl(evidenceId, actor) {
        (0, audit_utility_1.assertHasPermission)(actor.permissions, 'evidence:read');
        const evidence = await this._getEvidence(evidenceId);
        const url = await this.documentService.getDownloadUrl(evidence.document_id);
        audit_log_service_1.auditLogService.logAsync({ userId: actor.id, action: 'audit.evidence.download', module: 'audit', entityType: 'audit_evidence', entityId: evidenceId });
        return url;
    }
    async _assertEngagementInProgress(engagementId) {
        const engagement = await prisma_client_1.prisma.audit_Engagement.findFirst({
            where: { id: engagementId, deleted_at: null },
            select: { status: true },
        });
        if (!engagement)
            throw app_error_1.AppError.notFound('Audit engagement');
        if (engagement.status !== audit_enum_1.EngagementStatus.InProgress)
            throw app_error_1.AppError.badRequest('Engagement must be in progress');
    }
    async _assertWorkingPaperInEngagement(workingPaperId, engagementId) {
        const paper = await prisma_client_1.prisma.audit_Working_Paper.findFirst({
            where: { id: workingPaperId, engagement_id: engagementId, deleted_at: null },
            select: { id: true },
        });
        if (!paper)
            throw app_error_1.AppError.badRequest('Working paper does not belong to this engagement');
    }
    async _assertFindingInEngagement(findingId, engagementId) {
        const finding = await prisma_client_1.prisma.audit_Finding.findFirst({
            where: { id: findingId, engagement_id: engagementId, deleted_at: null },
            select: { id: true },
        });
        if (!finding)
            throw app_error_1.AppError.badRequest('Finding does not belong to this engagement');
    }
    async _getEvidence(evidenceId) {
        const evidence = await prisma_client_1.prisma.audit_Evidence.findUnique({ where: { id: evidenceId } });
        if (!evidence)
            throw app_error_1.AppError.notFound('Audit evidence');
        return evidence;
    }
}
exports.EvidenceService = EvidenceService;
//# sourceMappingURL=evidence.service.js.map