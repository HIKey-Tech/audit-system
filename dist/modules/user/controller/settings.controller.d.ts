import { Router } from 'express';
import { IUserService } from '../service/interface/user.service.interface';
export declare class SettingsController {
    private readonly userService;
    readonly router: Router;
    constructor(userService: IUserService);
    private _registerRoutes;
    private _listRoles;
    private _getRoleById;
    private _createRole;
    private _updateRole;
    private _deleteRole;
    private _replaceRolePermissions;
    private _listPermissionsGroupedByModule;
}
//# sourceMappingURL=settings.controller.d.ts.map