// src/modules/user/service/implementation/mfa.service.ts
import QRCode from 'qrcode';
import { prisma } from '../../../../shared/prisma/prisma.client';
import { AppError } from '../../../../shared/errors/app.error';
import { logger } from '../../../../shared/utils/logger.util';
import { config } from '../../../../shared/config/app.config';
import { INotificationQueueService, NOTIFICATION_PRIORITY } from '../../../messaging/service/interface/notification-queue.service.interface';
import { IMfaService } from '../interface/mfa.service.interface';
import { MfaMethod } from '../../dto/request/auth.request.dto';
import { MfaSetupResponseDto } from '../../dto/response/user.response.dto';
import { hashPassword, comparePassword, hashToken } from '../../utility/token.utility';
import {
  generateTotpSecret,
  buildTotpUri,
  verifyTotp,
  encryptSecret,
  decryptSecret,
  generateEmailOtp,
  generateBackupCodes,
  normaliseBackupCode,
} from '../../utility/mfa.utility';
import { revokeUserSessions } from '../../../../shared/security/session-guard';

const escapeHtml = (value: string): string =>
  value.replace(/[&<>"']/g, (char) => {
    switch (char) {
      case '&':
        return '&amp;';
      case '<':
        return '&lt;';
      case '>':
        return '&gt;';
      case '"':
        return '&quot;';
      default:
        return '&#39;';
    }
  });

export class MfaService implements IMfaService {
  constructor(private readonly notificationQueue: INotificationQueueService) {}

  async setup(
    userId: string,
    email: string,
    method: MfaMethod,
  ): Promise<MfaSetupResponseDto> {
    if (method === 'totp') {
      const secret = generateTotpSecret();
      // Store as a pending secret; 2FA stays disabled until enrolment verifies.
      await prisma.user.update({
        where: { id: userId },
        data: { mfa_totp_secret: encryptSecret(secret) },
      });

      const otpauthUrl = buildTotpUri(email, secret);
      const qrDataUrl = await QRCode.toDataURL(otpauthUrl);

      logger.info('MFA TOTP setup initiated', { userId });
      return { method, secret, otpauthUrl, qrDataUrl };
    }

    // email
    await this._issueEmailOtp(userId, email);
    logger.info('MFA email setup initiated', { userId });
    return { method };
  }

  async completeEnrollment(
    userId: string,
    method: MfaMethod,
    code: string,
  ): Promise<string[]> {
    if (method === 'totp') {
      const user = await prisma.user.findUniqueOrThrow({
        where: { id: userId },
        select: { mfa_totp_secret: true },
      });
      if (!user.mfa_totp_secret || !verifyTotp(code, decryptSecret(user.mfa_totp_secret))) {
        throw AppError.badRequest('Invalid verification code');
      }
    } else {
      await this._consumeEmailOtp(userId, code);
    }

    const backupCodes = await this._replaceBackupCodes(userId);

    await prisma.user.update({
      where: { id: userId },
      data: {
        mfa_enabled: true,
        mfa_method: method,
        mfa_enrolled_at: new Date(),
      },
    });

    logger.info('MFA enrolled', { userId, method });
    return backupCodes;
  }

  async startEmailChallenge(userId: string, email: string): Promise<void> {
    await this._issueEmailOtp(userId, email);
  }

