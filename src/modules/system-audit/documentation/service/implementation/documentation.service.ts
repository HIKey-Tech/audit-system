import { randomUUID } from 'crypto';
import { Prisma } from '@prisma/client';
import { prisma } from '../../../../../shared/prisma/prisma.client';
import { AppError } from '../../../../../shared/errors/app.error';
import { logger } from '../../../../../shared/utils/logger.util';
import {
  PaginationMeta,
  buildPaginationMeta,
  parsePagination,
} from '../../../../../shared/types/api-response.type';
import { SystemDocumentWithRelations, systemDocumentInclude } from '../../../../../shared/prisma/prisma.types';
import { auditLogService } from '../../../../logging/service/implementation/audit-log.service';
import { IUserService } from '../../../../user/service/interface/user.service.interface';
import { IDocumentService } from '../../../../document/service/interface/document.service.interface';
import { IEngagementService } from '../../../../audit/engagement/service/interface/engagement.service.interface';
import { IUniverseService } from '../../../../audit/universe/service/interface/universe.service.interface';
import { IAssetService } from '../../../../asset/service/interface/asset.service.interface';
import { SystemAuditActor } from '../../../domain/entity/system-audit.entity';
import { SystemDocumentStatus } from '../../../domain/enum/system-audit.enum';
import { ExtractFile, ServedExtract } from '../../../analytics/service/interface/analytics.service.interface';
import {
  CreateSystemDocumentDto,
  SystemDocumentListQueryDto,
  UpdateSystemDocumentDto,
  UploadSystemDocumentVersionDto,
} from '../../dto/request/documentation.request.dto';
import {
  CONTRACT_EXPIRING_DAYS,
  REVIEW_DUE_SOON_DAYS,
  SystemDocumentResponseDto,
  SystemDocumentSummaryDto,
  mapSystemDocumentToResponse,
} from '../../dto/response/documentation.response.dto';
import { ISystemDocumentationService } from '../interface/documentation.service.interface';

const inDays = (days: number): Date => new Date(Date.now() + days * 86_400_000);

export class SystemDocumentationService implements ISystemDocumentationService {
  constructor(
    private readonly documentService: IDocumentService,
    private readonly userService: IUserService,
    private readonly universeService: IUniverseService,
    private readonly assetService: IAssetService,
    private readonly engagementService: IEngagementService,
  ) {}

  async create(dto: CreateSystemDocumentDto, file: ExtractFile, actor: SystemAuditActor): Promise<SystemDocumentResponseDto> {
    const ownerId = dto.ownerId ?? actor.id;
    await this._assertReferences({ ownerId, universeId: dto.universeId, assetId: dto.assetId }, actor);

    const id = randomUUID();
    const document = await this.documentService.upload({
      uploadedById: actor.id,
      originalName: file.originalName,
      mimeType: file.mimeType,
      fileSize: file.fileSize,
      buffer: file.buffer,
      module: 'system-audit',
      entityType: 'system_document',
      entityId: id,
    });

    await prisma.system_Document.create({
      data: {
        id,
        document_id: document.id,
        title: dto.title,
        doc_type: dto.docType,
        description: dto.description ?? null,
        version_label: dto.versionLabel ?? null,
        owner_id: ownerId,
        universe_id: dto.universeId ?? null,
        asset_id: dto.assetId ?? null,
        vendor: dto.vendor ?? null,
        effective_date: dto.effectiveDate ?? null,
        review_due_date: dto.reviewDueDate ?? null,
        expiry_date: dto.expiryDate ?? null,
        created_by_id: actor.id,
      },
    });

    logger.info('System document added', { systemDocumentId: id, docType: dto.docType, actorId: actor.id });
    auditLogService.logAsync({
      userId: actor.id,
      action: 'system_audit.documentation.create',
      module: 'system-audit',
      entityType: 'system_document',
      entityId: id,
      newValues: { ...dto, ownerId, fileName: file.originalName, contentSha256: document.contentSha256 },
    });
    return this.get(id);
  }

