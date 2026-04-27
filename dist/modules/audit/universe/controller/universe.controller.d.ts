import { Router } from 'express';
import { IUniverseService } from '../service/interface/universe.service.interface';
export declare class UniverseController {
    private readonly universeService;
    readonly router: Router;
    constructor(universeService: IUniverseService);
    private _registerRoutes;
    private _createEntity;
    private _updateEntity;
    private _deactivateEntity;
    private _getEntityById;
    private _listEntities;
}
//# sourceMappingURL=universe.controller.d.ts.map