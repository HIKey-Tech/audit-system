import { Prisma } from '@prisma/client';
import { prisma } from '../../../../../shared/prisma/prisma.client';
import { AppError } from '../../../../../shared/errors/app.error';
import { logger } from '../../../../../shared/utils/logger.util';
import { PaginationMeta, buildPaginationMeta, parsePagination } from '../../../../../shared/types/api-response.type';
import {
  EXPORT_MAX_ROWS,
  ExportFormat,
  TabularExportFile,
  buildTabularExport,
} from '../../../../../shared/utils/tabular-export.util';
import { auditLogService } from '../../../../logging/service/implementation/audit-log.service';
import { IApprovalService } from '../../../../workflow/approval/service/interface/approval.service.interface';
import { workflowApprovalService } from '../../../../workflow/approval/service/implementation/approval.service';
import { WorkflowEntityType } from '../../../../workflow/domain/enum/workflow.enum';
import { ActorContext } from '../../../domain/entity/audit.entity';
import { EngagementStatus, FindingStatus } from '../../../domain/enum/audit.enum';
import { FINDING_TRANSITIONS, assertHasPermission, assertTransition, isFindingAuditee, isFindingOversight } from '../../../utility/audit.utility';
import { resolveViewerContext } from '../../../engagement/utility/engagement-visibility.util';
import {
  CreateFindingRequestDto,
  FindingQueryDto,
  UpdateFindingRequestDto,
} from '../../dto/request/finding.request.dto';
import { FindingResponseDto, mapFindingToResponse } from '../../dto/response/finding.response.dto';
import { IFindingService } from '../interface/finding.service.interface';

const findingInclude = {
  engagement: { select: { reference_number: true } },
  checklist: { select: { control_reference: true, control_description: true } },
  risk: { select: { title: true } },
  auditee: { select: { display_name: true, first_name: true, last_name: true, email: true } },
  created_by: { select: { display_name: true, first_name: true, last_name: true, email: true } },
  responders: {
    select: {
      user_id: true,
      user: { select: { display_name: true, first_name: true, last_name: true, email: true } },
    },
  },
};

export class FindingService implements IFindingService {
  constructor(private readonly approvalService: IApprovalService = workflowApprovalService) {}

  async createFinding(engagementId: string, dto: CreateFindingRequestDto, actor: ActorContext): Promise<FindingResponseDto> {
    assertHasPermission(actor.permissions, 'finding:create');
    await this._assertEngagementAllowsFindings(engagementId);
    if (dto.workingPaperId) {
      await this._assertWorkingPaperInEngagement(dto.workingPaperId, engagementId);
    }
    if (dto.checklistId) {
      await this._assertChecklistInEngagement(dto.checklistId, engagementId);
    }
    if (dto.riskId) {
      await this._assertRiskExists(dto.riskId);
    }

    // Findings stay internal until the report is issued, so no auditee alert is sent here:
    // ReportService.issueReport notifies every responder once the report goes out.
    const finding = await prisma.$transaction(async (tx) => {
      const created = await tx.audit_Finding.create({
        data: {
          engagement_id: engagementId,
          working_paper_id: dto.workingPaperId,
          checklist_id: dto.checklistId,
          risk_id: dto.riskId,
          title: dto.title,
          description: dto.description,
          category: dto.category,
          severity: dto.severity,
          root_cause: dto.rootCause,
          risk_implication: dto.riskImplication,
          recommendation: dto.recommendation,
          auditee_id: dto.auditeeId,
          due_date: new Date(dto.dueDate),
          created_by_id: actor.id,
        },
        include: findingInclude,
      });

      // Co-responders: persist the join rows so a finding can be owned by several people.
      const extraIds = [...new Set(dto.additionalAuditeeIds ?? [])].filter((uid) => uid !== created.auditee_id);
      if (extraIds.length > 0) {
        await tx.audit_Finding_Responder.createMany({
          data: extraIds.map((uid) => ({ finding_id: created.id, user_id: uid })),
        });
      }

      return created;
    });

    logger.info('Audit finding created', { findingId: finding.id, engagementId, actorId: actor.id });
    auditLogService.logAsync({ userId: actor.id, action: 'audit.finding.create', module: 'audit', entityType: 'audit_finding', entityId: finding.id });
    return mapFindingToResponse(finding);
  }

