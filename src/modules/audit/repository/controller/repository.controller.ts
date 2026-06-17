import { Router, Request, Response, NextFunction } from 'express';
import { authenticate, requirePermission } from '../../../../shared/middleware/auth.middleware';
import { validate } from '../../../../shared/middleware/validate.middleware';
import { buildResponse } from '../../../../shared/types/api-response.type';
import { RepositoryQuerySchema } from '../dto/request/repository.request.dto';
import { IRepositoryService } from '../service/interface/repository.service.interface';

export class RepositoryController {
  public readonly router: Router;

  constructor(private readonly repositoryService: IRepositoryService) {
    this.router = Router();
    this._registerRoutes();
  }

  private _registerRoutes(): void {
    this.router.use(authenticate);

    /**
     * @route  GET /audit/repository
     * @desc   Centralized audit repository — all audit records, supporting
     *         documents and evidence in one paginated list. Use the `category`
     *         query param as the dropdown filter.
     * @access Private - engagement:read
     */
    this.router.get('/repository', requirePermission('engagement:read'), validate(RepositoryQuerySchema, 'query'), this._list.bind(this));

    /**
     * @route  GET /audit/repository/:id/download
     * @desc   Stream a single repository item for download
     * @access Private - engagement:read
     */
    this.router.get('/repository/:id/download', requirePermission('engagement:read'), this._download.bind(this));
  }

  private async _list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { items, meta } = await this.repositoryService.list(req.query as never, req.user!);
      res.status(200).json(buildResponse(items, 'Success', meta));
    } catch (err) {
      next(err);
    }
  }

  private async _download(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const file = await this.repositoryService.getFile(req.params.id, req.user!);
      // RFC 5987 encoding keeps non-ASCII filenames intact for browsers.
      const encodedName = encodeURIComponent(file.originalName);
      res.setHeader('Content-Type', file.mimeType);
      res.setHeader('Content-Length', file.fileSize);
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="${encodedName}"; filename*=UTF-8''${encodedName}`,
      );
      res.status(200).send(file.buffer);
    } catch (err) {
      next(err);
    }
  }
}
