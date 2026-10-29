import { prisma } from '../../../../../shared/prisma/prisma.client';
import { AppError } from '../../../../../shared/errors/app.error';
import { logger } from '../../../../../shared/utils/logger.util';
import { auditLogService } from '../../../../logging/service/implementation/audit-log.service';
import { ActorContext, ChecklistProgress } from '../../../domain/entity/audit.entity';
import { AuditType, ChecklistResult } from '../../../domain/enum/audit.enum';
import { assertHasPermission, emptyChecklistProgress } from '../../../utility/audit.utility';
import { assertCanViewInternalArtifacts, repositoryEngagementScope } from '../../../engagement/utility/engagement-visibility.util';
import {
  ChecklistTemplateControl,
  getChecklistTemplateConfig,
  getEngagementControls,
  parseChecklistTemplateSnapshot,
  setChecklistTemplateConfig,
} from '../../../utility/audit-config.utility';
import {
  BulkCreateChecklistItemsRequestDto,
  CreateChecklistItemRequestDto,
  ImportDocumentChecklistsDto,
  ImportFrameworkChecklistsRequestDto,
  UpdateChecklistItemRequestDto,
  UpdateChecklistTemplatesRequestDto,
} from '../../dto/request/checklist.request.dto';
import { ChecklistResponseDto, mapChecklistToResponse } from '../../dto/response/checklist.response.dto';
import { IChecklistService } from '../interface/checklist.service.interface';
import { reconcileEngagementStatus } from '../../../engagement/service/implementation/engagement-status.reconciler';
import {
  deriveFrameworkMetaFromFilename,
  extractControlsFromDocument,
} from '../../../compliance/utility/document-control-extractor.utility';

