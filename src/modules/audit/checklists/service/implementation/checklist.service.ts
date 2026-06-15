import { prisma } from '../../../../../shared/prisma/prisma.client';
import { AppError } from '../../../../../shared/errors/app.error';
import { logger } from '../../../../../shared/utils/logger.util';
import { auditLogService } from '../../../../logging/service/implementation/audit-log.service';
import { ActorContext, ChecklistProgress } from '../../../domain/entity/audit.entity';
import { AuditType, ChecklistResult } from '../../../domain/enum/audit.enum';
import { assertHasPermission, emptyChecklistProgress } from '../../../utility/audit.utility';
import { getChecklistTemplateControls } from '../../../utility/audit-config.utility';
import { CreateChecklistItemRequestDto, UpdateChecklistItemRequestDto } from '../../dto/request/checklist.request.dto';
import { ChecklistResponseDto, mapChecklistToResponse } from '../../dto/response/checklist.response.dto';
import { IChecklistService } from '../interface/checklist.service.interface';

export class ChecklistService implements IChecklistService {
  async populateChecklists(engagementId: string, actorId: string): Promise<void> {
    const engagement = await prisma.audit_Engagement.findFirst({
      where: { id: engagementId, deleted_at: null },
      select: { id: true, audit_type: true },
    });
    if (!engagement) throw AppError.notFound('Audit engagement');

    const existing = await prisma.audit_Checklist.count({ where: { engagement_id: engagementId } });
    if (existing > 0) return;

    const auditType = engagement.audit_type as AuditType;
    const controls = await getChecklistTemplateControls(auditType);
    await prisma.audit_Checklist.createMany({
      data: controls.map((control) => ({
        engagement_id: engagementId,
        audit_type: auditType,
        control_reference: control.controlReference,
        control_description: control.controlDescription,
        test_procedure: control.testProcedure,
      })),
    });

    logger.info('Audit checklists populated', { engagementId, actorId, count: controls.length });
    auditLogService.logAsync({
      userId: actorId,
      action: 'audit.checklist.populate',
      module: 'audit',
      entityType: 'audit_engagement',
      entityId: engagementId,
      newValues: { count: controls.length },
    });
  }

  async createChecklistItem(engagementId: string, dto: CreateChecklistItemRequestDto, actor: ActorContext): Promise<ChecklistResponseDto> {
    assertHasPermission(actor.permissions, 'checklist:create');

    const engagement = await prisma.audit_Engagement.findFirst({
      where: { id: engagementId, deleted_at: null },
      select: { id: true, audit_type: true },
    });
    if (!engagement) throw AppError.notFound('Audit engagement');

    const item = await prisma.audit_Checklist.create({
      data: {
        engagement_id: engagementId,
        audit_type: dto.auditType ?? (engagement.audit_type as AuditType),
        control_reference: dto.controlReference,
        control_description: dto.controlDescription,
        test_procedure: dto.testProcedure,
      },
    });

    logger.info('Audit checklist item created', { checklistItemId: item.id, engagementId, actorId: actor.id });
    auditLogService.logAsync({
      userId: actor.id,
      action: 'audit.checklist.create',
      module: 'audit',
      entityType: 'audit_checklist',
      entityId: item.id,
      newValues: mapChecklistToResponse(item),
    });
    return mapChecklistToResponse(item);
  }

  async updateChecklistItem(id: string, dto: UpdateChecklistItemRequestDto, actor: ActorContext): Promise<ChecklistResponseDto> {
    assertHasPermission(actor.permissions, 'checklist:update');
    await this._assertChecklistExists(id);

    const item = await prisma.audit_Checklist.update({
      where: { id },
      data: {
        result: dto.result,
        ...(dto.notes !== undefined && { notes: dto.notes }),
        tested_by_id: actor.id,
        tested_at: new Date(),
      },
    });

    logger.info('Audit checklist item updated', { checklistItemId: id, actorId: actor.id });
    auditLogService.logAsync({
      userId: actor.id,
      action: 'audit.checklist.update',
      module: 'audit',
      entityType: 'audit_checklist',
      entityId: id,
      newValues: mapChecklistToResponse(item),
    });
    return mapChecklistToResponse(item);
  }

  async linkEvidenceToChecklistItem(checklistItemId: string, evidenceId: string, actor: ActorContext): Promise<ChecklistResponseDto> {
    assertHasPermission(actor.permissions, 'checklist:update');

    const checklist = await prisma.audit_Checklist.findUnique({
      where: { id: checklistItemId },
      select: { engagement_id: true },
    });
    if (!checklist) throw AppError.notFound('Audit checklist item');

    const evidence = await prisma.audit_Evidence.findUnique({
      where: { id: evidenceId },
      select: { engagement_id: true },
    });
    if (!evidence) throw AppError.notFound('Audit evidence');
    if (evidence.engagement_id !== checklist.engagement_id) {
      throw AppError.badRequest('Evidence and checklist item must belong to the same engagement');
    }

    const updated = await prisma.audit_Checklist.update({
      where: { id: checklistItemId },
      data: { evidence_id: evidenceId },
    });

    logger.info('Evidence linked to checklist item', { checklistItemId, evidenceId, actorId: actor.id });
    auditLogService.logAsync({
      userId: actor.id,
      action: 'audit.checklist.evidence.link',
      module: 'audit',
      entityType: 'audit_checklist',
      entityId: checklistItemId,
      newValues: { evidenceId },
    });
    return mapChecklistToResponse(updated);
  }

  async getChecklists(engagementId: string): Promise<Record<string, ChecklistResponseDto[]>> {
    const items = await prisma.audit_Checklist.findMany({
      where: { engagement_id: engagementId },
      orderBy: [{ audit_type: 'asc' }, { control_reference: 'asc' }],
    });

    return items.reduce<Record<string, ChecklistResponseDto[]>>((grouped, item) => {
      const key = item.audit_type;
      grouped[key] = grouped[key] ?? [];
      grouped[key].push(mapChecklistToResponse(item));
      return grouped;
    }, {});
  }

  async getChecklistProgress(engagementId: string): Promise<ChecklistProgress> {
    const grouped = await prisma.audit_Checklist.groupBy({
      by: ['result'],
      where: { engagement_id: engagementId },
      _count: { _all: true },
    });

    const counts = emptyChecklistProgress();
    grouped.forEach((row) => {
      counts[row.result as ChecklistResult] = row._count._all;
    });

    return {
      passed: counts[ChecklistResult.Passed],
      failed: counts[ChecklistResult.Failed],
      notApplicable: counts[ChecklistResult.NotApplicable],
      notTested: counts[ChecklistResult.NotTested],
      total: grouped.reduce((sum, row) => sum + row._count._all, 0),
    };
  }

  private async _assertChecklistExists(id: string): Promise<void> {
    const item = await prisma.audit_Checklist.findUnique({ where: { id }, select: { id: true } });
    if (!item) throw AppError.notFound('Audit checklist item');
  }
}
