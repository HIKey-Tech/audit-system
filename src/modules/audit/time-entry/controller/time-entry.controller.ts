import { Router, Request, Response, NextFunction } from 'express';
import { authenticate } from '../../../../shared/middleware/auth.middleware';
import { validate } from '../../../../shared/middleware/validate.middleware';
import { buildResponse } from '../../../../shared/types/api-response.type';
import { LogTimeEntrySchema } from '../dto/request/time-entry.request.dto';
import { ITimeEntryService } from '../service/interface/time-entry.service.interface';

export class TimeEntryController {
  public readonly router: Router;

  constructor(private readonly timeEntryService: ITimeEntryService) {
    this.router = Router();
    this._registerRoutes();
  }

  private _registerRoutes(): void {
    this.router.use(authenticate);

    /**
     * @route  POST /audit/engagements/:id/time-entries
     * @desc   Log hours worked on an engagement (audit team only)
     * @access Private - authenticated; service enforces team membership
     */
    this.router.post('/engagements/:id/time-entries', validate(LogTimeEntrySchema), this._log.bind(this));

    /**
     * @route  GET /audit/engagements/:id/time-entries
     * @desc   Entries + planned-vs-actual summary (audit team only)
     * @access Private - authenticated; service enforces team membership
     */
    this.router.get('/engagements/:id/time-entries', this._list.bind(this));

    /**
     * @route  DELETE /audit/time-entries/:id
     * @desc   Soft-delete an entry (own entries; engagement:read_all may delete any)
     * @access Private - authenticated; service enforces ownership
     */
    this.router.delete('/time-entries/:id', this._delete.bind(this));
  }

  private async _log(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const entry = await this.timeEntryService.logTime(req.params.id, req.body, req.user!);
      res.status(201).json(buildResponse(entry, 'Time logged'));
    } catch (err) {
      next(err);
    }
  }

  private async _list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const summary = await this.timeEntryService.listForEngagement(req.params.id, req.user!);
      res.status(200).json(buildResponse(summary));
    } catch (err) {
      next(err);
    }
  }

  private async _delete(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      await this.timeEntryService.deleteEntry(req.params.id, req.user!);
      res.status(200).json(buildResponse(null, 'Time entry deleted'));
    } catch (err) {
      next(err);
    }
  }
}
