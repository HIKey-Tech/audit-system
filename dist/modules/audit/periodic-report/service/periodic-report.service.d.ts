import type { AuthenticatedUser } from '../../../../shared/middleware/auth.middleware';
import type { PeriodicReportQueryDto, PeriodicReportResponseDto } from '../dto/periodic-report.dto';
export declare class PeriodicReportService {
    private _computePeriod;
    private _auditTypeWhere;
    getPeriodicReport(query: PeriodicReportQueryDto, actor: AuthenticatedUser): Promise<PeriodicReportResponseDto>;
    private _resolveApprovals;
    exportPeriodicReport(query: PeriodicReportQueryDto, format: 'docx' | 'pdf', actor: AuthenticatedUser): Promise<{
        fileName: string;
        mimeType: string;
        buffer: Buffer;
    }>;
    private _docxHeaderCell;
    private _docxBodyCell;
    private _docxTable;
    private _docxSectionHeading;
    private _generateDocx;
    private _generatePdf;
}
//# sourceMappingURL=periodic-report.service.d.ts.map