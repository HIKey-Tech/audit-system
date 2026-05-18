import { ActorContext, ExportedAuditFile } from '../../../domain/entity/audit.entity';
import { CreateWorkingPaperRequestDto, ImportWorkingPaperMetadataDto, UpdateWorkingPaperRequestDto } from '../../dto/request/working-paper.request.dto';
import { WorkingPaperImportPreviewResponseDto, WorkingPaperResponseDto } from '../../dto/response/working-paper.response.dto';
export interface WorkingPaperImportFileDto {
    originalName: string;
    mimeType: string;
    fileSize: number;
    buffer: Buffer;
}
export interface IWorkingPaperService {
    createWorkingPaper(engagementId: string, dto: CreateWorkingPaperRequestDto, actor: ActorContext): Promise<WorkingPaperResponseDto>;
    previewWorkingPaperImport(engagementId: string, file: WorkingPaperImportFileDto, dto: ImportWorkingPaperMetadataDto, actor: ActorContext): Promise<WorkingPaperImportPreviewResponseDto>;
    updateWorkingPaper(id: string, dto: UpdateWorkingPaperRequestDto, actor: ActorContext): Promise<WorkingPaperResponseDto>;
    submitWorkingPaper(id: string, actor: ActorContext): Promise<WorkingPaperResponseDto>;
    approveWorkingPaper(id: string, actor: ActorContext): Promise<WorkingPaperResponseDto>;
    rejectWorkingPaper(id: string, reason: string, actor: ActorContext): Promise<WorkingPaperResponseDto>;
    getWorkingPaperById(id: string): Promise<WorkingPaperResponseDto>;
    listWorkingPapers(engagementId: string): Promise<WorkingPaperResponseDto[]>;
    exportWorkingPaper(id: string): Promise<ExportedAuditFile>;
}
//# sourceMappingURL=working-paper.service.interface.d.ts.map