  async updateFinding(id: string, dto: UpdateFindingRequestDto, actor: ActorContext): Promise<FindingResponseDto> {
    const finding = await this._getFinding(id);
    const canOverrideOwnership = actor.permissions.includes('finding:read_all');
    if (finding.created_by_id !== actor.id && !canOverrideOwnership) throw AppError.forbidden('Only the creator or an audit manager can update this finding');
    if (finding.status === FindingStatus.Closed) throw AppError.badRequest('Closed findings cannot be updated');
    if (dto.workingPaperId) {
      await this._assertWorkingPaperInEngagement(dto.workingPaperId, finding.engagement_id);
    }
    if (dto.checklistId) {
      await this._assertChecklistInEngagement(dto.checklistId, finding.engagement_id);
    }
    if (dto.riskId) {
      await this._assertRiskExists(dto.riskId);
    }

    const findingData: Prisma.Audit_FindingUncheckedUpdateInput = {
      ...(dto.workingPaperId !== undefined && { working_paper_id: dto.workingPaperId }),
      ...(dto.checklistId !== undefined && { checklist_id: dto.checklistId }),
      ...(dto.riskId !== undefined && { risk_id: dto.riskId }),
      ...(dto.title !== undefined && { title: dto.title }),
      ...(dto.description !== undefined && { description: dto.description }),
      ...(dto.category !== undefined && { category: dto.category }),
      ...(dto.severity !== undefined && { severity: dto.severity }),
      ...(dto.rootCause !== undefined && { root_cause: dto.rootCause }),
      ...(dto.riskImplication !== undefined && { risk_implication: dto.riskImplication }),
      ...(dto.recommendation !== undefined && { recommendation: dto.recommendation }),
      ...(dto.auditeeId !== undefined && { auditee_id: dto.auditeeId }),
      ...(dto.dueDate !== undefined && { due_date: new Date(dto.dueDate) }),
    };

    const updated = await prisma.$transaction(async (tx) => {
      const result = await tx.audit_Finding.update({ where: { id }, data: findingData, include: findingInclude });

      // Co-responders are replaced wholesale when the caller sends the array.
      if (dto.additionalAuditeeIds !== undefined) {
        const primaryId = dto.auditeeId ?? finding.auditee_id;
        const extraIds = [...new Set(dto.additionalAuditeeIds)].filter((uid) => uid !== primaryId);
        await tx.audit_Finding_Responder.deleteMany({ where: { finding_id: id } });
        if (extraIds.length > 0) {
          await tx.audit_Finding_Responder.createMany({
            data: extraIds.map((uid) => ({ finding_id: id, user_id: uid })),
          });
        }
        return tx.audit_Finding.findUniqueOrThrow({ where: { id }, include: findingInclude });
      }
      return result;
    });

    logger.info('Audit finding updated', { findingId: id, actorId: actor.id });
    auditLogService.logAsync({
      userId: actor.id,
      action: 'audit.finding.update',
      module: 'audit',
      entityType: 'audit_finding',
      entityId: id,
      oldValues: {
        title: finding.title, category: finding.category, severity: finding.severity,
        rootCause: finding.root_cause, riskImplication: finding.risk_implication,
        recommendation: finding.recommendation, auditeeId: finding.auditee_id,
        dueDate: finding.due_date,
      },
      newValues: {
        title: updated.title, category: updated.category, severity: updated.severity,
        rootCause: updated.root_cause, riskImplication: updated.risk_implication,
        recommendation: updated.recommendation, auditeeId: updated.auditee_id,
        dueDate: updated.due_date,
      },
    });
    return mapFindingToResponse(updated);
  }

