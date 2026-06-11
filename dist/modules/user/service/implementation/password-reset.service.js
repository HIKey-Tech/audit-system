"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PasswordResetService = void 0;
// src/modules/user/service/implementation/password-reset.service.ts
const prisma_client_1 = require("../../../../shared/prisma/prisma.client");
const app_error_1 = require("../../../../shared/errors/app.error");
const logger_util_1 = require("../../../../shared/utils/logger.util");
const app_config_1 = require("../../../../shared/config/app.config");
const token_utility_1 = require("../../utility/token.utility");
const escapeHtml = (value) => value.replace(/[&<>"']/g, (char) => {
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
class PasswordResetService {
    notificationQueue;
    constructor(notificationQueue) {
        this.notificationQueue = notificationQueue;
    }
    async requestReset(email, ipAddress) {
        const user = await prisma_client_1.prisma.user.findUnique({
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
        if (!user) {
            logger_util_1.logger.info('Password reset requested for non-eligible account', { email });
            throw app_error_1.AppError.notFound('Account');
        }
        if (!user.is_active) {
            logger_util_1.logger.info('Password reset requested for inactive account', { userId: user.id });
            throw app_error_1.AppError.forbidden('This account is inactive. Contact an administrator.');
        }
        if (!user.password_hash) {
            logger_util_1.logger.info('Password reset requested for SSO-only account', { userId: user.id });
            throw app_error_1.AppError.badRequest('This account uses single sign-on. Reset your password through your identity provider.');
        }
        // Invalidate any prior unused tokens so only the newest link works.
        await prisma_client_1.prisma.password_Reset_Token.updateMany({
            where: { user_id: user.id, used_at: null },
            data: { used_at: new Date() },
        });
        const { raw, hash, expiresAt } = (0, token_utility_1.generatePasswordResetToken)();
        await prisma_client_1.prisma.password_Reset_Token.create({
            data: {
                user_id: user.id,
                token_hash: hash,
                expires_at: expiresAt,
                ip_address: ipAddress,
            },
        });
        await this._sendResetEmail(user, raw);
        logger_util_1.logger.info('Password reset token issued', { userId: user.id });
    }
    async resetPassword(token, newPassword, _ipAddress) {
        const tokenHash = (0, token_utility_1.hashToken)(token);
        const stored = await prisma_client_1.prisma.password_Reset_Token.findUnique({
            where: { token_hash: tokenHash },
        });
        if (!stored || stored.used_at || stored.expires_at < new Date()) {
            throw app_error_1.AppError.badRequest('Invalid or expired reset token');
        }
        // Hash outside the transaction to keep the locked window short.
        const password_hash = await (0, token_utility_1.hashPassword)(newPassword);
        await prisma_client_1.prisma.$transaction(async (tx) => {
            // Atomic single-use: only one request can flip used_at from null.
            const consumed = await tx.password_Reset_Token.updateMany({
                where: { id: stored.id, used_at: null },
                data: { used_at: new Date() },
            });
            if (consumed.count === 0) {
                throw app_error_1.AppError.badRequest('Invalid or expired reset token');
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
        logger_util_1.logger.info('Password reset completed', { userId: stored.user_id });
    }
    async _sendResetEmail(user, rawToken) {
        const displayName = user.display_name ?? `${user.first_name} ${user.last_name}`.trim();
        const resetUrl = `${app_config_1.config.app.frontendUrl.replace(/\/$/, '')}/reset-password?token=${rawToken}`;
        const appName = app_config_1.config.app.name;
        const ttl = app_config_1.config.passwordReset.tokenTtl;
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
        });
    }
}
exports.PasswordResetService = PasswordResetService;
//# sourceMappingURL=password-reset.service.js.map