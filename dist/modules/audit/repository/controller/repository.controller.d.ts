import { Router } from 'express';
import { IRepositoryService } from '../service/interface/repository.service.interface';
export declare class RepositoryController {
    private readonly repositoryService;
    readonly router: Router;
    constructor(repositoryService: IRepositoryService);
    private _registerRoutes;
    private _list;
    private _download;
}
//# sourceMappingURL=repository.controller.d.ts.map