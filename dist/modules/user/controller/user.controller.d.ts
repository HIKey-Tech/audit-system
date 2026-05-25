import { Router } from 'express';
import { IUserService } from '../service/interface/user.service.interface';
export declare class UserController {
    private readonly userService;
    readonly router: Router;
    constructor(userService: IUserService);
    private _registerRoutes;
    private _getMe;
    private _updateMe;
    private _changePassword;
    private _listUsers;
    private _listRoles;
    private _listPermissions;
    private _createUser;
    private _getUserById;
    private _updateUser;
    private _deleteUser;
    private _deactivateUser;
    private _activateUser;
    private _assignRoles;
    private _removeRole;
}
//# sourceMappingURL=user.controller.d.ts.map