  async updateFindingStatus(id: string, newStatus: FindingStatus, actor: ActorContext): Promise<FindingResponseDto> {
    assertHasPermission(actor.permissions, 'finding:update');
    const finding = await this._getFinding(id);
    assertTransition(finding.status as FindingStatus, newStatus, FINDING_TRANSITIONS, 'finding');

    // Each stage is normally reached by the work itself (response, evidence, verification), so a
    // manual change may only record a stage whose proof already exists.
    if (newStatus === FindingStatus.Verified) {
      throw AppError.badRequest('A finding can only be verified through the Verify action, which records verification notes');
    }
    const followUp = await prisma.audit_Follow_Up.findUnique({
      where: { finding_id: id },
      select: { management_response: true, remediation_evidence_id: true },
    });
    if (newStatus === FindingStatus.ManagementResponseReceived && !followUp?.management_response) {
      throw AppError.badRequest('A management response must be recorded before the finding can move to this stage');
    }
    if (newStatus === FindingStatus.InRemediation && !followUp?.remediation_evidence_id) {
      throw AppError.badRequest('Remediation evidence must be submitted before the finding can move to this stage');
    }

    const updated = await prisma.audit_Finding.update({
      where: { id },
      data: { status: newStatus },
    });

    logger.info('Audit finding status updated', { findingId: id, status: newStatus, actorId: actor.id });
    auditLogService.logAsync({ userId: actor.id, action: 'audit.finding.status.update', module: 'audit', entityType: 'audit_finding', entityId: id, oldValues: { status: finding.status }, newValues: { status: newStatus } });
    return mapFindingToResponse(updated);
  }

  async closeFinding(id: string, actor: ActorContext): Promise<FindingResponseDto> {
    assertHasPermission(actor.permissions, 'finding:close');
    const finding = await this._getFinding(id);
    if (finding.status !== FindingStatus.Verified) throw AppError.badRequest('Only verified findings can be closed');

    const { updated, approval } = await prisma.$transaction(async (tx) => {
      const updated = await tx.audit_Finding.update({
        where: { id },
        data: {
          status: FindingStatus.PendingClosure,
          closed_by_id: null,
          closed_at: null,
        },
        include: findingInclude,
      });

      const approval = await this.approvalService.createApproval({
        entityType: WorkflowEntityType.AuditFindingClosure,
        entityId: id,
      }, actor, tx);

      return { updated, approval };
    }, { timeout: 15000 });
    this.approvalService.queueApprovalRequiredNotification(approval);

    logger.info('Audit finding closure requested', { findingId: id, actorId: actor.id });
    auditLogService.logAsync({ userId: actor.id, action: 'audit.finding.close.request', module: 'audit', entityType: 'audit_finding', entityId: id });
    return mapFindingToResponse(updated);
  }

  async getFindingById(id: string, actor: ActorContext): Promise<FindingResponseDto> {
    const isAuditee = isFindingAuditee(actor.permissions);
    const finding = await prisma.audit_Finding.findFirst({
      where: {
        id,
        deleted_at: null,
        // An auditee only sees findings once the report is issued (engagement reported/closed),
        // matching the list endpoints.
        ...(isAuditee && {
          AND: [
            this._auditeeMatch(actor.id),
            { engagement: { status: { in: [EngagementStatus.Reported, EngagementStatus.Closed] } } },
          ],
        }),
      },
      include: {
        ...findingInclude,
        evidence: true,
        follow_up: { include: { remediation_evidence: true } },
      },
    });
    if (!finding) throw AppError.notFound('Audit finding');

    if (!isAuditee && !actor.permissions.includes('finding:read_all')) {
      const allowed = await prisma.audit_Engagement.count({
        where: {
          id: finding.engagement_id,
          deleted_at: null,
          OR: [
            { lead_auditor_id: actor.id },
            { audit_manager_id: actor.id },
            { workflow_assignments: { some: { user_id: actor.id } } },
          ],
        },
      }) > 0;
      if (!allowed) throw AppError.notFound('Audit finding');
    }

    return mapFindingToResponse(finding);
  }

