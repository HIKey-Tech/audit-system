// src/modules/user/service/implementation/password-reset.service.ts
import { prisma } from '../../../../shared/prisma/prisma.client';
import { AppError } from '../../../../shared/errors/app.error';
import { logger } from '../../../../shared/utils/logger.util';
import { config } from '../../../../shared/config/app.config';
import { INotificationQueueService, NOTIFICATION_PRIORITY } from '../../../messaging/service/interface/notification-queue.service.interface';
import { IPasswordResetService } from '../interface/password-reset.service.interface';
import {
  generatePasswordResetToken,
  hashToken,
  hashPassword,
} from '../../utility/token.utility';
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

export class PasswordResetService implements IPasswordResetService {
  constructor(private readonly notificationQueue: INotificationQueueService) {}

  async requestReset(email: string, ipAddress?: string): Promise<void> {
    const user = await prisma.user.findUnique({
      where: { email, deleted_at: null },
      select: {
        id: true,
        email: true,
        first_name: true,
        last_name: true,
        display_name: true,
        password_hash: true,
        is_active: true,
      },
    });

    // Account enumeration guard: never reveal whether the address exists, is
    // active, or is SSO-only. For any non-eligible account we log the real
    // reason server-side and return silently; the controller always responds
    // with the same generic "if an account exists, a link was sent" message.
    if (!user) {
      logger.info('Password reset requested for non-eligible account', { email });
      return;
    }

    if (!user.is_active) {
      logger.info('Password reset requested for inactive account', { userId: user.id });
      return;
    }

    if (!user.password_hash) {
      logger.info('Password reset requested for SSO-only account', { userId: user.id });
      return;
    }

    // Invalidate any prior unused tokens so only the newest link works.
    await prisma.password_Reset_Token.updateMany({
      where: { user_id: user.id, used_at: null },
      data: { used_at: new Date() },
    });

    const { raw, hash, expiresAt } = generatePasswordResetToken();

    await prisma.password_Reset_Token.create({
      data: {
        user_id: user.id,
        token_hash: hash,
        expires_at: expiresAt,
        ip_address: ipAddress,
      },
    });

    await this._sendResetEmail(user, raw);
    logger.info('Password reset token issued', { userId: user.id });
  }

  async resetPassword(
    token: string,
    newPassword: string,
    _ipAddress?: string,
  ): Promise<void> {
    const tokenHash = hashToken(token);

    const stored = await prisma.password_Reset_Token.findUnique({
      where: { token_hash: tokenHash },
    });

    if (!stored || stored.used_at || stored.expires_at < new Date()) {
      throw AppError.badRequest('Invalid or expired reset token');
    }

    // Hash outside the transaction to keep the locked window short.
    const password_hash = await hashPassword(newPassword);

    await prisma.$transaction(async (tx) => {
      // Atomic single-use: only one request can flip used_at from null.
      const consumed = await tx.password_Reset_Token.updateMany({
        where: { id: stored.id, used_at: null },
        data: { used_at: new Date() },
      });

      if (consumed.count === 0) {
        throw AppError.badRequest('Invalid or expired reset token');
      }

      await tx.user.update({
        where: { id: stored.user_id },
        data: { password_hash },
      });

      // Kill every existing session — a reset implies the old credentials
      // (and any sessions opened with them) can no longer be trusted.
      await tx.refresh_Token.updateMany({
        where: { user_id: stored.user_id, revoked_at: null },
        data: { revoked_at: new Date() },
      });
    });

    // Invalidate any outstanding access tokens too.
    await revokeUserSessions(stored.user_id);

    logger.info('Password reset completed', { userId: stored.user_id });
  }

  private async _sendResetEmail(
    user: { email: string; first_name: string; last_name: string; display_name: string | null },
    rawToken: string,
  ): Promise<void> {
    const displayName =
      user.display_name ?? `${user.first_name} ${user.last_name}`.trim();
    const resetUrl = `${config.app.frontendUrl.replace(/\/$/, '')}/reset-password?token=${rawToken}`;
    const appName = config.app.name;
    const ttl = config.passwordReset.tokenTtl;

    await this.notificationQueue.enqueue('email', {
      to: user.email,
      subject: `Reset your ${appName} password`,
      template: 'password-reset',
      text: [
        `Hello ${displayName},`,
        '',
        `We received a request to reset your ${appName} password.`,
        '',
        `Reset link: ${resetUrl}`,
        '',
        `This link expires in ${ttl}. If you did not request this, you can safely ignore this email.`,
      ].join('\n'),
      html: [
        `<p>Hello ${escapeHtml(displayName)},</p>`,
        `<p>We received a request to reset your ${escapeHtml(appName)} password.</p>`,
        `<p><a href="${escapeHtml(resetUrl)}">Reset your password</a></p>`,
        `<p>This link expires in ${escapeHtml(ttl)}. If you did not request this, you can safely ignore this email.</p>`,
      ].join(''),
    }, { priority: NOTIFICATION_PRIORITY.HIGH });
  }
}
