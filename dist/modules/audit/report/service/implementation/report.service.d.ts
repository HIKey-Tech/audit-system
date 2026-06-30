import { PaginationMeta } from '../../../../../shared/types/api-response.type';
import { IDocumentService } from '../../../../document/service/interface/document.service.interface';
import { IApprovalService } from '../../../../workflow/approval/service/interface/approval.service.interface';
import { ActorContext, ExportedAuditFile } from '../../../domain/entity/audit.entity';
import { IFollowUpService } from '../../../follow-up/service/interface/follow-up.service.interface';
import { IReportTemplateService } from '../../../../settings/service/interface/report-template.service.interface';
import { GenerateReportRequestDto } from '../../dto/request/report.request.dto';
import { ReportQueryDto, UpdateReportRequestDto } from '../../dto/request/report.request.dto';
import { ReportResponseDto } from '../../dto/response/report.response.dto';
import { IReportService } from '../interface/report.service.interface';
import { IReportGenerationService } from '../interface/report-generation.service.interface';
export declare class ReportService implements IReportService {
    private readonly followUpService;
    private readonly documentService;
    private readonly reportGenerationService;
    private readonly reportTemplateService;
    private readonly approvalService;
    constructor(followUpService: IFollowUpService, documentService: IDocumentService, reportGenerationService: IReportGenerationService, reportTemplateService: IReportTemplateService, approvalService?: IApprovalService);
    generateReport(engagementId: string, dto: GenerateReportRequestDto, actor: ActorContext): Promise<ReportResponseDto>;
    updateReport(id: string, dto: UpdateReportRequestDto, actor: ActorContext): Promise<ReportResponseDto>;
    submitReportForApproval(id: string, actor: ActorContext): Promise<ReportResponseDto>;
    approveReport(id: string, actor: ActorContext): Promise<ReportResponseDto>;
    rejectReport(id: string, reason: string, actor: ActorContext): Promise<ReportResponseDto>;
    issueReport(id: string, actor: ActorContext): Promise<ReportResponseDto>;
    private _actorReportScope;
    getReport(engagementId: string, actor: ActorContext): Promise<ReportResponseDto>;
    getReportById(id: string, actor: ActorContext): Promise<ReportResponseDto>;
    listReports(query: ReportQueryDto, actor: ActorContext): Promise<{
        reports: ReportResponseDto[];
        meta: PaginationMeta;
    }>;
    exportReport(id: string, format: 'docx' | 'pdf', actor: ActorContext): Promise<ExportedAuditFile>;
    private _getReport;
    private _assertSubmittedReportHasNoApproval;
}
//# sourceMappingURL=report.service.d.ts.map