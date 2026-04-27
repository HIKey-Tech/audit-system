import { Router } from 'express';
import { ICategoryService } from '../service/interface/category.service.interface';
export declare class CategoryController {
    private readonly categoryService;
    readonly router: Router;
    constructor(categoryService: ICategoryService);
    private _registerRoutes;
    private _createCategory;
    private _updateCategory;
    private _deactivateCategory;
    private _listCategories;
}
//# sourceMappingURL=category.controller.d.ts.map