  async listAllFindings(query: FindingQueryDto, actor: ActorContext): Promise<{ findings: FindingResponseDto[]; meta: PaginationMeta }> {
    const { skip, take, page, pageSize } = parsePagination(query);
    const where = this._buildFindingWhere(query, actor);

    const [total, findings] = await prisma.$transaction([
      prisma.audit_Finding.count({ where }),
      prisma.audit_Finding.findMany({
        where,
        include: findingInclude,
        orderBy: { [query.sortBy]: query.sortOrder },
        skip,
        take,
      }),
    ]);

    return {
      findings: findings.map(mapFindingToResponse),
      meta: buildPaginationMeta(total, page, pageSize),
    };
  }

  async exportFindings(query: FindingQueryDto, format: ExportFormat, actor: ActorContext): Promise<TabularExportFile> {
    const findings = await prisma.audit_Finding.findMany({
      where: this._buildFindingWhere(query, actor),
      include: findingInclude,
      orderBy: { [query.sortBy]: query.sortOrder },
      take: EXPORT_MAX_ROWS,
    });
    const rows = findings.map(mapFindingToResponse);

    logger.info('Findings register exported', { actorId: actor.id, format, count: rows.length });
    auditLogService.logAsync({
      userId: actor.id,
      action: 'audit.finding.export',
      module: 'audit',
      entityType: 'audit_finding',
      newValues: { format, count: rows.length, filters: query },
    });

    return buildTabularExport(
      rows,
      [
        { header: 'Engagement', value: (f) => f.engagementReference },
        { header: 'Title', value: (f) => f.title },
        { header: 'Severity', value: (f) => f.severity },
        { header: 'Status', value: (f) => f.status },
        { header: 'Category', value: (f) => f.category },
        { header: 'Control reference', value: (f) => f.controlReference },
        { header: 'Linked risk', value: (f) => f.riskTitle },
        { header: 'Description', value: (f) => f.description },
        { header: 'Root cause', value: (f) => f.rootCause },
        { header: 'Risk implication', value: (f) => f.riskImplication },
        { header: 'Recommendation', value: (f) => f.recommendation },
        { header: 'Auditee', value: (f) => f.auditeeName },
        { header: 'Due date', value: (f) => f.dueDate },
        { header: 'Raised by', value: (f) => f.createdByName },
        { header: 'Raised on', value: (f) => f.createdAt },
        { header: 'Closed on', value: (f) => f.closedAt },
      ],
      { baseName: 'findings-register', format, sheetName: 'Findings' },
    );
  }

  async listFindings(engagementId: string, query: FindingQueryDto, actor: ActorContext): Promise<FindingResponseDto[]> {
    const eng = await prisma.audit_Engagement.findFirst({
      where: { id: engagementId, deleted_at: null },
      select: { status: true, lead_auditor_id: true, audit_manager_id: true, auditee_id: true },
    });
    if (!eng) throw AppError.notFound('Audit engagement');
    const viewer = await resolveViewerContext(engagementId, eng, actor);

    // A pure auditee only sees findings once the report has been issued
    // (engagement is reported/closed); before that, findings are still draft/internal.
    const reportIssued = eng.status === EngagementStatus.Reported || eng.status === EngagementStatus.Closed;
    if (viewer.role === 'auditee' && !reportIssued) {
      return [];
    }

    const findings = await prisma.audit_Finding.findMany({
      where: {
        ...this._buildFindingWhere(query, actor),
        engagement_id: engagementId,
      },
      include: findingInclude,
      orderBy: { created_at: 'desc' },
    });
    return findings.map(mapFindingToResponse);
  }

