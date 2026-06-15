"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ChecklistService = void 0;
const prisma_client_1 = require("../../../../../shared/prisma/prisma.client");
const app_error_1 = require("../../../../../shared/errors/app.error");
const logger_util_1 = require("../../../../../shared/utils/logger.util");
const audit_log_service_1 = require("../../../../logging/service/implementation/audit-log.service");
const audit_enum_1 = require("../../../domain/enum/audit.enum");
const audit_utility_1 = require("../../../utility/audit.utility");
const audit_config_utility_1 = require("../../../utility/audit-config.utility");
const checklist_response_dto_1 = require("../../dto/response/checklist.response.dto");
class ChecklistService {
    async populateChecklists(engagementId, actorId) {
        const engagement = await prisma_client_1.prisma.audit_Engagement.findFirst({
            where: { id: engagementId, deleted_at: null },
            select: { id: true, audit_type: true },
        });
        if (!engagement)
            throw app_error_1.AppError.notFound('Audit engagement');
        const existing = await prisma_client_1.prisma.audit_Checklist.count({ where: { engagement_id: engagementId } });
        if (existing > 0)
            return;
        const auditType = engagement.audit_type;
        const controls = await (0, audit_config_utility_1.getChecklistTemplateControls)(auditType);
        await prisma_client_1.prisma.audit_Checklist.createMany({
            data: controls.map((control) => ({
                engagement_id: engagementId,
                audit_type: auditType,
                control_reference: control.controlReference,
                control_description: control.controlDescription,
                test_procedure: control.testProcedure,
            })),
        });
        logger_util_1.logger.info('Audit checklists populated', { engagementId, actorId, count: controls.length });
        audit_log_service_1.auditLogService.logAsync({
            userId: actorId,
            action: 'audit.checklist.populate',
            module: 'audit',
            entityType: 'audit_engagement',
            entityId: engagementId,
            newValues: { count: controls.length },
        });
    }
    async createChecklistItem(engagementId, dto, actor) {
        (0, audit_utility_1.assertHasPermission)(actor.permissions, 'checklist:create');
        const engagement = await prisma_client_1.prisma.audit_Engagement.findFirst({
            where: { id: engagementId, deleted_at: null },
            select: { id: true, audit_type: true },
        });
        if (!engagement)
            throw app_error_1.AppError.notFound('Audit engagement');
        const item = await prisma_client_1.prisma.audit_Checklist.create({
            data: {
                engagement_id: engagementId,
                audit_type: dto.auditType ?? engagement.audit_type,
                control_reference: dto.controlReference,
                control_description: dto.controlDescription,
                test_procedure: dto.testProcedure,
            },
        });
        logger_util_1.logger.info('Audit checklist item created', { checklistItemId: item.id, engagementId, actorId: actor.id });
        audit_log_service_1.auditLogService.logAsync({
            userId: actor.id,
            action: 'audit.checklist.create',
            module: 'audit',
            entityType: 'audit_checklist',
            entityId: item.id,
            newValues: (0, checklist_response_dto_1.mapChecklistToResponse)(item),
        });
        return (0, checklist_response_dto_1.mapChecklistToResponse)(item);
    }
    async updateChecklistItem(id, dto, actor) {
        (0, audit_utility_1.assertHasPermission)(actor.permissions, 'checklist:update');
        await this._assertChecklistExists(id);
        const item = await prisma_client_1.prisma.audit_Checklist.update({
            where: { id },
            data: {
                result: dto.result,
                ...(dto.notes !== undefined && { notes: dto.notes }),
                tested_by_id: actor.id,
                tested_at: new Date(),
            },
        });
        logger_util_1.logger.info('Audit checklist item updated', { checklistItemId: id, actorId: actor.id });
        audit_log_service_1.auditLogService.logAsync({
            userId: actor.id,
            action: 'audit.checklist.update',
            module: 'audit',
            entityType: 'audit_checklist',
            entityId: id,
            newValues: (0, checklist_response_dto_1.mapChecklistToResponse)(item),
        });
        return (0, checklist_response_dto_1.mapChecklistToResponse)(item);
    }
    async linkEvidenceToChecklistItem(checklistItemId, evidenceId, actor) {
        (0, audit_utility_1.assertHasPermission)(actor.permissions, 'checklist:update');
        const checklist = await prisma_client_1.prisma.audit_Checklist.findUnique({
            where: { id: checklistItemId },
            select: { engagement_id: true },
        });
        if (!checklist)
            throw app_error_1.AppError.notFound('Audit checklist item');
        const evidence = await prisma_client_1.prisma.audit_Evidence.findUnique({
            where: { id: evidenceId },
            select: { engagement_id: true },
        });
        if (!evidence)
            throw app_error_1.AppError.notFound('Audit evidence');
        if (evidence.engagement_id !== checklist.engagement_id) {
            throw app_error_1.AppError.badRequest('Evidence and checklist item must belong to the same engagement');
        }
        const updated = await prisma_client_1.prisma.audit_Checklist.update({
            where: { id: checklistItemId },
            data: { evidence_id: evidenceId },
        });
        logger_util_1.logger.info('Evidence linked to checklist item', { checklistItemId, evidenceId, actorId: actor.id });
        audit_log_service_1.auditLogService.logAsync({
            userId: actor.id,
            action: 'audit.checklist.evidence.link',
            module: 'audit',
            entityType: 'audit_checklist',
            entityId: checklistItemId,
            newValues: { evidenceId },
        });
        return (0, checklist_response_dto_1.mapChecklistToResponse)(updated);
    }
    async getChecklists(engagementId) {
        const items = await prisma_client_1.prisma.audit_Checklist.findMany({
            where: { engagement_id: engagementId },
            orderBy: [{ audit_type: 'asc' }, { control_reference: 'asc' }],
        });
        return items.reduce((grouped, item) => {
            const key = item.audit_type;
            grouped[key] = grouped[key] ?? [];
            grouped[key].push((0, checklist_response_dto_1.mapChecklistToResponse)(item));
            return grouped;
        }, {});
    }
    async getChecklistProgress(engagementId) {
        const grouped = await prisma_client_1.prisma.audit_Checklist.groupBy({
            by: ['result'],
            where: { engagement_id: engagementId },
            _count: { _all: true },
        });
        const counts = (0, audit_utility_1.emptyChecklistProgress)();
        grouped.forEach((row) => {
            counts[row.result] = row._count._all;
        });
        return {
            passed: counts[audit_enum_1.ChecklistResult.Passed],
            failed: counts[audit_enum_1.ChecklistResult.Failed],
            notApplicable: counts[audit_enum_1.ChecklistResult.NotApplicable],
            notTested: counts[audit_enum_1.ChecklistResult.NotTested],
            total: grouped.reduce((sum, row) => sum + row._count._all, 0),
        };
    }
    async _assertChecklistExists(id) {
        const item = await prisma_client_1.prisma.audit_Checklist.findUnique({ where: { id }, select: { id: true } });
        if (!item)
            throw app_error_1.AppError.notFound('Audit checklist item');
    }
}
exports.ChecklistService = ChecklistService;
//# sourceMappingURL=checklist.service.js.map