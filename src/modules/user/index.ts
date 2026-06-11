// src/modules/user/index.ts
import { Router } from 'express';
import { UserService } from './service/implementation/user.service';
import { AuthService } from './service/implementation/auth.service';
import { PasswordResetService } from './service/implementation/password-reset.service';
import { MfaService } from './service/implementation/mfa.service';
import { AuthController } from './controller/auth.controller';
import { MfaController } from './controller/mfa.controller';
import { UserController } from './controller/user.controller';
import { notificationQueueService } from '../messaging/service/implementation/notification-queue.service';

// Side-effect imports — register OpenAPI paths with the shared registry.
import './docs/auth.docs';
import './docs/user.docs';

export const createUserModule = (): Router => {
  const router = Router();

  // Dependency wiring
  const userService = new UserService();
  const mfaService = new MfaService(notificationQueueService);
  const authService = new AuthService(userService, mfaService);
  const passwordResetService = new PasswordResetService(notificationQueueService);

  // Controllers
  const authController = new AuthController(authService, passwordResetService);
  const mfaController = new MfaController(mfaService, authService);
  const userController = new UserController(userService);

  // Mount — /auth/2fa must precede /auth so its routes resolve first.
  router.use('/auth/2fa', mfaController.router);
  router.use('/auth', authController.router);
  router.use('/users', userController.router);

  return router;
};

// Re-export for use in other modules
export { UserService } from './service/implementation/user.service';
export { AuthService } from './service/implementation/auth.service';
export type { IUserService } from './service/interface/user.service.interface';
export type { IAuthService } from './service/interface/auth.service.interface';
