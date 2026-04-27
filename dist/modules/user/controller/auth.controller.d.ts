import { Router } from 'express';
import { IAuthService } from '../service/interface/auth.service.interface';
export declare class AuthController {
    private readonly authService;
    readonly router: Router;
    constructor(authService: IAuthService);
    private _registerRoutes;
    private _login;
    private _ssoInitiate;
    private _ssoCallback;
    private _refresh;
    private _logout;
    private _logoutAll;
}
//# sourceMappingURL=auth.controller.d.ts.map