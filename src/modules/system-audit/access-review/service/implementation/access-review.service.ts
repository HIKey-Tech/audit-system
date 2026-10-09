import { Prisma } from '@prisma/client';
import { prisma } from '../../../../../shared/prisma/prisma.client';
import { AppError } from '../../../../../shared/errors/app.error';
import { logger } from '../../../../../shared/utils/logger.util';
import {
  PaginationMeta,
  buildPaginationMeta,
  parsePagination,
} from '../../../../../shared/types/api-response.type';
import {
  EXPORT_MAX_ROWS,
  ExportFormat,
  TabularExportFile,
  buildTabularExport,
} from '../../../../../shared/utils/tabular-export.util';
import { accessReviewItemInclude } from '../../../../../shared/prisma/prisma.types';
import { auditLogService } from '../../../../logging/service/implementation/audit-log.service';
import { SystemAuditActor } from '../../../domain/entity/system-audit.entity';
import { AccessDecision, AnalysisType, RunReviewStatus } from '../../../domain/enum/system-audit.enum';
import { ISystemAuditAnalyticsService } from '../../../analytics/service/interface/analytics.service.interface';
import { AccessItemListQueryDto, DecideAccessItemsDto } from '../../dto/request/access-review.request.dto';
import { AccessReviewItemResponseDto, mapAccessItemToResponse } from '../../dto/response/access-review.response.dto';
import { IAccessReviewService } from '../interface/access-review.service.interface';

export class AccessReviewService implements IAccessReviewService {
  constructor(private readonly analyticsService: ISystemAuditAnalyticsService) {}

  async listItems(
    runId: string,
    query: AccessItemListQueryDto,
    actor: SystemAuditActor,
  ): Promise<{ items: AccessReviewItemResponseDto[]; meta: PaginationMeta }> {
    await this._assertAccessReview(runId, actor);
    const { skip, take, page, pageSize } = parsePagination(query);
    const where: Prisma.Access_Review_ItemWhereInput = {
      run_id: runId,
      ...(query.decision && { decision: query.decision }),
      ...(query.flagged !== undefined && { flags: query.flagged ? { not: null } : null }),
      ...(query.privileged !== undefined && { is_privileged: query.privileged }),
      ...(query.search && {
        OR: [
          { account_id: { contains: query.search } },
          { display_name: { contains: query.search } },
          { email: { contains: query.search } },
          { department: { contains: query.search } },
        ],
      }),
    };

    const [total, items] = await prisma.$transaction([
      prisma.access_Review_Item.count({ where }),
      prisma.access_Review_Item.findMany({
        where,
        include: accessReviewItemInclude,
        orderBy: [{ is_privileged: 'desc' }, { account_id: 'asc' }],
        skip,
        take,
      }),
    ]);
    return { items: items.map(mapAccessItemToResponse), meta: buildPaginationMeta(total, page, pageSize) };
  }

  async decideItems(runId: string, dto: DecideAccessItemsDto, actor: SystemAuditActor): Promise<{ updated: number }> {
    const run = await this._assertAccessReview(runId, actor);
    if (run.reviewStatus === RunReviewStatus.Completed) {
      throw AppError.badRequest('This access review is signed off — decisions can no longer change');
    }
    const ids = Array.from(new Set(dto.itemIds));
    const found = await prisma.access_Review_Item.count({ where: { id: { in: ids }, run_id: runId } });
    if (found !== ids.length) throw AppError.badRequest('Every account must belong to this access review');

    const resetting = dto.decision === AccessDecision.Pending;
    if (dto.decision === AccessDecision.Appropriate && (dto.note?.trim().length ?? 0) < 5) {
      // Accepting privileged or conflicting access is a judgement call and must be explained.
      const needsJustification = await prisma.access_Review_Item.count({
        where: {
          id: { in: ids },
          run_id: runId,
          OR: [{ is_privileged: true }, { flags: { contains: 'SOD_CONFLICT' } }],
        },
      });
      if (needsJustification > 0) {
        throw AppError.badRequest(
          `A justification is required to mark ${needsJustification} privileged or conflicting account(s) as appropriate`,
        );
      }
    }
    const previous = await prisma.access_Review_Item.groupBy({
      by: ['decision'],
      where: { id: { in: ids }, run_id: runId },
      _count: { _all: true },
    });
    const result = await prisma.access_Review_Item.updateMany({
      where: { id: { in: ids }, run_id: runId },
      data: {
        decision: dto.decision,
        decision_note: resetting ? null : dto.note ?? null,
        decided_by_id: resetting ? null : actor.id,
        decided_at: resetting ? null : new Date(),
      },
    });

    logger.info('Access review decisions recorded', { runId, actorId: actor.id, decision: dto.decision, count: result.count });
    auditLogService.logAsync({
      userId: actor.id,
      action: 'system_audit.access_review.decide',
      module: 'system-audit',
      entityType: 'system_audit_run',
      entityId: runId,
      oldValues: { decisions: Object.fromEntries(previous.map((row) => [row.decision, row._count._all])) },
      newValues: { count: ids.length, decision: dto.decision, note: dto.note, itemIds: ids },
    });
    return { updated: result.count };
  }

  async exportItems(runId: string, format: ExportFormat, actor: SystemAuditActor): Promise<TabularExportFile> {
    await this._assertAccessReview(runId, actor);
    const run = await prisma.system_Audit_Run.findUniqueOrThrow({ where: { id: runId }, select: { reference: true } });
    const items = (
      await prisma.access_Review_Item.findMany({
        where: { run_id: runId },
        include: accessReviewItemInclude,
        orderBy: [{ is_privileged: 'desc' }, { account_id: 'asc' }],
        take: EXPORT_MAX_ROWS,
      })
    ).map(mapAccessItemToResponse);

    auditLogService.logAsync({
      userId: actor.id,
      action: 'system_audit.access_review.export',
      module: 'system-audit',
      entityType: 'system_audit_run',
      entityId: runId,
      newValues: { format, count: items.length },
    });

    return buildTabularExport(
      items,
      [
        { header: 'Account', value: (i) => i.accountId },
        { header: 'Name', value: (i) => i.displayName },
        { header: 'Email', value: (i) => i.email },
        { header: 'Department', value: (i) => i.department },
        { header: 'Status', value: (i) => i.accountStatus },
        { header: 'Privileged', value: (i) => (i.isPrivileged ? 'Yes' : 'No') },
        { header: 'Last login', value: (i) => i.lastLoginAt },
        { header: 'Access', value: (i) => i.entitlements.join('; ') },
        { header: 'Flags', value: (i) => i.flags.join('; ') },
        { header: 'Decision', value: (i) => i.decision },
        { header: 'Decision note', value: (i) => i.decisionNote },
        { header: 'Decided by', value: (i) => i.decidedBy?.name },
        { header: 'Decided on', value: (i) => i.decidedAt },
      ],
      { baseName: `${run.reference}-access-review`, format, sheetName: 'Access review' },
    );
  }

  private async _assertAccessReview(runId: string, actor: SystemAuditActor) {
    const run = await this.analyticsService.assertRunVisible(runId, actor);
    if (run.analysisType !== AnalysisType.AccessListing) {
      throw AppError.badRequest('This analysis is not a user access review');
    }
    return run;
  }
}
