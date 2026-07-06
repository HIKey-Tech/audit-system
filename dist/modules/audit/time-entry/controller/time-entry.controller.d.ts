import { Router } from 'express';
import { ITimeEntryService } from '../service/interface/time-entry.service.interface';
export declare class TimeEntryController {
    private readonly timeEntryService;
    readonly router: Router;
    constructor(timeEntryService: ITimeEntryService);
    private _registerRoutes;
    private _log;
    private _list;
    private _delete;
}
//# sourceMappingURL=time-entry.controller.d.ts.map