  async verifyChallenge(userId: string, code: string): Promise<void> {
    const user = await prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { mfa_enabled: true, mfa_method: true, mfa_totp_secret: true },
    });

    if (!user.mfa_enabled) {
      throw AppError.badRequest('2FA is not enabled for this account');
    }

    // Primary factor
    if (user.mfa_method === 'totp') {
      if (user.mfa_totp_secret && verifyTotp(code, decryptSecret(user.mfa_totp_secret))) {
        return;
      }
    } else if (user.mfa_method === 'email') {
      if (await this._tryConsumeEmailOtp(userId, code)) {
        return;
      }
    }

    // Backup-code fallback
    if (await this._tryConsumeBackupCode(userId, code)) {
      logger.info('MFA verified via backup code', { userId });
      return;
    }

    logger.warn('MFA verification failed', { userId });
    throw AppError.unauthorized('Invalid verification code');
  }

  async regenerateBackupCodes(userId: string): Promise<string[]> {
    const user = await prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { mfa_enabled: true },
    });
    if (!user.mfa_enabled) {
      throw AppError.badRequest('2FA is not enabled for this account');
    }
    const codes = await this._replaceBackupCodes(userId);
    logger.info('MFA backup codes regenerated', { userId });
    return codes;
  }

  async adminReset(targetUserId: string, actorId: string): Promise<void> {
    await prisma.$transaction([
      prisma.user.update({
        where: { id: targetUserId },
        data: {
          mfa_enabled: false,
          mfa_method: null,
          mfa_totp_secret: null,
          mfa_enrolled_at: null,
        },
      }),
      prisma.mfa_Backup_Code.deleteMany({ where: { user_id: targetUserId } }),
      prisma.mfa_Email_Otp.deleteMany({ where: { user_id: targetUserId } }),
    ]);
    // Fix (Obs #2): invalidate outstanding access tokens so the user's auth
    // state (mfa_enabled) is reflected immediately without waiting for TTL.
    await revokeUserSessions(targetUserId);
    logger.info('MFA reset by admin', { targetUserId, actorId });
  }

  // ── internals ───────────────────────────────────────────────

  private async _replaceBackupCodes(userId: string): Promise<string[]> {
    const codes = generateBackupCodes(config.mfa.backupCodeCount);
    const hashes = await Promise.all(
      codes.map((c) => hashPassword(normaliseBackupCode(c))),
    );

    await prisma.$transaction([
      prisma.mfa_Backup_Code.deleteMany({ where: { user_id: userId } }),
      prisma.mfa_Backup_Code.createMany({
        data: hashes.map((code_hash) => ({ user_id: userId, code_hash })),
      }),
    ]);

    return codes;
  }

  private async _tryConsumeBackupCode(userId: string, code: string): Promise<boolean> {
    const normalised = normaliseBackupCode(code);
    if (!normalised) return false;

    const unused = await prisma.mfa_Backup_Code.findMany({
      where: { user_id: userId, used_at: null },
    });

    for (const candidate of unused) {
      // eslint-disable-next-line no-await-in-loop
      if (await comparePassword(normalised, candidate.code_hash)) {
        const consumed = await prisma.mfa_Backup_Code.updateMany({
          where: { id: candidate.id, used_at: null },
          data: { used_at: new Date() },
        });
        if (consumed.count > 0) return true;
      }
    }
    return false;
  }

  private async _issueEmailOtp(userId: string, email: string): Promise<void> {
    const otp = generateEmailOtp();
    const expiresAt = new Date(Date.now() + this._emailOtpTtlMs());

    // Supersede any prior unconsumed codes.
    await prisma.mfa_Email_Otp.updateMany({
      where: { user_id: userId, consumed_at: null },
      data: { consumed_at: new Date() },
    });

    await prisma.mfa_Email_Otp.create({
      data: {
        user_id: userId,
        code_hash: hashToken(otp),
        expires_at: expiresAt,
      },
    });

    const appName = config.app.name;
    await this.notificationQueue.enqueue('email', {
      to: email,
      subject: `Your ${appName} verification code`,
      template: 'mfa-otp',
      text: [
        `Your ${appName} verification code is: ${otp}`,
        '',
        `It expires in ${config.mfa.emailOtpTtl}. If you did not try to sign in, ignore this email.`,
      ].join('\n'),
      html: [
        `<p>Your ${escapeHtml(appName)} verification code is:</p>`,
        `<p style="font-size:24px;font-weight:bold;letter-spacing:3px">${otp}</p>`,
        `<p>It expires in ${escapeHtml(config.mfa.emailOtpTtl)}. If you did not try to sign in, ignore this email.</p>`,
      ].join(''),
    }, { priority: NOTIFICATION_PRIORITY.HIGH });

    // Flush the queue now: OTPs are interactive and time-sensitive, so we can't
    // wait for the ~1-minute queue cron tick. Fire-and-forget (processQueue has its
    // own concurrency guard) — never block or fail the login/challenge on the send.
    void this.notificationQueue.processQueue().catch((err) =>
      logger.warn('Immediate OTP queue flush failed (cron will retry)', { userId, err }),
    );
  }

  async resendEmailChallenge(userId: string, email: string): Promise<{ cooldownSeconds: number }> {
    const user = await prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { mfa_method: true },
    });
    // Resend only applies to the email factor — TOTP/backup codes are never emailed.
    if (user.mfa_method !== 'email') {
      throw AppError.badRequest('Resend is only available for email verification codes');
    }

    const cooldownMs = config.mfa.emailOtpResendCooldown * 1000;
    const windowMs = this._emailOtpTtlMs();

    // Server-enforced cooldown + cap — never trust the client's timer. Counts all
    // sends (initial + resends) within one code lifetime.
    const recent = await prisma.mfa_Email_Otp.findMany({
      where: { user_id: userId, created_at: { gte: new Date(Date.now() - windowMs) } },
      orderBy: { created_at: 'desc' },
      select: { created_at: true },
    });

    if (recent.length > 0) {
      const sinceLastMs = Date.now() - recent[0].created_at.getTime();
      if (sinceLastMs < cooldownMs) {
        const retryAfter = Math.ceil((cooldownMs - sinceLastMs) / 1000);
        throw AppError.tooManyRequests(`Please wait ${retryAfter}s before requesting another code.`);
      }
    }
    if (recent.length >= config.mfa.emailOtpMaxSends) {
      throw AppError.tooManyRequests(
        'Too many codes requested. Wait a few minutes, or use an authenticator app / backup code.',
      );
    }

    await this._issueEmailOtp(userId, email);
    logger.info('MFA email OTP resent', { userId });
    return { cooldownSeconds: config.mfa.emailOtpResendCooldown };
  }

  /** Strict consume (enrolment): throws with a clear message on failure. */
  private async _consumeEmailOtp(userId: string, code: string): Promise<void> {
    if (!(await this._tryConsumeEmailOtp(userId, code))) {
      throw AppError.badRequest('Invalid or expired verification code');
    }
  }

  private async _tryConsumeEmailOtp(userId: string, code: string): Promise<boolean> {
    const otp = await prisma.mfa_Email_Otp.findFirst({
      where: { user_id: userId, consumed_at: null },
      orderBy: { created_at: 'desc' },
    });

    if (!otp) return false;
    if (otp.expires_at < new Date()) return false;
    if (otp.attempts >= config.mfa.emailOtpMaxAttempts) return false;

    if (otp.code_hash !== hashToken(code.trim())) {
      await prisma.mfa_Email_Otp.update({
        where: { id: otp.id },
        data: { attempts: { increment: 1 } },
      });
      return false;
    }

    const consumed = await prisma.mfa_Email_Otp.updateMany({
      where: { id: otp.id, consumed_at: null },
      data: { consumed_at: new Date() },
    });
    return consumed.count > 0;
  }

  private _emailOtpTtlMs(): number {
    // config.mfa.emailOtpTtl is a validated ms-compatible duration string.
    // Parse defensively; default 10 min.
    const match = /^(\d+)\s*(s|m|h)?$/.exec(config.mfa.emailOtpTtl.trim());
    if (!match) return 10 * 60 * 1000;
    const n = parseInt(match[1], 10);
    const unit = match[2] ?? 'm';
    const factor = unit === 's' ? 1000 : unit === 'h' ? 3_600_000 : 60_000;
    return n * factor;
  }
}