  async update(id: string, dto: UpdateSystemDocumentDto, actor: SystemAuditActor): Promise<SystemDocumentResponseDto> {
    const existing = await this._getExisting(id);
    await this._assertReferences(
      { ownerId: dto.ownerId, universeId: dto.universeId ?? undefined, assetId: dto.assetId ?? undefined },
      actor,
    );

    await prisma.system_Document.update({
      where: { id },
      data: {
        ...(dto.title !== undefined && { title: dto.title }),
        ...(dto.docType !== undefined && { doc_type: dto.docType }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.versionLabel !== undefined && { version_label: dto.versionLabel }),
        ...(dto.ownerId !== undefined && { owner_id: dto.ownerId }),
        ...(dto.universeId !== undefined && { universe_id: dto.universeId }),
        ...(dto.assetId !== undefined && { asset_id: dto.assetId }),
        ...(dto.vendor !== undefined && { vendor: dto.vendor }),
        ...(dto.effectiveDate !== undefined && { effective_date: dto.effectiveDate }),
        ...(dto.reviewDueDate !== undefined && { review_due_date: dto.reviewDueDate }),
        ...(dto.expiryDate !== undefined && { expiry_date: dto.expiryDate }),
        ...(dto.status !== undefined && { status: dto.status }),
      },
    });

    logger.info('System document updated', { systemDocumentId: id, actorId: actor.id });
    auditLogService.logAsync({
      userId: actor.id,
      action: 'system_audit.documentation.update',
      module: 'system-audit',
      entityType: 'system_document',
      entityId: id,
      oldValues: mapSystemDocumentToResponse(existing),
      newValues: dto,
    });
    return this.get(id);
  }

  async uploadVersion(
    id: string,
    dto: UploadSystemDocumentVersionDto,
    file: ExtractFile,
    actor: SystemAuditActor,
  ): Promise<SystemDocumentResponseDto> {
    const existing = await this._getExisting(id);
    await this.documentService.uploadNewVersion(existing.document_id, {
      uploadedById: actor.id,
      originalName: file.originalName,
      mimeType: file.mimeType,
      fileSize: file.fileSize,
      buffer: file.buffer,
      changeNote: dto.changeNote,
    });
    if (dto.versionLabel !== undefined || dto.reviewDueDate !== undefined) {
      await prisma.system_Document.update({
        where: { id },
        data: {
          ...(dto.versionLabel !== undefined && { version_label: dto.versionLabel }),
          ...(dto.reviewDueDate !== undefined && { review_due_date: dto.reviewDueDate }),
        },
      });
    }

    logger.info('System document version uploaded', { systemDocumentId: id, actorId: actor.id });
    auditLogService.logAsync({
      userId: actor.id,
      action: 'system_audit.documentation.version',
      module: 'system-audit',
      entityType: 'system_document',
      entityId: id,
      newValues: { ...dto, fileName: file.originalName },
    });
    return this.get(id);
  }

  async remove(id: string, actor: SystemAuditActor): Promise<void> {
    await this._getExisting(id);
    await prisma.system_Document.update({
      where: { id },
      data: { deleted_at: new Date(), status: SystemDocumentStatus.Archived },
    });
    logger.info('System document removed', { systemDocumentId: id, actorId: actor.id });
    auditLogService.logAsync({
      userId: actor.id,
      action: 'system_audit.documentation.delete',
      module: 'system-audit',
      entityType: 'system_document',
      entityId: id,
    });
  }

  async get(id: string): Promise<SystemDocumentResponseDto> {
    return mapSystemDocumentToResponse(await this._getExisting(id));
  }

  async list(
    query: SystemDocumentListQueryDto,
    actor: SystemAuditActor,
  ): Promise<{ documents: SystemDocumentResponseDto[]; meta: PaginationMeta }> {
    const { skip, take, page, pageSize } = parsePagination(query);
    const now = new Date();
    const and: Prisma.System_DocumentWhereInput[] = [
      { deleted_at: null, status: query.status ?? SystemDocumentStatus.Active },
    ];
    if (query.docType) and.push({ doc_type: query.docType });
    if (query.universeId) and.push({ universe_id: query.universeId });
    if (query.assetId) and.push({ asset_id: query.assetId });
    if (query.ownerId) and.push({ owner_id: query.ownerId });
    if (query.engagementId) and.push(await this._engagementScope(query.engagementId, actor));
    if (query.reviewState === 'overdue') and.push({ review_due_date: { lt: now } });
    if (query.reviewState === 'due_soon') and.push({ review_due_date: { gte: now, lte: inDays(REVIEW_DUE_SOON_DAYS) } });
    if (query.contractState === 'expired') and.push({ expiry_date: { lt: now } });
    if (query.contractState === 'expiring') and.push({ expiry_date: { gte: now, lte: inDays(CONTRACT_EXPIRING_DAYS) } });
    if (query.search) {
      and.push({
        OR: [
          { title: { contains: query.search } },
          { description: { contains: query.search } },
          { vendor: { contains: query.search } },
        ],
      });
    }
    const where: Prisma.System_DocumentWhereInput = { AND: and };

    const [total, documents] = await prisma.$transaction([
      prisma.system_Document.count({ where }),
      prisma.system_Document.findMany({
        where,
        include: systemDocumentInclude,
        orderBy: [{ doc_type: 'asc' }, { title: 'asc' }],
        skip,
        take,
      }),
    ]);
    return {
      documents: documents.map((d) => mapSystemDocumentToResponse(d, now)),
      meta: buildPaginationMeta(total, page, pageSize),
    };
  }

