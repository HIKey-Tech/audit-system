import {
  CreateWorkspaceDocumentRequestDto,
  UpdateWorkspaceDocumentRequestDto,
  WorkspaceDocumentQueryDto,
} from '../../dto/request/workspace.request.dto';
import { ImportedDocumentDto, WorkspaceDocumentDto, WorkspaceDocumentSummaryDto } from '../../dto/response/workspace.response.dto';

export interface IWorkspaceService {
  list(ownerId: string, query: WorkspaceDocumentQueryDto): Promise<WorkspaceDocumentSummaryDto[]>;
  get(id: string, ownerId: string): Promise<WorkspaceDocumentDto>;
  create(dto: CreateWorkspaceDocumentRequestDto, owner: { id: string; displayName: string }): Promise<WorkspaceDocumentDto>;
  update(id: string, dto: UpdateWorkspaceDocumentRequestDto, ownerId: string): Promise<WorkspaceDocumentDto>;
  remove(id: string, ownerId: string): Promise<void>;
  importWord(file: { originalname: string; buffer: Buffer }): Promise<ImportedDocumentDto>;
}
