import { IDocumentService } from '../../../../document/service/interface/document.service.interface';
import { IApprovalService } from '../../../../workflow/approval/service/interface/approval.service.interface';
import { ActorContext, ExportedAuditFile } from '../../../domain/entity/audit.entity';
import { CreateWorkingPaperRequestDto, UpdateWorkingPaperRequestDto } from '../../dto/request/working-paper.request.dto';
import { WorkingPaperResponseDto } from '../../dto/response/working-paper.response.dto';
import { IWorkingPaperService } from '../interface/working-paper.service.interface';
export declare class WorkingPaperService implements IWorkingPaperService {
    private readonly documentService;
    private readonly approvalService;
    constructor(documentService: IDocumentService, approvalService?: IApprovalService);
    createWorkingPaper(engagementId: string, dto: CreateWorkingPaperRequestDto, actor: ActorContext): Promise<WorkingPaperResponseDto>;
    updateWorkingPaper(id: string, dto: UpdateWorkingPaperRequestDto, actor: ActorContext): Promise<WorkingPaperResponseDto>;
    submitWorkingPaper(id: string, actor: ActorContext): Promise<WorkingPaperResponseDto>;
    approveWorkingPaper(id: string, actor: ActorContext): Promise<WorkingPaperResponseDto>;
    rejectWorkingPaper(id: string, reason: string, actor: ActorContext): Promise<WorkingPaperResponseDto>;
    getWorkingPaperById(id: string): Promise<WorkingPaperResponseDto>;
    listWorkingPapers(engagementId: string): Promise<WorkingPaperResponseDto[]>;
    exportWorkingPaper(id: string): Promise<ExportedAuditFile>;
    private _assertEngagementInProgress;
    private _getPaper;
    private _getPaperWithEngagement;
}
//# sourceMappingURL=working-paper.service.d.ts.map