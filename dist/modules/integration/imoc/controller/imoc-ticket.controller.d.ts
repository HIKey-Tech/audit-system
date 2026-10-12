import { Router } from 'express';
import { IEngagementService } from '../../../audit/engagement/service/interface/engagement.service.interface';
import { IImocTicketService } from '../service/interface/imoc-ticket.service.interface';
import { IImocIngestionService } from '../service/interface/imoc-ingestion.service.interface';
import { IImocStoreService } from '../service/interface/imoc-store.service.interface';
/** HTTP boundary for IMOC integration: ticket search, linking, ingestion rules, local store, saved views, and risk links. */
export declare class ImocTicketController {
    private readonly imocService;
    private readonly engagementService;
    private readonly ingestionService;
    private readonly storeService;
    readonly router: Router;
    constructor(imocService: IImocTicketService, engagementService: IEngagementService, ingestionService?: IImocIngestionService, storeService?: IImocStoreService);
    private _registerRoutes;
    private _status;
    private _checkStatus;
    private _search;
    private _detail;
    private _model;
    private _sync;
    private _listRules;
    private _createRule;
    private _getRule;
    private _updateRule;
    private _toggleRule;
    private _deleteRule;
    private _previewRule;
    private _runIngestion;
    private _listRuns;
    private _getRun;
    private _listStoredTickets;
    private _storedSummary;
    private _getStoredTicket;
    private _exportStoredTickets;
    private _listViews;
    private _createView;
    private _updateView;
    private _deleteView;
    private _linkRisk;
    private _unlinkRisk;
    private _listLinks;
    private _link;
    private _unlink;
    private _refresh;
    private _capture;
    private _snapshots;
    private _assertInternalEngagementAccess;
}
//# sourceMappingURL=imoc-ticket.controller.d.ts.map