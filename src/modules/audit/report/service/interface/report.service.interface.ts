import { PaginationMeta } from '../../../../../shared/types/api-response.type';
import { ActorContext, ExportedAuditFile } from '../../../domain/entity/audit.entity';
import { ReportQueryDto, UpdateReportRequestDto } from '../../dto/request/report.request.dto';
import { ReportResponseDto } from '../../dto/response/report.response.dto';

export interface IReportService {
  generateReport(engagementId: string, dto: UpdateReportRequestDto, actor: ActorContext): Promise<ReportResponseDto>;
  updateReport(id: string, dto: UpdateReportRequestDto, actor: ActorContext): Promise<ReportResponseDto>;
  submitReportForApproval(id: string, actor: ActorContext): Promise<ReportResponseDto>;
  approveReport(id: string, actor: ActorContext): Promise<ReportResponseDto>;
  rejectReport(id: string, reason: string, actor: ActorContext): Promise<ReportResponseDto>;
  issueReport(id: string, actor: ActorContext): Promise<ReportResponseDto>;
  getReport(engagementId: string): Promise<ReportResponseDto>;
  getReportById(id: string): Promise<ReportResponseDto>;
  listReports(query: ReportQueryDto): Promise<{ reports: ReportResponseDto[]; meta: PaginationMeta }>;
  exportReport(id: string, format: 'docx' | 'pdf'): Promise<ExportedAuditFile>;
}
