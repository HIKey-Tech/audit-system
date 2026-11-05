import { NextFunction, Request, Response, Router } from 'express';
import { authenticate, requirePermission } from '../../../../shared/middleware/auth.middleware';
import { validate } from '../../../../shared/middleware/validate.middleware';
import { buildResponse } from '../../../../shared/types/api-response.type';
import { AppError } from '../../../../shared/errors/app.error';
import { IEngagementService } from '../../../audit/engagement/service/interface/engagement.service.interface';
import { IProjectPlusLinkService } from '../service/interface/projectplus-link.service.interface';
import { IProjectPlusService } from '../service/interface/projectplus.service.interface';
import { LinkProjectPlusEntitySchema, ListProjectPlusEntitiesQuerySchema, ListProjectPlusEntitiesQuery } from '../dto/request/projectplus.request.dto';

/** HTTP boundary for the optional, read-only Project Plus integration. GET routes only. */
export class ProjectPlusController {
  public readonly router: Router = Router();

  constructor(
    private readonly service: IProjectPlusService,
    private readonly linkService: IProjectPlusLinkService,
    private readonly engagementService: IEngagementService,
  ) {
    this._registerRoutes();
  }

  private _registerRoutes(): void {
    this.router.use(authenticate);
    this.router.get('/status', requirePermission('integration:read'), this._status.bind(this));
    this.router.get('/status/check', requirePermission('integration:read'), this._checkStatus.bind(this));
    this.router.get('/entities', requirePermission('projectplus:read'), validate(ListProjectPlusEntitiesQuerySchema, 'query'), this._entities.bind(this));
    this.router.get('/document-types', requirePermission('projectplus:read'), this._documentTypes.bind(this));

    // Optional engagement links
    this.router.get('/engagements/:id/entities', requirePermission('projectplus:read'), this._listLinks.bind(this));
    this.router.post('/engagements/:id/entities', requirePermission('projectplus:link'), validate(LinkProjectPlusEntitySchema), this._link.bind(this));
    this.router.delete('/entity-links/:id', requirePermission('projectplus:link'), this._unlink.bind(this));
  }

  /**
   * @route GET /integration/projectplus/status
   * @desc Whether Project Plus is enabled and configured (no network call)
   * @access integration:read
   */
  private async _status(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      res.json(buildResponse(this.service.getStatus(), 'Project Plus status retrieved'));
    } catch (err) { next(err); }
  }

  /**
   * @route GET /integration/projectplus/status/check
   * @desc Live reachability/authentication check against the gateway
   * @access integration:read
   */
  private async _checkStatus(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      res.json(buildResponse(await this.service.checkStatus(), 'Project Plus status checked'));
    } catch (err) { next(err); }
  }

  /**
   * @route GET /integration/projectplus/entities?customerType=&search=&status=&page=&pageSize=
   * @desc Read-only lookup of Project Plus customers / vendors / clients
   * @access projectplus:read
   */
  private async _entities(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const query = req.query as unknown as ListProjectPlusEntitiesQuery;
      const result = await this.service.listEntities(query);
      const totalPages = Math.max(1, Math.ceil(result.total / result.pageSize));
      res.json(buildResponse(result.items, 'Project Plus entities retrieved', {
        page: result.page,
        pageSize: result.pageSize,
        total: result.total,
        totalPages,
        hasNext: result.page < totalPages,
        hasPrev: result.page > 1,
      }));
    } catch (err) { next(err); }
  }

  /**
   * @route GET /integration/projectplus/document-types
   * @desc Contract document type reference list
   * @access projectplus:read
   */
  private async _documentTypes(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      res.json(buildResponse(await this.service.getContractDocumentTypes(), 'Document types retrieved'));
    } catch (err) { next(err); }
  }

  /**
   * @route GET /integration/projectplus/engagements/:id/entities
   * @desc Project Plus entities linked to an engagement
   * @access projectplus:read
   */
  private async _listLinks(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      await this._assertInternalEngagementAccess(req.params.id, req.user!);
      res.json(buildResponse(await this.linkService.listLinks(req.params.id, req.user!)));
    } catch (err) { next(err); }
  }

  /**
   * @route POST /integration/projectplus/engagements/:id/entities
   * @desc Optionally link a Project Plus entity to an engagement
   * @access projectplus:link
   */
  private async _link(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      await this._assertInternalEngagementAccess(req.params.id, req.user!);
      const link = await this.linkService.linkEntity(req.params.id, req.body, req.user!);
      res.status(201).json(buildResponse(link, 'Project Plus entity linked to engagement'));
    } catch (err) { next(err); }
  }

  /**
   * @route DELETE /integration/projectplus/entity-links/:id
   * @desc Remove an engagement link (Project Plus itself is untouched)
   * @access projectplus:link
   */
  private async _unlink(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const link = await this.linkService.getLink(req.params.id);
      await this._assertInternalEngagementAccess(link.engagementId, req.user!);
      await this.linkService.unlinkEntity(req.params.id, req.user!);
      res.json(buildResponse(null, 'Project Plus entity unlinked from engagement'));
    } catch (err) { next(err); }
  }

  private async _assertInternalEngagementAccess(engagementId: string, actor: NonNullable<Request['user']>): Promise<void> {
    const engagement = await this.engagementService.getEngagementById(engagementId, actor);
    if (engagement.viewerContext?.role === 'auditee') {
      throw AppError.forbidden('Auditees cannot access internally linked Project Plus data.');
    }
  }
}
