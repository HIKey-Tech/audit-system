// src/modules/user/index.ts
import { Router } from 'express';
import { UserService } from './service/implementation/user.service';
import { AuthService } from './service/implementation/auth.service';
import { AuthController } from './controller/auth.controller';
import { UserController } from './controller/user.controller';

// Side-effect imports — register OpenAPI paths with the shared registry.
import './docs/auth.docs';
import './docs/user.docs';

export const createUserModule = (): Router => {
  const router = Router();

  // Dependency wiring
  const userService = new UserService();
  const authService = new AuthService(userService);

  // Controllers
  const authController = new AuthController(authService);
  const userController = new UserController(userService);

  // Mount
  router.use('/auth', authController.router);
  router.use('/users', userController.router);

  return router;
};

// Re-export for use in other modules
export { UserService } from './service/implementation/user.service';
export { AuthService } from './service/implementation/auth.service';
export type { IUserService } from './service/interface/user.service.interface';
export type { IAuthService } from './service/interface/auth.service.interface';
