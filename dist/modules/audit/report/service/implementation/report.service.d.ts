import { IDocumentService } from '../../../../document/service/interface/document.service.interface';
import { ActorContext, ExportedAuditFile } from '../../../domain/entity/audit.entity';
import { IFollowUpService } from '../../../follow-up/service/interface/follow-up.service.interface';
import { UpdateReportRequestDto } from '../../dto/request/report.request.dto';
import { ReportResponseDto } from '../../dto/response/report.response.dto';
import { IReportService } from '../interface/report.service.interface';
export declare class ReportService implements IReportService {
    private readonly followUpService;
    private readonly documentService;
    constructor(followUpService: IFollowUpService, documentService: IDocumentService);
    generateReport(engagementId: string, actor: ActorContext): Promise<ReportResponseDto>;
    updateReport(id: string, dto: UpdateReportRequestDto, actor: ActorContext): Promise<ReportResponseDto>;
    submitReportForApproval(id: string, actor: ActorContext): Promise<ReportResponseDto>;
    approveReport(id: string, actor: ActorContext): Promise<ReportResponseDto>;
    rejectReport(id: string, reason: string, actor: ActorContext): Promise<ReportResponseDto>;
    issueReport(id: string, actor: ActorContext): Promise<ReportResponseDto>;
    getReport(engagementId: string): Promise<ReportResponseDto>;
    exportReport(id: string): Promise<ExportedAuditFile>;
    private _getReport;
    private _notifyAuditAdmins;
}
//# sourceMappingURL=report.service.d.ts.map