  async summary(): Promise<SystemDocumentSummaryDto> {
    const now = new Date();
    const base: Prisma.System_DocumentWhereInput = { deleted_at: null, status: SystemDocumentStatus.Active };
    const [byType, reviewOverdue, reviewDueSoon, contractsExpired, contractsExpiring] = await prisma.$transaction([
      prisma.system_Document.groupBy({ by: ['doc_type'], where: base, _count: { _all: true }, orderBy: { doc_type: 'asc' } }),
      prisma.system_Document.count({ where: { ...base, review_due_date: { lt: now } } }),
      prisma.system_Document.count({ where: { ...base, review_due_date: { gte: now, lte: inDays(REVIEW_DUE_SOON_DAYS) } } }),
      prisma.system_Document.count({ where: { ...base, expiry_date: { lt: now } } }),
      prisma.system_Document.count({ where: { ...base, expiry_date: { gte: now, lte: inDays(CONTRACT_EXPIRING_DAYS) } } }),
    ]);
    const types = Object.fromEntries(
      byType.map((t) => [t.doc_type, typeof t._count === 'object' ? (t._count._all ?? 0) : 0]),
    ) as Record<string, number>;
    return {
      total: Object.values(types).reduce((n, c) => n + c, 0),
      byType: types,
      reviewOverdue,
      reviewDueSoon,
      contractsExpired,
      contractsExpiring,
    };
  }

  async getFile(id: string, actor: SystemAuditActor): Promise<ServedExtract> {
    const doc = await this._getExisting(id);
    const file = await this.documentService.getFileById(doc.document_id);
    auditLogService.logAsync({
      userId: actor.id,
      action: 'system_audit.documentation.download',
      module: 'system-audit',
      entityType: 'system_document',
      entityId: id,
    });
    return { buffer: file.buffer, mimeType: file.mimeType, originalName: file.originalName };
  }

  // ── internals ───────────────────────────────────────────────

  private async _getExisting(id: string): Promise<SystemDocumentWithRelations> {
    const doc = await prisma.system_Document.findFirst({ where: { id, deleted_at: null }, include: systemDocumentInclude });
    if (!doc) throw AppError.notFound('System document');
    return doc;
  }

  private async _assertReferences(
    refs: { ownerId?: string; universeId?: string; assetId?: string },
    actor: SystemAuditActor,
  ): Promise<void> {
    const ctx = { id: actor.id, roles: actor.roles, permissions: actor.permissions, isSuperAdmin: actor.isSuperAdmin };
    if (refs.ownerId) await this.userService.getUserById(refs.ownerId);
    if (refs.universeId) await this.universeService.getEntityById(refs.universeId, ctx);
    if (refs.assetId) await this.assetService.getAssetById(refs.assetId, ctx);
  }

  /** An engagement's scope: its audit-universe entity plus the assets linked to it. */
  private async _engagementScope(engagementId: string, actor: SystemAuditActor): Promise<Prisma.System_DocumentWhereInput> {
    const ctx = { id: actor.id, roles: actor.roles, permissions: actor.permissions, isSuperAdmin: actor.isSuperAdmin };
    const engagement = await this.engagementService.getEngagementById(engagementId, ctx);
    const assets = await this.assetService.listAssetsForEngagement(engagementId, ctx);
    return {
      OR: [
        { universe_id: engagement.universeId },
        ...(assets.length > 0 ? [{ asset_id: { in: assets.map((a) => a.id) } }] : []),
      ],
    };
  }
}
