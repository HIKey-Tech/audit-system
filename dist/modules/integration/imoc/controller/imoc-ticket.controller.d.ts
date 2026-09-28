import { Router } from 'express';
import { IEngagementService } from '../../../audit/engagement/service/interface/engagement.service.interface';
import { IImocTicketService } from '../service/interface/imoc-ticket.service.interface';
/** HTTP boundary for the optional, read-only IMOC ticket integration. */
export declare class ImocTicketController {
    private readonly imocService;
    private readonly engagementService;
    readonly router: Router;
    constructor(imocService: IImocTicketService, engagementService: IEngagementService);
    private _registerRoutes;
    /** @route GET /integration/imoc/status @desc View non-secret IMOC availability @access integration:read */
    private _status;
    /** @route POST /integration/imoc/tickets/search @desc Search IMOC tickets read-only @access imoc:read */
    private _search;
    /** @route POST /integration/imoc/tickets/detail @desc Read one IMOC ticket @access imoc:read */
    private _detail;
    /** @route POST /integration/imoc/models/detail @desc Read safe IMOC model metadata @access imoc:read */
    private _model;
    /** @route POST /integration/imoc/sync @desc Refresh a small batch of already-linked tickets @access imoc:sync */
    private _sync;
    /** @route GET /integration/imoc/engagements/:id/tickets @desc List engagement IMOC links @access imoc:read */
    private _listLinks;
    /** @route POST /integration/imoc/engagements/:id/tickets @desc Link an existing IMOC ticket @access imoc:link */
    private _link;
    /** @route DELETE /integration/imoc/tickets/:id @desc Remove an IMOC engagement link @access imoc:link */
    private _unlink;
    /** @route POST /integration/imoc/tickets/:id/refresh @desc Refresh one existing IMOC ticket link @access imoc:sync */
    private _refresh;
    /** @route POST /integration/imoc/tickets/:id/capture @desc Capture redacted IMOC ticket snapshot as evidence @access imoc:capture */
    private _capture;
    /** @route GET /integration/imoc/tickets/:id/snapshots @desc List captured IMOC audit snapshots @access imoc:read */
    private _snapshots;
    private _assertInternalEngagementAccess;
}
//# sourceMappingURL=imoc-ticket.controller.d.ts.map