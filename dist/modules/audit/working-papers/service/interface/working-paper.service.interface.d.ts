import { ActorContext, ExportedAuditFile } from '../../../domain/entity/audit.entity';
import { CreateWorkingPaperRequestDto, ImportWorkingPaperMetadataDto, UpdateWorkingPaperRequestDto } from '../../dto/request/working-paper.request.dto';
import { WorkingPaperCommentResponseDto, WorkingPaperImportPreviewResponseDto, WorkingPaperResponseDto } from '../../dto/response/working-paper.response.dto';
export interface WorkingPaperImportFileDto {
    originalName: string;
    mimeType: string;
    fileSize: number;
    buffer: Buffer;
}
export type WorkingPaperExportFormat = 'docx' | 'pdf';
export interface IWorkingPaperService {
    createWorkingPaper(engagementId: string, dto: CreateWorkingPaperRequestDto, actor: ActorContext): Promise<WorkingPaperResponseDto>;
    previewWorkingPaperImport(engagementId: string, file: WorkingPaperImportFileDto, dto: ImportWorkingPaperMetadataDto, actor: ActorContext): Promise<WorkingPaperImportPreviewResponseDto>;
    updateWorkingPaper(id: string, dto: UpdateWorkingPaperRequestDto, actor: ActorContext): Promise<WorkingPaperResponseDto>;
    submitWorkingPaper(id: string, actor: ActorContext): Promise<WorkingPaperResponseDto>;
    approveWorkingPaper(id: string, actor: ActorContext, edits?: {
        content?: string;
    }): Promise<WorkingPaperResponseDto>;
    rejectWorkingPaper(id: string, reason: string, actor: ActorContext): Promise<WorkingPaperResponseDto>;
    getWorkingPaperById(id: string, actor: ActorContext): Promise<WorkingPaperResponseDto>;
    listWorkingPapers(engagementId: string, actor: ActorContext): Promise<WorkingPaperResponseDto[]>;
    exportWorkingPaper(id: string, format: WorkingPaperExportFormat): Promise<ExportedAuditFile>;
    addComment(workingPaperId: string, body: string, actor: ActorContext): Promise<WorkingPaperCommentResponseDto>;
    listComments(workingPaperId: string, actor: ActorContext): Promise<WorkingPaperCommentResponseDto[]>;
    resolveComment(commentId: string, actor: ActorContext): Promise<WorkingPaperCommentResponseDto>;
}
//# sourceMappingURL=working-paper.service.interface.d.ts.map