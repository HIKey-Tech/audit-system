import { prisma } from '../../../../../shared/prisma/prisma.client';
import { AppError } from '../../../../../shared/errors/app.error';
import { logger } from '../../../../../shared/utils/logger.util';
import { auditLogService } from '../../../../logging/service/implementation/audit-log.service';
import { ActorContext } from '../../../domain/entity/audit.entity';
import { EngagementStatus } from '../../../domain/enum/audit.enum';
import { resolveViewerContext } from '../../../engagement/utility/engagement-visibility.util';
import { LogTimeEntryDto } from '../../dto/request/time-entry.request.dto';
import {
  EngagementTimeSummaryDto,
  TimeEntryResponseDto,
  mapTimeEntryToResponse,
  timeEntryInclude,
} from '../../dto/response/time-entry.response.dto';
import { ITimeEntryService } from '../interface/time-entry.service.interface';

export class TimeEntryService implements ITimeEntryService {
  async logTime(
    engagementId: string,
    dto: LogTimeEntryDto,
    actor: ActorContext,
  ): Promise<TimeEntryResponseDto> {
    const engagement = await this._getEngagement(engagementId);
    if (engagement.status === EngagementStatus.Closed) {
      throw AppError.badRequest('Time cannot be logged on a closed engagement');
    }
    await this._assertIsTeamOrOversight(engagementId, engagement, actor);

    const entry = await prisma.audit_Time_Entry.create({
      data: {
        engagement_id: engagementId,
        user_id: actor.id,
        entry_date: dto.entryDate,
        hours: dto.hours,
        description: dto.description,
      },
      include: timeEntryInclude,
    });

    logger.info('Time entry logged', { entryId: entry.id, engagementId, actorId: actor.id, hours: dto.hours });
    auditLogService.logAsync({ userId: actor.id, action: 'audit.time_entry.create', module: 'audit', entityType: 'audit_time_entry', entityId: entry.id });
    return mapTimeEntryToResponse(entry);
  }

  async listForEngagement(engagementId: string, actor: ActorContext): Promise<EngagementTimeSummaryDto> {
    const engagement = await this._getEngagement(engagementId);
    // Hours are internal audit-team material — auditees never see them.
    await this._assertIsTeamOrOversight(engagementId, engagement, actor);

    const entries = await prisma.audit_Time_Entry.findMany({
      where: { engagement_id: engagementId, deleted_at: null },
      include: timeEntryInclude,
      orderBy: [{ entry_date: 'desc' }, { created_at: 'desc' }],
    });

    const mapped = entries.map(mapTimeEntryToResponse);
    const byUserMap = new Map<string, { userId: string; userName: string; hours: number }>();
    for (const entry of mapped) {
      const existing = byUserMap.get(entry.userId);
      if (existing) existing.hours += entry.hours;
      else byUserMap.set(entry.userId, { userId: entry.userId, userName: entry.userName, hours: entry.hours });
    }

    return {
      plannedHours: engagement.planned_hours,
      totalHours: mapped.reduce((sum, entry) => sum + entry.hours, 0),
      byUser: Array.from(byUserMap.values()).sort((a, b) => b.hours - a.hours),
      entries: mapped,
    };
  }

  async deleteEntry(entryId: string, actor: ActorContext): Promise<void> {
    const entry = await prisma.audit_Time_Entry.findFirst({
      where: { id: entryId, deleted_at: null },
      select: { id: true, user_id: true, engagement_id: true },
    });
    if (!entry) throw AppError.notFound('Time entry');
    if (entry.user_id !== actor.id && !actor.permissions.includes('engagement:read_all')) {
      throw AppError.forbidden('You can only delete your own time entries');
    }

    await prisma.audit_Time_Entry.update({
      where: { id: entryId },
      data: { deleted_at: new Date() },
    });

    logger.info('Time entry deleted', { entryId, engagementId: entry.engagement_id, actorId: actor.id });
    auditLogService.logAsync({ userId: actor.id, action: 'audit.time_entry.delete', module: 'audit', entityType: 'audit_time_entry', entityId: entryId });
  }

  private async _getEngagement(engagementId: string): Promise<{
    id: string;
    status: string;
    planned_hours: number | null;
    lead_auditor_id: string;
    audit_manager_id: string;
    auditee_id: string;
  }> {
    const engagement = await prisma.audit_Engagement.findFirst({
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
    if (!engagement) throw AppError.notFound('Audit engagement');
    return engagement;
  }

  private async _assertIsTeamOrOversight(
    engagementId: string,
    parties: { lead_auditor_id: string; audit_manager_id: string; auditee_id: string },
    actor: ActorContext,
  ): Promise<void> {
    const viewer = await resolveViewerContext(engagementId, parties, actor);
    if (viewer.role === 'auditee') {
      throw AppError.forbidden('Only the engagement audit team can access time entries');
    }
  }
}
