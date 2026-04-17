// src/modules/user/controller/user.controller.ts
import { Router, Request, Response, NextFunction } from 'express';
import { authenticate, requirePermission } from '../../../shared/middleware/auth.middleware';
import { validate } from '../../../shared/middleware/validate.middleware';
import { buildResponse } from '../../../shared/types/api-response.type';
import { IUserService } from '../service/interface/user.service.interface';
import {
  CreateUserRequestSchema,
  UpdateUserRequestSchema,
  AssignRoleRequestSchema,
  ChangePasswordRequestSchema,
  UserQuerySchema,
} from '../dto/request/user.request.dto';

export class UserController {
  public readonly router: Router;

  constructor(private readonly userService: IUserService) {
    this.router = Router();
    this._registerRoutes();
  }

  private _registerRoutes(): void {
    // All user routes require authentication
    this.router.use(authenticate);

    /**
     * @route  GET /users/me
     * @desc   Get own profile
     * @access Private
     */
    this.router.get('/me', this._getMe.bind(this));

    /**
     * @route  PATCH /users/me
     * @desc   Update own profile
     * @access Private
     */
    this.router.patch(
      '/me',
      validate(UpdateUserRequestSchema),
      this._updateMe.bind(this),
    );

    /**
     * @route  POST /users/me/change-password
     * @desc   Change own password
     * @access Private
     */
    this.router.post(
      '/me/change-password',
      validate(ChangePasswordRequestSchema),
      this._changePassword.bind(this),
    );

    /**
     * @route  GET /users
     * @desc   List all users (paginated)
     * @access Private — user:read
     */
    this.router.get(
      '/',
      requirePermission('user:read'),
      validate(UserQuerySchema, 'query'),
      this._listUsers.bind(this),
    );

    /**
     * @route  POST /users
     * @desc   Create a user
     * @access Private — user:write
     */
    this.router.post(
      '/',
      requirePermission('user:write'),
      validate(CreateUserRequestSchema),
      this._createUser.bind(this),
    );

    /**
     * @route  GET /users/:id
     * @desc   Get user by ID
     * @access Private — user:read
     */
    this.router.get(
      '/:id',
      requirePermission('user:read'),
      this._getUserById.bind(this),
    );

    /**
     * @route  PATCH /users/:id
     * @desc   Update user by ID
     * @access Private — user:write
     */
    this.router.patch(
      '/:id',
      requirePermission('user:write'),
      validate(UpdateUserRequestSchema),
      this._updateUser.bind(this),
    );

    /**
     * @route  DELETE /users/:id
     * @desc   Soft-delete user
     * @access Private — user:delete
     */
    this.router.delete(
      '/:id',
      requirePermission('user:delete'),
      this._deleteUser.bind(this),
    );

    /**
     * @route  PUT /users/:id/roles
     * @desc   Assign roles to user
     * @access Private — user:admin
     */
    this.router.put(
      '/:id/roles',
      requirePermission('user:admin'),
      validate(AssignRoleRequestSchema),
      this._assignRoles.bind(this),
    );

    /**
     * @route  DELETE /users/:id/roles/:roleId
     * @desc   Remove role from user
     * @access Private — user:admin
     */
    this.router.delete(
      '/:id/roles/:roleId',
      requirePermission('user:admin'),
      this._removeRole.bind(this),
    );
  }

  private async _getMe(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = await this.userService.getUserById(req.user!.id);
      res.status(200).json(buildResponse(user));
    } catch (err) {
      next(err);
    }
  }

  private async _updateMe(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = await this.userService.updateUser(
        req.user!.id,
        req.body,
        req.user!.id,
      );
      res.status(200).json(buildResponse(user, 'Profile updated'));
    } catch (err) {
      next(err);
    }
  }

  private async _changePassword(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      await this.userService.changePassword(req.user!.id, req.body);
      res.status(200).json(buildResponse(null, 'Password changed successfully'));
    } catch (err) {
      next(err);
    }
  }

  private async _listUsers(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { users, meta } = await this.userService.listUsers(req.query as never);
      res.status(200).json({ ...buildResponse(users), meta });
    } catch (err) {
      next(err);
    }
  }

  private async _createUser(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = await this.userService.createUser(req.body, req.user!.id);
      res.status(201).json(buildResponse(user, 'User created successfully'));
    } catch (err) {
      next(err);
    }
  }

  private async _getUserById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = await this.userService.getUserById(req.params.id);
      res.status(200).json(buildResponse(user));
    } catch (err) {
      next(err);
    }
  }

  private async _updateUser(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = await this.userService.updateUser(
        req.params.id,
        req.body,
        req.user!.id,
      );
      res.status(200).json(buildResponse(user, 'User updated'));
    } catch (err) {
      next(err);
    }
  }

  private async _deleteUser(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      await this.userService.deleteUser(req.params.id, req.user!.id);
      res.status(200).json(buildResponse(null, 'User deleted'));
    } catch (err) {
      next(err);
    }
  }

  private async _assignRoles(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = await this.userService.assignRoles(
        req.params.id,
        req.body,
        req.user!.id,
      );
      res.status(200).json(buildResponse(user, 'Roles assigned'));
    } catch (err) {
      next(err);
    }
  }

  private async _removeRole(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = await this.userService.removeRole(
        req.params.id,
        req.params.roleId,
        req.user!.id,
      );
      res.status(200).json(buildResponse(user, 'Role removed'));
    } catch (err) {
      next(err);
    }
  }
}
