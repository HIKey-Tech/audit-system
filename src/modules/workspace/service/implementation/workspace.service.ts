import mammoth from 'mammoth';
import { prisma } from '../../../../shared/prisma/prisma.client';
import { AppError } from '../../../../shared/errors/app.error';
import { logger } from '../../../../shared/utils/logger.util';
import {
  CreateWorkspaceDocumentRequestDto,
  UpdateWorkspaceDocumentRequestDto,
  WorkspaceDocumentQueryDto,
} from '../../dto/request/workspace.request.dto';
import {
  ImportedDocumentDto,
  WorkspaceDocumentDto,
  WorkspaceDocumentSummaryDto,
  mapDocument,
  mapSummary,
} from '../../dto/response/workspace.response.dto';
import { buildGbbTemplateContent } from '../../utility/gbb-document-template';
import { IWorkspaceService } from '../interface/workspace.service.interface';

/**
 * A person's own documents in the in-app editor. Every query is scoped to the owner, so a document is invisible to
 * everyone else: a wrong id reads as "not found", never "forbidden", which would reveal that it exists.
 */
export class WorkspaceService implements IWorkspaceService {
  async list(ownerId: string, query: WorkspaceDocumentQueryDto): Promise<WorkspaceDocumentSummaryDto[]> {
    const rows = await prisma.workspace_Document.findMany({
      where: { owner_id: ownerId, deleted_at: null, ...(query.search && { title: { contains: query.search } }) },
      select: { id: true, title: true, template: true, created_at: true, updated_at: true },
      orderBy: { updated_at: 'desc' },
      take: 500,
    });
    return rows.map(mapSummary);
  }

  async get(id: string, ownerId: string): Promise<WorkspaceDocumentDto> {
    return mapDocument(await this._owned(id, ownerId));
  }

  async create(dto: CreateWorkspaceDocumentRequestDto, owner: { id: string; displayName: string }): Promise<WorkspaceDocumentDto> {
    const today = new Date().toISOString().slice(0, 10);
    const content =
      dto.template === 'gbb'
        ? buildGbbTemplateContent({
            title: dto.title,
            author: owner.displayName,
            reference: `GBB/IA/DOC/${Date.now().toString(36).toUpperCase()}`,
            date: today,
          })
        : (dto.content ?? '<p></p>');
    const created = await prisma.workspace_Document.create({
      data: { owner_id: owner.id, title: dto.title, template: dto.template, content },
    });
    logger.info('Workspace document created', { documentId: created.id, ownerId: owner.id, template: dto.template });
    return mapDocument(created);
  }

  async update(id: string, dto: UpdateWorkspaceDocumentRequestDto, ownerId: string): Promise<WorkspaceDocumentDto> {
    await this._owned(id, ownerId);
    const updated = await prisma.workspace_Document.update({
      where: { id },
      data: {
        ...(dto.title !== undefined && { title: dto.title }),
        ...(dto.content !== undefined && { content: dto.content }),
      },
    });
    return mapDocument(updated);
  }

  async remove(id: string, ownerId: string): Promise<void> {
    await this._owned(id, ownerId);
    await prisma.workspace_Document.update({ where: { id }, data: { deleted_at: new Date() } });
    logger.info('Workspace document deleted', { documentId: id, ownerId });
  }

  /** Converts a Word (.docx) file to editor HTML. Nothing is stored; the caller opens or inserts the result. */
  async importWord(file: { originalname: string; buffer: Buffer }): Promise<ImportedDocumentDto> {
    if (!/\.docx$/i.test(file.originalname)) {
      throw AppError.badRequest('Only Word (.docx) files can be imported. Save older .doc files as .docx first.');
    }
    try {
      const result = await mammoth.convertToHtml({ buffer: file.buffer });
      return {
        title: file.originalname.replace(/\.docx$/i, ''),
        html: result.value || '<p></p>',
        warnings: [...new Set(result.messages.filter((m) => m.type === 'warning').map((m) => m.message))].slice(0, 10),
      };
    } catch (err) {
      logger.warn('Word import failed', { err });
      throw AppError.badRequest('This file could not be read as a Word document.');
    }
  }

  private async _owned(id: string, ownerId: string) {
    const doc = await prisma.workspace_Document.findFirst({ where: { id, owner_id: ownerId, deleted_at: null } });
    if (!doc) throw AppError.notFound('Document');
    return doc;
  }
}