export class ChecklistService implements IChecklistService {
  async populateChecklists(engagementId: string, actorId: string): Promise<void> {
    const engagement = await prisma.audit_Engagement.findFirst({
      where: { id: engagementId, deleted_at: null },
      select: { id: true, audit_type: true, checklist_template: true },
    });
    if (!engagement) throw AppError.notFound('Audit engagement');

    const existing = await prisma.audit_Checklist.count({ where: { engagement_id: engagementId } });
    if (existing > 0) return;

    const auditType = engagement.audit_type as AuditType;
    // Prefer the engagement's own checklist snapshot (chosen at creation); fall
    // back to the global per-audit-type control set when none was customised.
    const controls =
      parseChecklistTemplateSnapshot(engagement.checklist_template) ??
      (await getEngagementControls(auditType));
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
    if (
      !actor.permissions.includes('*') &&
      !actor.permissions.includes('checklist:create') &&
      !actor.permissions.includes('checklist:update') &&
      !actor.permissions.includes('engagement:create')
    ) {
      assertHasPermission(actor.permissions, 'checklist:create');
    }
    await this._assertEngagementTeam(engagementId, actor);

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

  async bulkCreateChecklistItems(
    engagementId: string,
    dto: BulkCreateChecklistItemsRequestDto,
    actor: ActorContext,
  ): Promise<{ addedCount: number; items: ChecklistResponseDto[] }> {
    await this._assertEngagementTeam(engagementId, actor);

    const engagement = await prisma.audit_Engagement.findFirst({
      where: { id: engagementId, deleted_at: null },
      select: { id: true, audit_type: true },
    });
    if (!engagement) throw AppError.notFound('Audit engagement');

    const existingRefs = new Set(
      (
        await prisma.audit_Checklist.findMany({
          where: { engagement_id: engagementId },
          select: { control_reference: true },
        })
      ).map((r) => r.control_reference.toUpperCase()),
    );

    const createdItems: ChecklistResponseDto[] = [];
    for (const ctrl of dto.controls) {
      const ref = ctrl.controlReference.trim().slice(0, 200);
      if (!ref || existingRefs.has(ref.toUpperCase())) continue;
      existingRefs.add(ref.toUpperCase());

      const item = await prisma.audit_Checklist.create({
        data: {
          engagement_id: engagementId,
          audit_type: ctrl.auditType?.trim() || engagement.audit_type,
          control_reference: ref,
          control_description: ctrl.controlDescription.trim(),
          test_procedure: ctrl.testProcedure.trim(),
        },
      });
      createdItems.push(mapChecklistToResponse(item));
    }

    logger.info('Bulk checklist items added to engagement', {
      engagementId,
      addedCount: createdItems.length,
      actorId: actor.id,
    });

    return { addedCount: createdItems.length, items: createdItems };
  }

  async importFrameworkControls(
    engagementId: string,
    dto: ImportFrameworkChecklistsRequestDto,
    actor: ActorContext,
  ): Promise<{ addedCount: number; items: ChecklistResponseDto[] }> {
    await this._assertEngagementTeam(engagementId, actor);

    const engagement = await prisma.audit_Engagement.findFirst({
      where: { id: engagementId, deleted_at: null },
      select: { id: true, audit_type: true },
    });
    if (!engagement) throw AppError.notFound('Audit engagement');

    const controls = await prisma.compliance_Control.findMany({
      where: {
        framework_id: { in: dto.frameworkIds },
        is_active: true,
        deleted_at: null,
      },
      orderBy: { control_reference: 'asc' },
    });

    if (controls.length === 0) {
      return { addedCount: 0, items: [] };
    }

    return this.bulkCreateChecklistItems(
      engagementId,
      {
        controls: controls.map((c) => ({
          controlReference: c.control_reference,
          controlDescription: c.control_description,
          testProcedure: c.test_procedure,
          auditType: dto.auditType || engagement.audit_type,
        })),
      },
      actor,
    );
  }

  async importDocumentControls(
    engagementId: string,
    file: { buffer: Buffer; mimetype: string; originalname: string } | undefined,
    dto: ImportDocumentChecklistsDto,
    actor: ActorContext,
  ): Promise<{ addedCount: number; items: ChecklistResponseDto[]; frameworkId?: string }> {
    await this._assertEngagementTeam(engagementId, actor);

    const engagement = await prisma.audit_Engagement.findFirst({
      where: { id: engagementId, deleted_at: null },
      select: { id: true, audit_type: true },
    });
    if (!engagement) throw AppError.notFound('Audit engagement');

    let extractedControls = Array.isArray(dto.controls)
      ? dto.controls
          .map((c) => ({
            controlReference: String(c.controlReference ?? '').trim(),
            controlDescription: String(c.controlDescription ?? '').trim(),
            testProcedure: String(c.testProcedure ?? '').trim(),
          }))
          .filter((c) => c.controlReference && c.controlDescription && c.testProcedure)
      : [];

    let suggestedCode = dto.frameworkCode?.trim() || '';
    let suggestedName = dto.frameworkName?.trim() || '';

    if (file && file.buffer) {
      const extracted = await extractControlsFromDocument(
        file.buffer,
        file.mimetype,
        file.originalname,
        dto.prefix || dto.frameworkCode,
      );
      if (!suggestedCode) suggestedCode = extracted.suggestedCode;
      if (!suggestedName) suggestedName = extracted.suggestedName;
      if (extractedControls.length === 0) {
        extractedControls = extracted.controls;
      }
    } else if (!suggestedCode || !suggestedName) {
      const derived = deriveFrameworkMetaFromFilename(dto.frameworkName || 'Policy Document', dto.prefix || dto.frameworkCode);
      if (!suggestedCode) suggestedCode = derived.suggestedCode;
      if (!suggestedName) suggestedName = derived.suggestedName;
    }

    if (extractedControls.length === 0) {
      throw AppError.badRequest('No controls could be extracted from the uploaded document');
    }

    const auditType = dto.auditType?.trim() || engagement.audit_type;
    const bulkResult = await this.bulkCreateChecklistItems(
      engagementId,
      {
        controls: extractedControls.map((c) => ({
          ...c,
          auditType,
        })),
      },
      actor,
    );

    let savedFrameworkId: string | undefined;
    if (dto.saveToLibrary) {
      const code = (dto.frameworkCode?.trim() || suggestedCode || 'DOC-001')
        .replace(/[^A-Za-z0-9.\-]/g, '-')
        .slice(0, 40);
      const name = (dto.frameworkName?.trim() || suggestedName || code).slice(0, 160);
      const category = (dto.category?.trim() || 'regulatory').slice(0, 50);

      let framework = await prisma.compliance_Framework.findFirst({ where: { code } });
      if (framework) {
        framework = await prisma.compliance_Framework.update({
          where: { id: framework.id },
          data: { is_active: true, deleted_at: null, name, category },
        });
      } else {
        framework = await prisma.compliance_Framework.create({
          data: {
            code,
            name,
            category,
            is_active: true,
            created_by_id: actor.id,
          },
        });
      }
      savedFrameworkId = framework.id;

      const existingLibRefs = new Set(
        (
          await prisma.compliance_Control.findMany({
            where: { framework_id: framework.id, deleted_at: null },
            select: { control_reference: true },
          })
        ).map((r) => r.control_reference.toUpperCase()),
      );

      for (const ctrl of extractedControls) {
        const ref = ctrl.controlReference.trim().slice(0, 80);
        if (!ref || existingLibRefs.has(ref.toUpperCase())) continue;
        existingLibRefs.add(ref.toUpperCase());

        await prisma.compliance_Control.create({
          data: {
            framework_id: framework.id,
            control_reference: ref,
            control_description: ctrl.controlDescription.trim(),
            test_procedure: ctrl.testProcedure.trim(),
            audit_type: auditType,
            is_active: true,
            created_by_id: actor.id,
          },
        });
      }
    }

    return {
      addedCount: bulkResult.addedCount,
      items: bulkResult.items,
      frameworkId: savedFrameworkId,
    };
  }

  async updateChecklistItem(id: string, dto: UpdateChecklistItemRequestDto, actor: ActorContext): Promise<ChecklistResponseDto> {
    assertHasPermission(actor.permissions, 'checklist:update');
    const existing = await this._getChecklistEngagement(id);
    await this._assertEngagementTeam(existing.engagement_id, actor);
    const before = await prisma.audit_Checklist.findUnique({ where: { id } });

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
      oldValues: before ? { controlReference: before.control_reference, result: before.result, notes: before.notes } : undefined,
      newValues: { controlReference: item.control_reference, result: item.result, notes: item.notes },
    });

