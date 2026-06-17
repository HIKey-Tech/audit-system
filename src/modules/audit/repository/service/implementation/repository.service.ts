import { Prisma } from '@prisma/client';
import { prisma } from '../../../../../shared/prisma/prisma.client';
import { AppError } from '../../../../../shared/errors/app.error';
import {
  buildPaginationMeta,
  parsePagination,
  PaginationMeta,
} from '../../../../../shared/types/api-response.type';
import { auditLogService } from '../../../../logging/service/implementation/audit-log.service';
import { IDocumentService } from '../../../../document/service/interface/document.service.interface';
import { ServedFileDto } from '../../../../document/dto/response/document.response.dto';
import { ActorContext } from '../../../domain/entity/audit.entity';
import { assertHasPermission } from '../../../utility/audit.utility';
import { RepositoryQueryDto } from '../../dto/request/repository.request.dto';
import {
  ALL_REPOSITORY_ENTITY_TYPES,
  REPOSITORY_CATEGORY_ENTITY_TYPES,
  RepositoryEngagementRef,
  RepositoryItemResponseDto,
  categoryForEntityType,
} from '../../dto/response/repository.response.dto';
import { IRepositoryService } from '../interface/repository.service.interface';

interface RepositoryDocRow {
  id: string;
  original_name: string;
  mime_type: string;
  file_size: number;
  entity_type: string | null;
  entity_id: string | null;
  created_at: Date;
  uploaded_by: {
    id: string;
    first_name: string;
    last_name: string;
    display_name: string | null;
  } | null;
}

export class RepositoryService implements IRepositoryService {
  constructor(private readonly documentService: IDocumentService) {}

  async list(
    query: RepositoryQueryDto,
    actor: ActorContext,
  ): Promise<{ items: RepositoryItemResponseDto[]; meta: PaginationMeta }> {
    assertHasPermission(actor.permissions, 'engagement:read');
    const { skip, take, page, pageSize } = parsePagination(query);

    const entityTypes =
      query.category && query.category !== 'all'
        ? REPOSITORY_CATEGORY_ENTITY_TYPES[query.category]
        : ALL_REPOSITORY_ENTITY_TYPES;

    const where: Prisma.DocumentWhereInput = {
      deleted_at: null,
      module: 'audit',
      entity_type: { in: entityTypes },
      ...(query.search && { original_name: { contains: query.search } }),
    };

    const [total, docs] = await prisma.$transaction([
      prisma.document.count({ where }),
      prisma.document.findMany({
        where,
        orderBy: { created_at: 'desc' },
        skip,
        take,
        select: {
          id: true,
          original_name: true,
          mime_type: true,
          file_size: true,
          entity_type: true,
          entity_id: true,
          created_at: true,
          uploaded_by: { select: { id: true, first_name: true, last_name: true, display_name: true } },
        },
      }),
    ]);

    const engagementByDoc = await this._resolveEngagements(docs);

    const items: RepositoryItemResponseDto[] = docs.map((doc) => ({
      id: doc.id,
      fileName: doc.original_name,
      mimeType: doc.mime_type,
      fileSize: doc.file_size,
      category: categoryForEntityType(doc.entity_type),
      entityType: doc.entity_type,
      uploadedAt: doc.created_at.toISOString(),
      uploadedBy: doc.uploaded_by
        ? {
            id: doc.uploaded_by.id,
            name: doc.uploaded_by.display_name ?? `${doc.uploaded_by.first_name} ${doc.uploaded_by.last_name}`,
          }
        : null,
      engagement: engagementByDoc.get(doc.id) ?? null,
    }));

    return { items, meta: buildPaginationMeta(total, page, pageSize) };
  }

  async getFile(documentId: string, actor: ActorContext): Promise<ServedFileDto> {
    assertHasPermission(actor.permissions, 'engagement:read');
    // Scope to audit-module documents so engagement:read cannot pull arbitrary files.
    const doc = await prisma.document.findFirst({
      where: { id: documentId, module: 'audit', deleted_at: null },
      select: { id: true },
    });
    if (!doc) throw AppError.notFound('Document');

    const file = await this.documentService.getFileById(documentId);
    auditLogService.logAsync({ userId: actor.id, action: 'audit.repository.download', module: 'audit', entityType: 'document', entityId: documentId });
    return file;
  }

  /**
   * Resolve the owning engagement for a page of documents. Evidence and
   * working-paper-source docs store the engagement id directly; reports,
   * snapshots and follow-up evidence store a child entity id that we batch
   * back to its engagement. Bounded by page size — a handful of indexed
   * lookups, never N+1.
   */
  private async _resolveEngagements(
    docs: Pick<RepositoryDocRow, 'id' | 'entity_type' | 'entity_id'>[],
  ): Promise<Map<string, RepositoryEngagementRef>> {
    const engIdByDoc = new Map<string, string>();
    const reportRefs: { doc: string; ent: string }[] = [];
    const paperRefs: { doc: string; ent: string }[] = [];
    const findingRefs: { doc: string; ent: string }[] = [];

    for (const doc of docs) {
      if (!doc.entity_id) continue;
      if (doc.entity_type === 'audit_engagement' || doc.entity_type === 'audit_working_paper_source') {
        engIdByDoc.set(doc.id, doc.entity_id);
      } else if (doc.entity_type === 'audit_report') {
        reportRefs.push({ doc: doc.id, ent: doc.entity_id });
      } else if (doc.entity_type === 'audit_working_paper_snapshot') {
        paperRefs.push({ doc: doc.id, ent: doc.entity_id });
      } else if (doc.entity_type === 'audit_follow_up_evidence') {
        findingRefs.push({ doc: doc.id, ent: doc.entity_id });
      }
    }

    const [reports, papers, findings] = await Promise.all([
      reportRefs.length
        ? prisma.audit_Report.findMany({ where: { id: { in: reportRefs.map((r) => r.ent) } }, select: { id: true, engagement_id: true } })
        : Promise.resolve([]),
      paperRefs.length
        ? prisma.audit_Working_Paper.findMany({ where: { id: { in: paperRefs.map((r) => r.ent) } }, select: { id: true, engagement_id: true } })
        : Promise.resolve([]),
      findingRefs.length
        ? prisma.audit_Finding.findMany({ where: { id: { in: findingRefs.map((r) => r.ent) } }, select: { id: true, engagement_id: true } })
        : Promise.resolve([]),
    ]);

    const link = (
      rows: { id: string; engagement_id: string }[],
      refs: { doc: string; ent: string }[],
    ): void => {
      const byId = new Map(rows.map((r) => [r.id, r.engagement_id]));
      for (const ref of refs) {
        const engId = byId.get(ref.ent);
        if (engId) engIdByDoc.set(ref.doc, engId);
      }
    };
    link(reports, reportRefs);
    link(papers, paperRefs);
    link(findings, findingRefs);

    const engIds = [...new Set(engIdByDoc.values())];
    const engagements = engIds.length
      ? await prisma.audit_Engagement.findMany({
          where: { id: { in: engIds } },
          select: { id: true, reference_number: true, title: true },
        })
      : [];
    const engMap = new Map<string, RepositoryEngagementRef>(
      engagements.map((e) => [e.id, { id: e.id, referenceNumber: e.reference_number, title: e.title }]),
    );

    const result = new Map<string, RepositoryEngagementRef>();
    for (const [docId, engId] of engIdByDoc) {
      const ref = engMap.get(engId);
      if (ref) result.set(docId, ref);
    }
    return result;
  }
}