  private _buildFindingWhere(query: FindingQueryDto, actor: ActorContext): Prisma.Audit_FindingWhereInput {
    const isOversight = isFindingOversight(actor.permissions);
    const isAuditee = isFindingAuditee(actor.permissions);

    // OR-based clauses are collected into AND so they never overwrite each other.
    const and: Prisma.Audit_FindingWhereInput[] = [];
    if (query.auditeeId) {
      and.push(this._auditeeMatch(query.auditeeId));
    }
    if (query.search) {
      and.push({
        OR: [
          { title: { contains: query.search } },
          { description: { contains: query.search } },
          { recommendation: { contains: query.search } },
        ],
      });
    }
    if (isAuditee) {
      // A responder sees a finding whether they are the primary auditee or a co-responder,
      // but — exactly like the engagement Findings tab — only once the engagement's report
      // has been issued (reported/closed). Before that, findings are draft/internal, so this
      // gate stops the standalone Findings page leaking pre-issue findings to the auditee.
      and.push(this._auditeeMatch(actor.id));
      and.push({
        engagement: { status: { in: [EngagementStatus.Reported, EngagementStatus.Closed] } },
      });
    } else if (!isOversight) {
      and.push({
        engagement: {
          OR: [
            { lead_auditor_id: actor.id },
            { workflow_assignments: { some: { user_id: actor.id } } },
          ],
        },
      });
    }

    return {
      deleted_at: null,
      ...(query.severity && { severity: query.severity }),
      ...(query.status && { status: query.status }),
      ...(query.category && { category: query.category }),
      ...(query.riskId && { risk_id: query.riskId }),
      ...(query.universeId && { engagement: { universe_id: query.universeId } }),
      ...(query.controlReference && {
        checklist: { control_reference: { contains: query.controlReference } },
      }),
      ...(and.length > 0 && { AND: and }),
    };
  }

  /** Matches findings where the given user is the primary auditee or a co-responder. */
  private _auditeeMatch(userId: string): Prisma.Audit_FindingWhereInput {
    return { OR: [{ auditee_id: userId }, { responders: { some: { user_id: userId } } }] };
  }

  private async _assertEngagementAllowsFindings(engagementId: string): Promise<void> {
    const engagement = await prisma.audit_Engagement.findFirst({
      where: { id: engagementId, deleted_at: null },
      select: { status: true },
    });
    if (!engagement) throw AppError.notFound('Audit engagement');
    if (![EngagementStatus.InProgress, EngagementStatus.UnderReview].includes(engagement.status as EngagementStatus)) {
      throw AppError.badRequest('Findings can only be created while an engagement is in progress or under review');
    }
  }

  private async _assertWorkingPaperInEngagement(workingPaperId: string, engagementId: string): Promise<void> {
    const paper = await prisma.audit_Working_Paper.findFirst({
      where: { id: workingPaperId, engagement_id: engagementId, deleted_at: null },
      select: { id: true },
    });
    if (!paper) throw AppError.badRequest('Working paper does not belong to this engagement');
  }

  private async _assertChecklistInEngagement(checklistId: string, engagementId: string): Promise<void> {
    const checklist = await prisma.audit_Checklist.findFirst({
      where: { id: checklistId, engagement_id: engagementId },
      select: { id: true },
    });
    if (!checklist) throw AppError.badRequest('Checklist item does not belong to this engagement');
  }

  private async _assertRiskExists(riskId: string): Promise<void> {
    const risk = await prisma.risk_Register.findFirst({
      where: { id: riskId, deleted_at: null },
      select: { id: true },
    });
    if (!risk) throw AppError.badRequest('Risk does not exist');
  }

  private async _getFinding(id: string) {
    const finding = await prisma.audit_Finding.findFirst({ where: { id, deleted_at: null } });
    if (!finding) throw AppError.notFound('Audit finding');
    return finding;
  }
}
