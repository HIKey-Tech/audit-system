import { IDocumentService } from '../../../../document/service/interface/document.service.interface';
import { IWorkingPaperTemplateService } from '../../../../settings/service/interface/working-paper-template.service.interface';
import { IApprovalService } from '../../../../workflow/approval/service/interface/approval.service.interface';
import { ActorContext, ExportedAuditFile } from '../../../domain/entity/audit.entity';
import { CreateWorkingPaperRequestDto, ImportWorkingPaperMetadataDto, UpdateWorkingPaperRequestDto } from '../../dto/request/working-paper.request.dto';
import { WorkingPaperImportPreviewResponseDto, WorkingPaperResponseDto } from '../../dto/response/working-paper.response.dto';
import { IWorkingPaperService, WorkingPaperExportFormat, WorkingPaperImportFileDto } from '../interface/working-paper.service.interface';
export declare class WorkingPaperService implements IWorkingPaperService {
    private readonly documentService;
    private readonly templateService;
    private readonly approvalService;
    constructor(documentService: IDocumentService, templateService?: IWorkingPaperTemplateService, approvalService?: IApprovalService);
    createWorkingPaper(engagementId: string, dto: CreateWorkingPaperRequestDto, actor: ActorContext): Promise<WorkingPaperResponseDto>;
    previewWorkingPaperImport(engagementId: string, file: WorkingPaperImportFileDto, dto: ImportWorkingPaperMetadataDto, actor: ActorContext): Promise<WorkingPaperImportPreviewResponseDto>;
    updateWorkingPaper(id: string, dto: UpdateWorkingPaperRequestDto, actor: ActorContext): Promise<WorkingPaperResponseDto>;
    submitWorkingPaper(id: string, actor: ActorContext): Promise<WorkingPaperResponseDto>;
    approveWorkingPaper(id: string, actor: ActorContext): Promise<WorkingPaperResponseDto>;
    rejectWorkingPaper(id: string, reason: string, actor: ActorContext): Promise<WorkingPaperResponseDto>;
    getWorkingPaperById(id: string, actor: ActorContext): Promise<WorkingPaperResponseDto>;
    listWorkingPapers(engagementId: string, actor: ActorContext): Promise<WorkingPaperResponseDto[]>;
    exportWorkingPaper(id: string, format: WorkingPaperExportFormat): Promise<ExportedAuditFile>;
    /** Build sign-off entries (approver name/role/date + signature image) from the WP's approval. */
    private _buildSignOff;
    private _renderWorkingPaperPdf;
    private _assertEngagementInProgress;
    private _getEngagementForWorkingPaperImport;
    private _resolveImportTemplate;
    private _assertOptionalImportReferences;
    private _suggestTitle;
    private _getPaper;
    private _getPaperWithEngagement;
}
//# sourceMappingURL=working-paper.service.d.ts.map