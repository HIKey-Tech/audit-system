import { Router } from 'express';
import { ISystemAuditAnalyticsService } from '../service/interface/analytics.service.interface';
export declare class SystemAuditAnalyticsController {
    private readonly analyticsService;
    readonly router: Router;
    constructor(analyticsService: ISystemAuditAnalyticsService);
    private _registerRoutes;
    private _listTypes;
    private _preview;
    private _runUpload;
    private _runLive;
    private _listRuns;
    private _getRun;
    private _listExceptions;
    private _exportExceptions;
    private _downloadExtract;
    private _disposition;
    private _raiseFinding;
    private _markBaseline;
    private _completeReview;
}
//# sourceMappingURL=analytics.controller.d.ts.map