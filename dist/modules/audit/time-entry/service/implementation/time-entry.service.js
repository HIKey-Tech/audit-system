"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TimeEntryService = void 0;
const prisma_client_1 = require("../../../../../shared/prisma/prisma.client");
const app_error_1 = require("../../../../../shared/errors/app.error");
const logger_util_1 = require("../../../../../shared/utils/logger.util");
const audit_log_service_1 = require("../../../../logging/service/implementation/audit-log.service");
const audit_enum_1 = require("../../../domain/enum/audit.enum");
const engagement_visibility_util_1 = require("../../../engagement/utility/engagement-visibility.util");
const time_entry_response_dto_1 = require("../../dto/response/time-entry.response.dto");
class TimeEntryService {
    async logTime(engagementId, dto, actor) {
        const engagement = await this._getEngagement(engagementId);
        if (engagement.status === audit_enum_1.EngagementStatus.Closed) {
            throw app_error_1.AppError.badRequest('Time cannot be logged on a closed engagement');
        }
        await this._assertIsTeamOrOversight(engagementId, engagement, actor);
        const entry = await prisma_client_1.prisma.audit_Time_Entry.create({
            data: {
                engagement_id: engagementId,
                user_id: actor.id,
                entry_date: dto.entryDate,
                hours: dto.hours,
                description: dto.description,
            },
            include: time_entry_response_dto_1.timeEntryInclude,
        });
        logger_util_1.logger.info('Time entry logged', { entryId: entry.id, engagementId, actorId: actor.id, hours: dto.hours });
        audit_log_service_1.auditLogService.logAsync({ userId: actor.id, action: 'audit.time_entry.create', module: 'audit', entityType: 'audit_time_entry', entityId: entry.id });
        return (0, time_entry_response_dto_1.mapTimeEntryToResponse)(entry);
    }
    async listForEngagement(engagementId, actor) {
        const engagement = await this._getEngagement(engagementId);
        // Hours are internal audit-team material — auditees never see them.
        await this._assertIsTeamOrOversight(engagementId, engagement, actor);
        const entries = await prisma_client_1.prisma.audit_Time_Entry.findMany({
            where: { engagement_id: engagementId, deleted_at: null },
            include: time_entry_response_dto_1.timeEntryInclude,
            orderBy: [{ entry_date: 'desc' }, { created_at: 'desc' }],
        });
        const mapped = entries.map(time_entry_response_dto_1.mapTimeEntryToResponse);
        const byUserMap = new Map();
        for (const entry of mapped) {
            const existing = byUserMap.get(entry.userId);
            if (existing)
                existing.hours += entry.hours;
            else
                byUserMap.set(entry.userId, { userId: entry.userId, userName: entry.userName, hours: entry.hours });
        }
        return {
            plannedHours: engagement.planned_hours,
            totalHours: mapped.reduce((sum, entry) => sum + entry.hours, 0),
            byUser: Array.from(byUserMap.values()).sort((a, b) => b.hours - a.hours),
            entries: mapped,
        };
    }
    async deleteEntry(entryId, actor) {
        const entry = await prisma_client_1.prisma.audit_Time_Entry.findFirst({
            where: { id: entryId, deleted_at: null },
            select: { id: true, user_id: true, engagement_id: true },
        });
        if (!entry)
            throw app_error_1.AppError.notFound('Time entry');
        if (entry.user_id !== actor.id && !actor.permissions.includes('engagement:read_all')) {
            throw app_error_1.AppError.forbidden('You can only delete your own time entries');
        }
        await prisma_client_1.prisma.audit_Time_Entry.update({
            where: { id: entryId },
            data: { deleted_at: new Date() },
        });
        logger_util_1.logger.info('Time entry deleted', { entryId, engagementId: entry.engagement_id, actorId: actor.id });
        audit_log_service_1.auditLogService.logAsync({ userId: actor.id, action: 'audit.time_entry.delete', module: 'audit', entityType: 'audit_time_entry', entityId: entryId });
    }
    async _getEngagement(engagementId) {
        const engagement = await prisma_client_1.prisma.audit_Engagement.findFirst({
            where: { id: engagementId, deleted_at: null },
            select: {
                id: true,
                status: true,
                planned_hours: true,
                lead_auditor_id: true,
                audit_manager_id: true,
                auditee_id: true,
            },
        });
        if (!engagement)
            throw app_error_1.AppError.notFound('Audit engagement');
        return engagement;
    }
    async _assertIsTeamOrOversight(engagementId, parties, actor) {
        const viewer = await (0, engagement_visibility_util_1.resolveViewerContext)(engagementId, parties, actor);
        if (viewer.role === 'auditee') {
            throw app_error_1.AppError.forbidden('Only the engagement audit team can access time entries');
        }
    }
}
exports.TimeEntryService = TimeEntryService;
//# sourceMappingURL=time-entry.service.js.map