    // A tested control may complete the fieldwork gate — let the engagement advance
    // itself. Reconcile is forward-only + idempotent with an hourly backstop job, so
    // we don't block the test response on it (a full reconcile is several queries and,
    // over a remote DB, was the bulk of the per-test latency).
    // ponytail: fire-and-forget; BG:AUDIT:RECONCILE:STATUS:HOURLY backstops any miss.
    void reconcileEngagementStatus(item.engagement_id, actor.id).catch((err) =>
      logger.warn('Post-checklist reconcile failed (will retry hourly)', {
        engagementId: item.engagement_id,
        err,
      }),
    );

    return mapChecklistToResponse(item);
  }

  async linkEvidenceToChecklistItem(checklistItemId: string, evidenceId: string, actor: ActorContext): Promise<ChecklistResponseDto> {
    assertHasPermission(actor.permissions, 'checklist:update');

    const checklist = await prisma.audit_Checklist.findUnique({
      where: { id: checklistItemId },
      select: { engagement_id: true },
    });
    if (!checklist) throw AppError.notFound('Audit checklist item');
    await this._assertEngagementTeam(checklist.engagement_id, actor);

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

  async getChecklists(engagementId: string, actor: ActorContext): Promise<Record<string, ChecklistResponseDto[]>> {
    await assertCanViewInternalArtifacts(engagementId, actor);
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

  async getChecklistTemplates(): Promise<Record<AuditType, ChecklistTemplateControl[]>> {
    return getChecklistTemplateConfig();
  }

  async previewControlsForAuditType(auditType: AuditType): Promise<ChecklistTemplateControl[]> {
    if (!Object.values(AuditType).includes(auditType)) {
      throw AppError.badRequest('Invalid audit type');
    }
    return getEngagementControls(auditType);
  }

  async updateChecklistTemplates(
    dto: UpdateChecklistTemplatesRequestDto,
    actor: ActorContext,
  ): Promise<Record<AuditType, ChecklistTemplateControl[]>> {
    assertHasPermission(actor.permissions, 'settings:manage');
    const result = await setChecklistTemplateConfig(dto.templates, actor.id);
    auditLogService.logAsync({
      userId: actor.id,
      action: 'audit.checklist.templates.update',
      module: 'audit',
      entityType: 'system_config',
      entityId: 'checklist_templates',
    });
    return result;
  }

  private async _getChecklistEngagement(id: string): Promise<{ engagement_id: string }> {
    const item = await prisma.audit_Checklist.findUnique({ where: { id }, select: { engagement_id: true } });
    if (!item) throw AppError.notFound('Audit checklist item');
    return item;
  }

  /**
   * Checklist writes are limited to the engagement's audit team (lead, manager, assignee)
   * and oversight (`engagement:read_all`), so holding `checklist:*` alone can't touch
   * another engagement's tests. Reported as not-found so existence isn't revealed.
   */
  private async _assertEngagementTeam(engagementId: string, actor: ActorContext): Promise<void> {
    const scope = repositoryEngagementScope(actor);
    if (!scope) return;
    const allowed = await prisma.audit_Engagement.count({
      where: { id: engagementId, deleted_at: null, ...scope },
    });
    if (allowed === 0) throw AppError.notFound('Audit engagement');
  }
}
