import { Prisma } from '@prisma/client';
import { prisma } from '../../../../../shared/prisma/prisma.client';
import { AppError } from '../../../../../shared/errors/app.error';
import { logger } from '../../../../../shared/utils/logger.util';
import { PaginationMeta, buildPaginationMeta, parsePagination } from '../../../../../shared/types/api-response.type';
import { auditLogService } from '../../../../logging/service/implementation/audit-log.service';
import { ActorContext } from '../../../domain/entity/audit.entity';
import { EngagementStatus, FindingStatus } from '../../../domain/enum/audit.enum';
import { AUDIT_REVIEW_ROLES, AUDIT_WORK_ROLES, FINDING_TRANSITIONS, assertHasPermission, assertTransition } from '../../../utility/audit.utility';
import {
  CreateFindingRequestDto,
  FindingQueryDto,
  UpdateFindingRequestDto,
} from '../../dto/request/finding.request.dto';
import { FindingResponseDto, mapFindingToResponse } from '../../dto/response/finding.response.dto';
import { IFindingService } from '../interface/finding.service.interface';

const findingInclude = {
  engagement: { select: { reference_number: true } },
  auditee: { select: { display_name: true, first_name: true, last_name: true, email: true } },
  created_by: { select: { display_name: true, first_name: true, last_name: true, email: true } },
};

export class FindingService implements IFindingService {
  async createFinding(engagementId: string, dto: CreateFindingRequestDto, actor: ActorContext): Promise<FindingResponseDto> {
    assertHasPermission(actor.permissions, 'finding:create');
    await this._assertEngagementAllowsFindings(engagementId);
    if (dto.workingPaperId) {
      await this._assertWorkingPaperInEngagement(dto.workingPaperId, engagementId);
    }

    const finding = await prisma.audit_Finding.create({
      data: {
        engagement_id: engagementId,
        working_paper_id: dto.workingPaperId,
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
    });

    logger.info('Audit finding created', { findingId: finding.id, engagementId, actorId: actor.id });
    auditLogService.logAsync({ userId: actor.id, action: 'audit.finding.create', module: 'audit', entityType: 'audit_finding', entityId: finding.id });
    return mapFindingToResponse(finding);
  }

  async updateFinding(id: string, dto: UpdateFindingRequestDto, actor: ActorContext): Promise<FindingResponseDto> {
    const finding = await this._getFinding(id);
    const isAdmin = actor.roles.some((role) => role === 'super_admin' || role === 'audit_admin');
    if (finding.created_by_id !== actor.id && !isAdmin) throw AppError.forbidden('Only the creator or audit admin can update this finding');
    if (finding.status === FindingStatus.Closed) throw AppError.badRequest('Closed findings cannot be updated');
    if (dto.workingPaperId) {
      await this._assertWorkingPaperInEngagement(dto.workingPaperId, finding.engagement_id);
    }

    const updated = await prisma.audit_Finding.update({
      where: { id },
      data: {
        ...(dto.workingPaperId !== undefined && { working_paper_id: dto.workingPaperId }),
        ...(dto.title !== undefined && { title: dto.title }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.category !== undefined && { category: dto.category }),
        ...(dto.severity !== undefined && { severity: dto.severity }),
        ...(dto.rootCause !== undefined && { root_cause: dto.rootCause }),
        ...(dto.riskImplication !== undefined && { risk_implication: dto.riskImplication }),
        ...(dto.recommendation !== undefined && { recommendation: dto.recommendation }),
        ...(dto.auditeeId !== undefined && { auditee_id: dto.auditeeId }),
        ...(dto.dueDate !== undefined && { due_date: new Date(dto.dueDate) }),
      },
    });

    logger.info('Audit finding updated', { findingId: id, actorId: actor.id });
    auditLogService.logAsync({ userId: actor.id, action: 'audit.finding.update', module: 'audit', entityType: 'audit_finding', entityId: id });
    return mapFindingToResponse(updated);
  }

  async updateFindingStatus(id: string, newStatus: FindingStatus, actor: ActorContext): Promise<FindingResponseDto> {
    assertHasPermission(actor.permissions, 'finding:update');
    const finding = await this._getFinding(id);
    assertTransition(finding.status as FindingStatus, newStatus, FINDING_TRANSITIONS, 'finding');

    const updated = await prisma.audit_Finding.update({
      where: { id },
      data: { status: newStatus },
    });

    logger.info('Audit finding status updated', { findingId: id, status: newStatus, actorId: actor.id });
    auditLogService.logAsync({ userId: actor.id, action: 'audit.finding.status.update', module: 'audit', entityType: 'audit_finding', entityId: id, newValues: { status: newStatus } });
    return mapFindingToResponse(updated);
  }

  async closeFinding(id: string, actor: ActorContext): Promise<FindingResponseDto> {
    assertHasPermission(actor.permissions, 'finding:close');
    const finding = await this._getFinding(id);
    if (finding.status !== FindingStatus.Verified) throw AppError.badRequest('Only verified findings can be closed');

    const updated = await prisma.audit_Finding.update({
      where: { id },
      data: { status: FindingStatus.Closed, closed_by_id: actor.id, closed_at: new Date() },
    });

    logger.info('Audit finding closed', { findingId: id, actorId: actor.id });
    auditLogService.logAsync({ userId: actor.id, action: 'audit.finding.close', module: 'audit', entityType: 'audit_finding', entityId: id });
    return mapFindingToResponse(updated);
  }

  async getFindingById(id: string, actor: ActorContext): Promise<FindingResponseDto> {
    const isAuditee = !actor.permissions.includes('engagement:read');
    const finding = await prisma.audit_Finding.findFirst({
      where: {
        id,
        deleted_at: null,
        ...(isAuditee && { auditee_id: actor.id }),
      },
      include: {
        ...findingInclude,
        evidence: true,
        follow_up: { include: { remediation_evidence: true } },
      },
    });
    if (!finding) throw AppError.notFound('Audit finding');
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

  async listFindings(engagementId: string, query: FindingQueryDto, actor: ActorContext): Promise<FindingResponseDto[]> {
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
    const isOversight = actor.permissions.includes('finding:read_all');
    const isAuditee = !actor.permissions.includes('engagement:read');

    return {
      deleted_at: null,
      ...(query.severity && { severity: query.severity }),
      ...(query.status && { status: query.status }),
      ...(query.category && { category: query.category }),
      ...(query.auditeeId && { auditee_id: query.auditeeId }),
      ...(query.search && {
        OR: [
          { title: { contains: query.search } },
          { description: { contains: query.search } },
          { recommendation: { contains: query.search } },
        ],
      }),
      ...(isAuditee && { auditee_id: actor.id }),
      ...(!isOversight && !isAuditee && {
        engagement: {
          OR: [
            { lead_auditor_id: actor.id },
            { workflow_assignments: { some: { user_id: actor.id } } },
          ],
        },
      }),
    };
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

  private async _getFinding(id: string) {
    const finding = await prisma.audit_Finding.findFirst({ where: { id, deleted_at: null } });
    if (!finding) throw AppError.notFound('Audit finding');
    return finding;
  }
}
