// src/modules/user/controller/auth.controller.ts
import { Router, Request, Response, NextFunction } from 'express';
import { validate } from '../../../shared/middleware/validate.middleware';
import { authenticate } from '../../../shared/middleware/auth.middleware';
import { buildResponse } from '../../../shared/types/api-response.type';
import { IAuthService } from '../service/interface/auth.service.interface';
import { IPasswordResetService } from '../service/interface/password-reset.service.interface';
import {
  LoginRequestSchema,
  RefreshTokenRequestSchema,
  OidcCallbackRequestSchema,
  ForgotPasswordRequestSchema,
  ResetPasswordRequestSchema,
} from '../dto/request/auth.request.dto';

export class AuthController {
  public readonly router: Router;

  constructor(
    private readonly authService: IAuthService,
    private readonly passwordResetService: IPasswordResetService,
  ) {
    this.router = Router();
    this._registerRoutes();
  }

  private _registerRoutes(): void {
    /**
     * @route  POST /auth/login
     * @desc   Authenticate with email + password
     * @access Public
     */
    this.router.post(
      '/login',
      validate(LoginRequestSchema),
      this._login.bind(this),
    );

    /**
     * @route  GET /auth/sso
     * @desc   Initiate SSO — returns authorization URL
     * @access Public
     */
    this.router.get('/sso', this._ssoInitiate.bind(this));

    /**
     * @route  GET /auth/callback
     * @desc   OIDC callback — exchange code for tokens
     * @access Public
     */
    this.router.get(
      '/callback',
      validate(OidcCallbackRequestSchema, 'query'),
      this._ssoCallback.bind(this),
    );

    /**
     * @route  POST /auth/forgot-password
     * @desc   Request a password-reset link for an active local account
     * @access Public
     */
    this.router.post(
      '/forgot-password',
      validate(ForgotPasswordRequestSchema),
      this._forgotPassword.bind(this),
    );

    /**
     * @route  POST /auth/reset-password
     * @desc   Set a new password using a reset token
     * @access Public
     */
    this.router.post(
      '/reset-password',
      validate(ResetPasswordRequestSchema),
      this._resetPassword.bind(this),
    );

    /**
     * @route  POST /auth/refresh
     * @desc   Refresh access token
     * @access Public
     */
    this.router.post(
      '/refresh',
      validate(RefreshTokenRequestSchema),
      this._refresh.bind(this),
    );

    /**
     * @route  POST /auth/logout
     * @desc   Revoke refresh token
     * @access Private
     */
    this.router.post(
      '/logout',
      authenticate,
      validate(RefreshTokenRequestSchema),
      this._logout.bind(this),
    );

    /**
     * @route  POST /auth/logout-all
     * @desc   Revoke all refresh tokens for the authenticated user
     * @access Private
     */
    this.router.post(
      '/logout-all',
      authenticate,
      this._logoutAll.bind(this),
    );
  }

  private async _login(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await this.authService.login(
        req.body,
        req.ip,
        req.headers['user-agent'],
      );
      const message =
        result.status === 'MFA_REQUIRED'
          ? 'Two-factor verification required'
          : result.status === 'MFA_ENROLLMENT_REQUIRED'
            ? 'Two-factor enrolment required'
            : 'Login successful';
      res.status(200).json(buildResponse(result, message));
    } catch (err) {
      next(err);
    }
  }

  private async _ssoInitiate(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await this.authService.getSsoAuthorizationUrl();
      res.status(200).json(buildResponse(result, 'SSO authorization URL generated'));
    } catch (err) {
      next(err);
    }
  }

  private async _ssoCallback(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { code, state } = req.query as { code: string; state: string };
      const result = await this.authService.handleOidcCallback(
        code,
        state,
        req.ip,
        req.headers['user-agent'],
      );
      res.status(200).json(buildResponse(result, 'SSO authentication successful'));
    } catch (err) {
      next(err);
    }
  }

  private async _forgotPassword(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      await this.passwordResetService.requestReset(req.body.email, req.ip);
      res.status(200).json(
        buildResponse(
          null,
          'A password reset link has been sent to that email address.',
        ),
      );
    } catch (err) {
      next(err);
    }
  }

  private async _resetPassword(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      await this.passwordResetService.resetPassword(
        req.body.token,
        req.body.newPassword,
        req.ip,
      );
      res.status(200).json(buildResponse(null, 'Password has been reset successfully'));
    } catch (err) {
      next(err);
    }
  }

  private async _refresh(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const tokens = await this.authService.refreshToken(req.body, req.ip);
      res.status(200).json(buildResponse(tokens, 'Token refreshed'));
    } catch (err) {
      next(err);
    }
  }

  private async _logout(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      await this.authService.logout(req.body.refreshToken);
      res.status(200).json(buildResponse(null, 'Logged out successfully'));
    } catch (err) {
      next(err);
    }
  }

  private async _logoutAll(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      await this.authService.logoutAll(req.user!.id);
      res.status(200).json(buildResponse(null, 'Logged out from all devices'));
    } catch (err) {
      next(err);
    }
  }
}
