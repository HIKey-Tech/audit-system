import { Router } from 'express';
import { ISystemConfigService } from '../service/interface/system-config.service.interface';
export declare class SystemConfigController {
    private readonly configService;
    readonly router: Router;
    constructor(configService: ISystemConfigService);
    private _registerRoutes;
    private _getAllConfig;
    private _getPublicConfig;
    private _getConfig;
    private _updateConfig;
    private _bulkUpdateConfig;
}
//# sourceMappingURL=system-config.controller.d.ts.map