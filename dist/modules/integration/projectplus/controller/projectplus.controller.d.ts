import { Router } from 'express';
import { IEngagementService } from '../../../audit/engagement/service/interface/engagement.service.interface';
import { IProjectPlusLinkService } from '../service/interface/projectplus-link.service.interface';
import { IProjectPlusService } from '../service/interface/projectplus.service.interface';
/** HTTP boundary for the optional, read-only Project Plus integration. GET routes only. */
export declare class ProjectPlusController {
    private readonly service;
    private readonly linkService;
    private readonly engagementService;
    readonly router: Router;
    constructor(service: IProjectPlusService, linkService: IProjectPlusLinkService, engagementService: IEngagementService);
    private _registerRoutes;
    /**
     * @route GET /integration/projectplus/status
     * @desc Whether Project Plus is enabled and configured (no network call)
     * @access integration:read
     */
    private _status;
    /**
     * @route GET /integration/projectplus/status/check
     * @desc Live reachability/authentication check against the gateway
     * @access integration:read
     */
    private _checkStatus;
    /**
     * @route GET /integration/projectplus/entities?customerType=&search=&status=&page=&pageSize=
     * @desc Read-only lookup of Project Plus customers / vendors / clients
     * @access projectplus:read
     */
    private _entities;
    /**
     * @route GET /integration/projectplus/document-types
     * @desc Contract document type reference list
     * @access projectplus:read
     */
    private _documentTypes;
    /**
     * @route GET /integration/projectplus/engagements/:id/entities
     * @desc Project Plus entities linked to an engagement
     * @access projectplus:read
     */
    private _listLinks;
    /**
     * @route POST /integration/projectplus/engagements/:id/entities
     * @desc Optionally link a Project Plus entity to an engagement
     * @access projectplus:link
     */
    private _link;
    /**
     * @route DELETE /integration/projectplus/entity-links/:id
     * @desc Remove an engagement link (Project Plus itself is untouched)
     * @access projectplus:link
     */
    private _unlink;
    private _assertInternalEngagementAccess;
}
//# sourceMappingURL=projectplus.controller.d.ts.map