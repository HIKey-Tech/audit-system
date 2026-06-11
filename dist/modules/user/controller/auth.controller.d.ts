import { Router } from 'express';
import { IAuthService } from '../service/interface/auth.service.interface';
import { IPasswordResetService } from '../service/interface/password-reset.service.interface';
export declare class AuthController {
    private readonly authService;
    private readonly passwordResetService;
    readonly router: Router;
    constructor(authService: IAuthService, passwordResetService: IPasswordResetService);
    private _registerRoutes;
    private _login;
    private _ssoInitiate;
    private _ssoCallback;
    private _forgotPassword;
    private _resetPassword;
    private _refresh;
    private _logout;
    private _logoutAll;
}
//# sourceMappingURL=auth.controller.d.ts.map