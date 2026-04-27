import { Router } from 'express';
import { IReportService } from '../service/interface/report.service.interface';
export declare class ReportController {
    private readonly reportService;
    readonly router: Router;
    constructor(reportService: IReportService);
    private _registerRoutes;
    private _generateReport;
    private _updateReport;
    private _submitReportForApproval;
    private _approveReport;
    private _rejectReport;
    private _issueReport;
    private _getReport;
    private _exportReport;
}
//# sourceMappingURL=report.controller.d.ts.map