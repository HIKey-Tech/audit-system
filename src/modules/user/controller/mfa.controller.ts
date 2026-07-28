// src/modules/user/controller/mfa.controller.ts
import { Router, Request, Response, NextFunction } from 'express';
import { validate } from '../../../shared/middleware/validate.middleware';
import {
  authenticate,
  requireMfaToken,
  requireEnrollmentContext,
  requirePermission,
} from '../../../shared/middleware/auth.middleware';
import { buildResponse } from '../../../shared/types/api-response.type';
import { IMfaService } from '../service/interface/mfa.service.interface';
import { IAuthService } from '../service/interface/auth.service.interface';
import {
  MfaSetupRequestSchema,
  MfaEnrollRequestSchema,
  MfaVerifyRequestSchema,
  MfaAdminResetRequestSchema,
} from '../dto/request/auth.request.dto';

export class MfaController {
  public readonly router: Router;

  constructor(
    private readonly mfaService: IMfaService,
    private readonly authService: IAuthService,
  ) {
    this.router = Router();
    this._registerRoutes();
  }

  private _registerRoutes(): void {
    /**
     * @route  POST /auth/2fa/setup
     * @desc   Begin 2FA enrolment (TOTP QR or email OTP)
     * @access Enrolment token
     */
    this.router.post(
      '/setup',
      requireEnrollmentContext,
      validate(MfaSetupRequestSchema),
      this._setup.bind(this),
    );

    /**
     * @route  POST /auth/2fa/enroll
     * @desc   Verify enrolment code, enable 2FA, return backup codes + tokens
     * @access Enrolment token
     */
    this.router.post(
      '/enroll',
      requireEnrollmentContext,
      validate(MfaEnrollRequestSchema),
      this._enroll.bind(this),
    );

    /**
     * @route  POST /auth/2fa/verify
     * @desc   Verify a login 2FA code; issues the real token pair
     * @access Challenge token
     */
    this.router.post(
      '/verify',
      requireMfaToken('mfa_challenge'),
      validate(MfaVerifyRequestSchema),
      this._verify.bind(this),
    );

    /**
     * @route  POST /auth/2fa/resend
     * @desc   Resend the login email OTP (server-enforced cooldown + cap)
     * @access Challenge token
     */
    this.router.post(
      '/resend',
      requireMfaToken('mfa_challenge'),
      this._resend.bind(this),
    );

    /**
     * @route  POST /auth/2fa/backup-codes/regenerate
     * @desc   Regenerate backup codes for the authenticated user
     * @access Private
     */
    this.router.post(
      '/backup-codes/regenerate',
      authenticate,
      this._regenerateBackupCodes.bind(this),
    );

    /**
     * @route  POST /auth/2fa/admin-reset
     * @desc   Reset a user's 2FA (lockout recovery)
     * @access user:reset_2fa
     */
    this.router.post(
      '/admin-reset',
      authenticate,
      requirePermission('user:reset_2fa'),
      validate(MfaAdminResetRequestSchema),
      this._adminReset.bind(this),
    );
  }

  private async _setup(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id, email } = req.mfaToken!;
      const result = await this.mfaService.setup(id, email, req.body.method);
      res.status(200).json(buildResponse(result, '2FA setup initiated'));
    } catch (err) {
      next(err);
    }
  }

  private async _enroll(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.mfaToken!;
      const backupCodes = await this.mfaService.completeEnrollment(
        id,
        req.body.method,
        req.body.code,
      );
      const auth = await this.authService.completeMfaLogin(
        id,
        req.ip,
        req.headers['user-agent'],
      );
      res.status(200).json(buildResponse({ backupCodes, auth }, '2FA enabled'));
    } catch (err) {
      next(err);
    }
  }

  private async _verify(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.mfaToken!;
      await this.mfaService.verifyChallenge(id, req.body.code);
      const auth = await this.authService.completeMfaLogin(
        id,
        req.ip,
        req.headers['user-agent'],
      );
      res.status(200).json(buildResponse(auth, 'Login successful'));
    } catch (err) {
      next(err);
    }
  }

  private async _resend(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id, email } = req.mfaToken!;
      const result = await this.mfaService.resendEmailChallenge(id, email);
      res.status(200).json(buildResponse(result, 'A new verification code has been sent'));
    } catch (err) {
      next(err);
    }
  }

  private async _regenerateBackupCodes(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const backupCodes = await this.mfaService.regenerateBackupCodes(req.user!.id);
      res.status(200).json(buildResponse({ backupCodes }, 'Backup codes regenerated'));
    } catch (err) {
      next(err);
    }
  }

  private async _adminReset(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      await this.mfaService.adminReset(req.body.userId, req.user!.id);
      res.status(200).json(buildResponse(null, "User's 2FA has been reset"));
    } catch (err) {
      next(err);
    }
  }
}
