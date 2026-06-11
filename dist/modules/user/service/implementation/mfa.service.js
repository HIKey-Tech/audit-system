"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MfaService = void 0;
// src/modules/user/service/implementation/mfa.service.ts
const qrcode_1 = __importDefault(require("qrcode"));
const prisma_client_1 = require("../../../../shared/prisma/prisma.client");
const app_error_1 = require("../../../../shared/errors/app.error");
const logger_util_1 = require("../../../../shared/utils/logger.util");
const app_config_1 = require("../../../../shared/config/app.config");
const token_utility_1 = require("../../utility/token.utility");
const mfa_utility_1 = require("../../utility/mfa.utility");
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
class MfaService {
    notificationQueue;
    constructor(notificationQueue) {
        this.notificationQueue = notificationQueue;
    }
    async setup(userId, email, method) {
        if (method === 'totp') {
            const secret = (0, mfa_utility_1.generateTotpSecret)();
            // Store as a pending secret; 2FA stays disabled until enrolment verifies.
            await prisma_client_1.prisma.user.update({
                where: { id: userId },
                data: { mfa_totp_secret: (0, mfa_utility_1.encryptSecret)(secret) },
            });
            const otpauthUrl = (0, mfa_utility_1.buildTotpUri)(email, secret);
            const qrDataUrl = await qrcode_1.default.toDataURL(otpauthUrl);
            logger_util_1.logger.info('MFA TOTP setup initiated', { userId });
            return { method, secret, otpauthUrl, qrDataUrl };
        }
        // email
        await this._issueEmailOtp(userId, email);
        logger_util_1.logger.info('MFA email setup initiated', { userId });
        return { method };
    }
    async completeEnrollment(userId, method, code) {
        if (method === 'totp') {
            const user = await prisma_client_1.prisma.user.findUniqueOrThrow({
                where: { id: userId },
                select: { mfa_totp_secret: true },
            });
            if (!user.mfa_totp_secret || !(0, mfa_utility_1.verifyTotp)(code, (0, mfa_utility_1.decryptSecret)(user.mfa_totp_secret))) {
                throw app_error_1.AppError.badRequest('Invalid verification code');
            }
        }
        else {
            await this._consumeEmailOtp(userId, code);
        }
        const backupCodes = await this._replaceBackupCodes(userId);
        await prisma_client_1.prisma.user.update({
            where: { id: userId },
            data: {
                mfa_enabled: true,
                mfa_method: method,
                mfa_enrolled_at: new Date(),
            },
        });
        logger_util_1.logger.info('MFA enrolled', { userId, method });
        return backupCodes;
    }
    async startEmailChallenge(userId, email) {
        await this._issueEmailOtp(userId, email);
    }
    async verifyChallenge(userId, code) {
        const user = await prisma_client_1.prisma.user.findUniqueOrThrow({
            where: { id: userId },
            select: { mfa_enabled: true, mfa_method: true, mfa_totp_secret: true },
        });
        if (!user.mfa_enabled) {
            throw app_error_1.AppError.badRequest('2FA is not enabled for this account');
        }
        // Primary factor
        if (user.mfa_method === 'totp') {
            if (user.mfa_totp_secret && (0, mfa_utility_1.verifyTotp)(code, (0, mfa_utility_1.decryptSecret)(user.mfa_totp_secret))) {
                return;
            }
        }
        else if (user.mfa_method === 'email') {
            if (await this._tryConsumeEmailOtp(userId, code)) {
                return;
            }
        }
        // Backup-code fallback
        if (await this._tryConsumeBackupCode(userId, code)) {
            logger_util_1.logger.info('MFA verified via backup code', { userId });
            return;
        }
        logger_util_1.logger.warn('MFA verification failed', { userId });
        throw app_error_1.AppError.unauthorized('Invalid verification code');
    }
    async regenerateBackupCodes(userId) {
        const user = await prisma_client_1.prisma.user.findUniqueOrThrow({
            where: { id: userId },
            select: { mfa_enabled: true },
        });
        if (!user.mfa_enabled) {
            throw app_error_1.AppError.badRequest('2FA is not enabled for this account');
        }
        const codes = await this._replaceBackupCodes(userId);
        logger_util_1.logger.info('MFA backup codes regenerated', { userId });
        return codes;
    }
    async adminReset(targetUserId, actorId) {
        await prisma_client_1.prisma.$transaction([
            prisma_client_1.prisma.user.update({
                where: { id: targetUserId },
                data: {
                    mfa_enabled: false,
                    mfa_method: null,
                    mfa_totp_secret: null,
                    mfa_enrolled_at: null,
                },
            }),
            prisma_client_1.prisma.mfa_Backup_Code.deleteMany({ where: { user_id: targetUserId } }),
            prisma_client_1.prisma.mfa_Email_Otp.deleteMany({ where: { user_id: targetUserId } }),
        ]);
        logger_util_1.logger.info('MFA reset by admin', { targetUserId, actorId });
    }
    // ── internals ───────────────────────────────────────────────
    async _replaceBackupCodes(userId) {
        const codes = (0, mfa_utility_1.generateBackupCodes)(app_config_1.config.mfa.backupCodeCount);
        const hashes = await Promise.all(codes.map((c) => (0, token_utility_1.hashPassword)((0, mfa_utility_1.normaliseBackupCode)(c))));
        await prisma_client_1.prisma.$transaction([
            prisma_client_1.prisma.mfa_Backup_Code.deleteMany({ where: { user_id: userId } }),
            prisma_client_1.prisma.mfa_Backup_Code.createMany({
                data: hashes.map((code_hash) => ({ user_id: userId, code_hash })),
            }),
        ]);
        return codes;
    }
    async _tryConsumeBackupCode(userId, code) {
        const normalised = (0, mfa_utility_1.normaliseBackupCode)(code);
        if (!normalised)
            return false;
        const unused = await prisma_client_1.prisma.mfa_Backup_Code.findMany({
            where: { user_id: userId, used_at: null },
        });
        for (const candidate of unused) {
            // eslint-disable-next-line no-await-in-loop
            if (await (0, token_utility_1.comparePassword)(normalised, candidate.code_hash)) {
                const consumed = await prisma_client_1.prisma.mfa_Backup_Code.updateMany({
                    where: { id: candidate.id, used_at: null },
                    data: { used_at: new Date() },
                });
                if (consumed.count > 0)
                    return true;
            }
        }
        return false;
    }
    async _issueEmailOtp(userId, email) {
        const otp = (0, mfa_utility_1.generateEmailOtp)();
        const expiresAt = new Date(Date.now() + this._emailOtpTtlMs());
        // Supersede any prior unconsumed codes.
        await prisma_client_1.prisma.mfa_Email_Otp.updateMany({
            where: { user_id: userId, consumed_at: null },
            data: { consumed_at: new Date() },
        });
        await prisma_client_1.prisma.mfa_Email_Otp.create({
            data: {
                user_id: userId,
                code_hash: (0, token_utility_1.hashToken)(otp),
                expires_at: expiresAt,
            },
        });
        const appName = app_config_1.config.app.name;
        await this.notificationQueue.enqueue('email', {
            to: email,
            subject: `Your ${appName} verification code`,
            template: 'mfa-otp',
            text: [
                `Your ${appName} verification code is: ${otp}`,
                '',
                `It expires in ${app_config_1.config.mfa.emailOtpTtl}. If you did not try to sign in, ignore this email.`,
            ].join('\n'),
            html: [
                `<p>Your ${escapeHtml(appName)} verification code is:</p>`,
                `<p style="font-size:24px;font-weight:bold;letter-spacing:3px">${otp}</p>`,
                `<p>It expires in ${escapeHtml(app_config_1.config.mfa.emailOtpTtl)}. If you did not try to sign in, ignore this email.</p>`,
            ].join(''),
        });
    }
    /** Strict consume (enrolment): throws with a clear message on failure. */
    async _consumeEmailOtp(userId, code) {
        if (!(await this._tryConsumeEmailOtp(userId, code))) {
            throw app_error_1.AppError.badRequest('Invalid or expired verification code');
        }
    }
    async _tryConsumeEmailOtp(userId, code) {
        const otp = await prisma_client_1.prisma.mfa_Email_Otp.findFirst({
            where: { user_id: userId, consumed_at: null },
            orderBy: { created_at: 'desc' },
        });
        if (!otp)
            return false;
        if (otp.expires_at < new Date())
            return false;
        if (otp.attempts >= app_config_1.config.mfa.emailOtpMaxAttempts)
            return false;
        if (otp.code_hash !== (0, token_utility_1.hashToken)(code.trim())) {
            await prisma_client_1.prisma.mfa_Email_Otp.update({
                where: { id: otp.id },
                data: { attempts: { increment: 1 } },
            });
            return false;
        }
        const consumed = await prisma_client_1.prisma.mfa_Email_Otp.updateMany({
            where: { id: otp.id, consumed_at: null },
            data: { consumed_at: new Date() },
        });
        return consumed.count > 0;
    }
    _emailOtpTtlMs() {
        // config.mfa.emailOtpTtl is a validated ms-compatible duration string.
        // Parse defensively; default 10 min.
        const match = /^(\d+)\s*(s|m|h)?$/.exec(app_config_1.config.mfa.emailOtpTtl.trim());
        if (!match)
            return 10 * 60 * 1000;
        const n = parseInt(match[1], 10);
        const unit = match[2] ?? 'm';
        const factor = unit === 's' ? 1000 : unit === 'h' ? 3_600_000 : 60_000;
        return n * factor;
    }
}
exports.MfaService = MfaService;
//# sourceMappingURL=mfa.service.js.map