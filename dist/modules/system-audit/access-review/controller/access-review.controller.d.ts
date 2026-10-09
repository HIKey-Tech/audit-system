import { Router } from 'express';
import { IAccessReviewService } from '../service/interface/access-review.service.interface';
export declare class AccessReviewController {
    private readonly accessReviewService;
    readonly router: Router;
    constructor(accessReviewService: IAccessReviewService);
    private _registerRoutes;
    private _listItems;
    private _exportItems;
    private _decide;
}
//# sourceMappingURL=access-review.controller.d.ts.map