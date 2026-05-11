import { IDocumentService } from '../../../../document/service/interface/document.service.interface';
import { IApprovalService } from '../../../../workflow/approval/service/interface/approval.service.interface';
import { ActorContext, ExportedAuditFile } from '../../../domain/entity/audit.entity';
import { IFollowUpService } from '../../../follow-up/service/interface/follow-up.service.interface';
import { UpdateReportRequestDto } from '../../dto/request/report.request.dto';
import { ReportResponseDto } from '../../dto/response/report.response.dto';
import { IReportService } from '../interface/report.service.interface';
import { IReportGenerationService } from '../interface/report-generation.service.interface';
export declare class ReportService implements IReportService {
    private readonly followUpService;
    private readonly documentService;
    private readonly reportGenerationService;
    private readonly approvalService;
    constructor(followUpService: IFollowUpService, documentService: IDocumentService, reportGenerationService: IReportGenerationService, approvalService?: IApprovalService);
    generateReport(engagementId: string, dto: UpdateReportRequestDto, actor: ActorContext): Promise<ReportResponseDto>;
    updateReport(id: string, dto: UpdateReportRequestDto, actor: ActorContext): Promise<ReportResponseDto>;
    submitReportForApproval(id: string, actor: ActorContext): Promise<ReportResponseDto>;
    approveReport(id: string, actor: ActorContext): Promise<ReportResponseDto>;
    rejectReport(id: string, reason: string, actor: ActorContext): Promise<ReportResponseDto>;
    issueReport(id: string, actor: ActorContext): Promise<ReportResponseDto>;
    getReport(engagementId: string): Promise<ReportResponseDto>;
    exportReport(id: string, format: 'docx' | 'pdf'): Promise<ExportedAuditFile>;
    private _getReport;
    private _assertSubmittedReportHasNoApproval;
}
//# sourceMappingURL=report.service.d.ts.map