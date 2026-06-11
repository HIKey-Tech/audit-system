import { Router } from 'express';
import { IMfaService } from '../service/interface/mfa.service.interface';
import { IAuthService } from '../service/interface/auth.service.interface';
export declare class MfaController {
    private readonly mfaService;
    private readonly authService;
    readonly router: Router;
    constructor(mfaService: IMfaService, authService: IAuthService);
    private _registerRoutes;
    private _setup;
    private _enroll;
    private _verify;
    private _regenerateBackupCodes;
    private _adminReset;
}
//# sourceMappingURL=mfa.controller.d.ts.map