import { Router, Request, Response, NextFunction } from 'express';
import { authenticate, requirePermission } from '../../../../shared/middleware/auth.middleware';
import { validate } from '../../../../shared/middleware/validate.middleware';
import { buildResponse } from '../../../../shared/types/api-response.type';
import {
  CreateRiskCategoryRequestSchema,
  RiskCategoryQuerySchema,
  UpdateRiskCategoryRequestSchema,
} from '../dto/request/category.request.dto';
import { ICategoryService } from '../service/interface/category.service.interface';

export class CategoryController {
  public readonly router: Router;

  constructor(private readonly categoryService: ICategoryService) {
    this.router = Router();
    this._registerRoutes();
  }

  private _registerRoutes(): void {
    this.router.use(authenticate);

    /**
     * @route  POST /risk/categories
     * @desc   Create risk category
     * @access Private - audit:write
     */
    this.router.post('/', requirePermission('risk_category:write'), validate(CreateRiskCategoryRequestSchema), this._createCategory.bind(this));

    /**
     * @route  GET /risk/categories
     * @desc   List risk categories
     * @access Private - audit:read
     */
    this.router.get('/', requirePermission('risk_category:read'), validate(RiskCategoryQuerySchema, 'query'), this._listCategories.bind(this));

    /**
     * @route  PUT /risk/categories/:id
     * @desc   Update risk category
     * @access Private - audit:write
     */
    this.router.put('/:id', requirePermission('risk_category:write'), validate(UpdateRiskCategoryRequestSchema), this._updateCategory.bind(this));

    /**
     * @route  DELETE /risk/categories/:id
     * @desc   Deactivate risk category
     * @access Private - audit:write
     */
    this.router.delete('/:id', requirePermission('risk_category:delete'), this._deactivateCategory.bind(this));
  }

  private async _createCategory(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const category = await this.categoryService.createCategory(req.body, req.user!);
      res.status(201).json(buildResponse(category, 'Risk category created'));
    } catch (err) {
      next(err);
    }
  }

  private async _updateCategory(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const category = await this.categoryService.updateCategory(req.params.id, req.body, req.user!);
      res.status(200).json(buildResponse(category, 'Risk category updated'));
    } catch (err) {
      next(err);
    }
  }

  private async _deactivateCategory(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      await this.categoryService.deactivateCategory(req.params.id, req.user!);
      res.status(200).json(buildResponse(null, 'Risk category deactivated'));
    } catch (err) {
      next(err);
    }
  }

  private async _listCategories(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const categories = await this.categoryService.listCategories(req.query as never);
      res.status(200).json(buildResponse(categories));
    } catch (err) {
      next(err);
    }
  }
}
