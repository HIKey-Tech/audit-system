// src/modules/user/controller/settings.controller.ts
import { Router, Request, Response, NextFunction } from 'express';
import { authenticate, requirePermission } from '../../../shared/middleware/auth.middleware';
import { validate } from '../../../shared/middleware/validate.middleware';
import { buildResponse } from '../../../shared/types/api-response.type';
import { IUserService } from '../service/interface/user.service.interface';
import {
  CreateRoleRequestSchema,
  UpdateRoleRequestSchema,
  ReplaceRolePermissionsRequestSchema,
} from '../dto/request/user.request.dto';

export class SettingsController {
  public readonly router: Router;

  constructor(private readonly userService: IUserService) {
    this.router = Router();
    this._registerRoutes();
  }

  private _registerRoutes(): void {
    this.router.use(authenticate);

    /**
     * @route  GET /settings/roles
     * @desc   List all roles with permissions
     * @access Private - settings:read
     */
    this.router.get(
      '/roles',
      requirePermission('settings:read'),
      this._listRoles.bind(this),
    );

    /**
     * @route  GET /settings/roles/:id
     * @desc   Get a role by ID
     * @access Private - settings:read
     */
    this.router.get(
      '/roles/:id',
      requirePermission('settings:read'),
      this._getRoleById.bind(this),
    );

    /**
     * @route  POST /settings/roles
     * @desc   Create a role
     * @access Private - settings:manage
     */
    this.router.post(
      '/roles',
      requirePermission('settings:manage'),
      validate(CreateRoleRequestSchema),
      this._createRole.bind(this),
    );

    /**
     * @route  PUT /settings/roles/:id
     * @desc   Update a role name or description
     * @access Private - settings:manage
     */
    this.router.put(
      '/roles/:id',
      requirePermission('settings:manage'),
      validate(UpdateRoleRequestSchema),
      this._updateRole.bind(this),
    );

    /**
     * @route  DELETE /settings/roles/:id
     * @desc   Delete a role if it is not system-owned or assigned
     * @access Private - settings:manage
     */
    this.router.delete(
      '/roles/:id',
      requirePermission('settings:manage'),
      this._deleteRole.bind(this),
    );

    /**
     * @route  PUT /settings/roles/:id/permissions
     * @desc   Replace all permissions on a role
     * @access Private - settings:manage
     */
    this.router.put(
      '/roles/:id/permissions',
      requirePermission('settings:manage'),
      validate(ReplaceRolePermissionsRequestSchema),
      this._replaceRolePermissions.bind(this),
    );

    /**
     * @route  GET /settings/permissions
     * @desc   List permissions grouped by module
     * @access Private - settings:read
     */
    this.router.get(
      '/permissions',
      requirePermission('settings:read'),
      this._listPermissionsGroupedByModule.bind(this),
    );
  }

  private async _listRoles(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { roles } = await this.userService.listRoles({
        page: 1,
        pageSize: 100,
        sortBy: 'name',
        sortOrder: 'asc',
      });
      res.status(200).json(buildResponse(roles));
    } catch (err) {
      next(err);
    }
  }

  private async _getRoleById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const role = await this.userService.getRoleById(req.params.id);
      res.status(200).json(buildResponse(role));
    } catch (err) {
      next(err);
    }
  }

  private async _createRole(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const role = await this.userService.createRole(req.body, req.user!.id);
      res.status(201).json(buildResponse(role, 'Role created'));
    } catch (err) {
      next(err);
    }
  }

  private async _updateRole(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const role = await this.userService.updateRole(req.params.id, req.body, req.user!.id);
      res.status(200).json(buildResponse(role, 'Role updated'));
    } catch (err) {
      next(err);
    }
  }

  private async _deleteRole(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      await this.userService.deleteRole(req.params.id, req.user!.id);
      res.status(200).json(buildResponse(null, 'Role deleted'));
    } catch (err) {
      next(err);
    }
  }

  private async _replaceRolePermissions(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const role = await this.userService.replaceRolePermissions(
        req.params.id,
        req.body,
        req.user!.id,
      );
      res.status(200).json(buildResponse(role, 'Role permissions updated'));
    } catch (err) {
      next(err);
    }
  }

  private async _listPermissionsGroupedByModule(
    _req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const permissions = await this.userService.listPermissionsGroupedByModule();
      res.status(200).json(buildResponse(permissions));
    } catch (err) {
      next(err);
    }
  }
}
