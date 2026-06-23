"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthService = void 0;
// src/modules/user/service/implementation/auth.service.ts
const ms_1 = __importDefault(require("ms"));
const prisma_client_1 = require("../../../../shared/prisma/prisma.client");
const app_error_1 = require("../../../../shared/errors/app.error");
const logger_util_1 = require("../../../../shared/utils/logger.util");
const app_config_1 = require("../../../../shared/config/app.config");
const user_response_dto_1 = require("../../dto/response/user.response.dto");
const token_utility_1 = require("../../utility/token.utility");
const mfa_utility_1 = require("../../utility/mfa.utility");
const oidc_client_1 = require("../client/oidc.client");
const prisma_types_1 = require("../../../../shared/prisma/prisma.types");
class AuthService {
    userService;
    mfaService;
    oidcClient;
    constructor(userService, mfaService) {
        this.userService = userService;
        this.mfaService = mfaService;
        this.oidcClient = (0, oidc_client_1.createOidcClient)();
    }
    async login(dto, ipAddress, userAgent) {
        const user = await prisma_client_1.prisma.user.findUnique({
            where: { email: dto.email, deleted_at: null },
            include: prisma_types_1.userWithRolesInclude,
        });
        if (!user || !user.password_hash) {
            throw app_error_1.AppError.unauthorized('Invalid credentials');
        }
        if (!user.is_active) {
            throw app_error_1.AppError.unauthorized('Account is deactivated');
        }
        const passwordValid = await (0, token_utility_1.comparePassword)(dto.password, user.password_hash);
        if (!passwordValid) {
            throw app_error_1.AppError.unauthorized('Invalid credentials');
        }
        // ── 2FA gate ──────────────────────────────────────────────
        if (user.mfa_enabled) {
            const method = (user.mfa_method ?? 'totp');
            if (method === 'email') {
                await this.mfaService.startEmailChallenge(user.id, user.email);
            }
            const challengeToken = (0, mfa_utility_1.generateScopedToken)(user.id, user.email, 'mfa_challenge', app_config_1.config.mfa.challengeTtl);
            logger_util_1.logger.info('Password OK — 2FA challenge issued', { userId: user.id, method });
            return { status: 'MFA_REQUIRED', method, challengeToken };
        }
        if (app_config_1.config.mfa.mandatory) {
            const now = new Date();
            // Grace deadline starts on the first login (lazy init), so existing
            // users get a full window from the moment this ships — never blocked
            // immediately. Once the deadline passes, enrolment is forced.
            const graceUntil = user.mfa_grace_until ??
                new Date(now.getTime() + app_config_1.config.mfa.gracePeriodDays * 86_400_000);
            if (graceUntil <= now) {
                const enrollmentToken = (0, mfa_utility_1.generateScopedToken)(user.id, user.email, 'mfa_enroll', app_config_1.config.mfa.enrollTtl);
                logger_util_1.logger.info('Password OK — 2FA grace expired, enrolment required', {
                    userId: user.id,
                });
                return { status: 'MFA_ENROLLMENT_REQUIRED', enrollmentToken };
            }
            // Within grace: log in normally, but flag that setup is still pending.
            const tokens = await this._issueTokens(user.id, ipAddress, userAgent);
            await prisma_client_1.prisma.user.update({
                where: { id: user.id },
                data: {
                    last_login_at: now,
                    // Persist the deadline the first time we compute it.
                    ...(user.mfa_grace_until ? {} : { mfa_grace_until: graceUntil }),
                },
            });
            logger_util_1.logger.info('User logged in via password (2FA grace active)', { userId: user.id });
            return {
                status: 'OK',
                mfaSetupRequired: true,
                ...tokens,
                user: (0, user_response_dto_1.mapUserToResponse)(user),
            };
        }
        // No 2FA required (mandatory disabled) — issue tokens directly.
        const tokens = await this._issueTokens(user.id, ipAddress, userAgent);
        await prisma_client_1.prisma.user.update({
            where: { id: user.id },
            data: { last_login_at: new Date() },
        });
        logger_util_1.logger.info('User logged in via password', { userId: user.id });
        return {
            status: 'OK',
            ...tokens,
            user: (0, user_response_dto_1.mapUserToResponse)(user),
        };
    }
    async completeMfaLogin(userId, ipAddress, userAgent) {
        const user = (await prisma_client_1.prisma.user.findUniqueOrThrow({
            where: { id: userId },
            include: prisma_types_1.userWithRolesInclude,
        }));
        if (!user.is_active) {
            throw app_error_1.AppError.unauthorized('Account is deactivated');
        }
        const tokens = await this._issueTokens(user.id, ipAddress, userAgent);
        await prisma_client_1.prisma.user.update({
            where: { id: user.id },
            data: { last_login_at: new Date() },
        });
        logger_util_1.logger.info('User completed 2FA login', { userId: user.id });
        return {
            ...tokens,
            user: (0, user_response_dto_1.mapUserToResponse)(user),
        };
    }
    async getSsoAuthorizationUrl(state) {
        const { url, state: generatedState } = await this.oidcClient.getAuthorizationUrl(state);
        return { authorizationUrl: url, state: generatedState };
    }
    async handleOidcCallback(code, state, ipAddress, userAgent) {
        const result = await this.oidcClient.handleCallback(code, state);
        // Trust the IdP for MFA (no IAMS double-prompt on SSO), but verify it
        // actually happened when policy requires it: the `amr` claim must include
        // "mfa". Otherwise reject the login.
        if (app_config_1.config.oidc.requireIdpMfa) {
            const amr = result.profile.authMethods ?? [];
            if (!amr.includes('mfa')) {
                logger_util_1.logger.warn('SSO login rejected — IdP did not assert MFA', {
                    oid: result.profile.oid,
                    amr,
                });
                throw app_error_1.AppError.unauthorized('Multi-factor authentication is required. Please complete MFA with your identity provider.');
            }
        }
        // Provision or sync the user
        const userDto = await this.userService.syncFromAzureAd(result.profile.oid, result.profile);
        const user = await prisma_client_1.prisma.user.findUniqueOrThrow({
            where: { id: userDto.id },
            include: prisma_types_1.userWithRolesInclude,
        });
        if (!user.is_active) {
            throw app_error_1.AppError.unauthorized('Account is deactivated');
        }
        const tokens = await this._issueTokens(user.id, ipAddress, userAgent);
        await prisma_client_1.prisma.user.update({
            where: { id: user.id },
            data: { last_login_at: new Date() },
        });
        logger_util_1.logger.info('User logged in via SSO', { userId: user.id, provider: app_config_1.config.oidc.provider });
        return {
            ...tokens,
            user: (0, user_response_dto_1.mapUserToResponse)(user),
        };
    }
    async refreshToken(dto, ipAddress) {
        const tokenHash = (0, token_utility_1.hashToken)(dto.refreshToken);
        return prisma_client_1.prisma.$transaction(async (tx) => {
            const storedToken = await tx.refresh_Token.findUnique({
                where: { token_hash: tokenHash },
                include: { user: { include: prisma_types_1.userWithRolesInclude } },
            });
            if (!storedToken) {
                throw app_error_1.AppError.unauthorized('Invalid refresh token');
            }
            if (!storedToken.user.is_active) {
                throw app_error_1.AppError.unauthorized('Account is deactivated');
            }
            // ── Already-revoked token presented ────────────────────────────────
            // This is normal when several clients share one refresh cookie (e.g.
            // multiple browser tabs): one rotates the token, the others arrive a
            // moment later still holding the token that was just rotated out. That
            // is NOT theft — blindly revoking every session here is exactly what was
            // bouncing users to the login screen several times an hour.
            if (storedToken.revoked_at) {
                const replacedById = storedToken.replaced_by;
                const withinGrace = replacedById !== null &&
                    Date.now() - storedToken.revoked_at.getTime() <
                        (0, ms_1.default)(app_config_1.config.jwt.refreshRotationGrace);
                if (withinGrace) {
                    // Forgive the reuse only while the legitimate successor is still
                    // live. If the successor was itself revoked (logout, or a real
                    // theft response), fall through to the hard revoke-all below.
                    const successor = await tx.refresh_Token.findUnique({
                        where: { id: replacedById },
                    });
                    if (successor &&
                        !successor.revoked_at &&
                        successor.expires_at > new Date()) {
                        const accessToken = this._generateUserAccessToken(storedToken.user);
                        const { raw, hash, expiresAt } = (0, token_utility_1.generateRefreshToken)();
                        await tx.refresh_Token.create({
                            data: {
                                user_id: storedToken.user_id,
                                token_hash: hash,
                                expires_at: expiresAt,
                                ip_address: ipAddress,
                            },
                        });
                        logger_util_1.logger.info('Refresh within rotation grace — benign concurrent refresh', {
                            userId: storedToken.user_id,
                        });
                        return (0, token_utility_1.buildTokenPair)(accessToken, raw);
                    }
                }
                // Genuine replay of a dead token — revoke everything for security.
                await tx.refresh_Token.updateMany({
                    where: { user_id: storedToken.user_id, revoked_at: null },
                    data: { revoked_at: new Date() },
                });
                logger_util_1.logger.warn('Refresh token reuse detected', { userId: storedToken.user_id });
                throw app_error_1.AppError.unauthorized('Refresh token has been revoked');
            }
            if (storedToken.expires_at < new Date()) {
                throw app_error_1.AppError.unauthorized('Refresh token has expired');
            }
            // ── Normal rotation ────────────────────────────────────────────────
            // Issue the successor first so the old row can record the rotation link.
            // The conditional updateMany is an atomic compare-and-swap: only one
            // concurrent request can flip revoked_at, and the loser's freshly created
            // token is discarded when the transaction rolls back on throw.
            const accessToken = this._generateUserAccessToken(storedToken.user);
            const { raw, hash, expiresAt } = (0, token_utility_1.generateRefreshToken)();
            const newToken = await tx.refresh_Token.create({
                data: {
                    user_id: storedToken.user_id,
                    token_hash: hash,
                    expires_at: expiresAt,
                    ip_address: ipAddress,
                },
            });
            const revokeResult = await tx.refresh_Token.updateMany({
                where: { id: storedToken.id, revoked_at: null },
                data: { revoked_at: new Date(), replaced_by: newToken.id },
            });
            if (revokeResult.count === 0) {
                // Lost the race to a concurrent rotation of the SAME token. The other
                // request already issued a valid successor, so fail only this request
                // without touching the user's other sessions.
                logger_util_1.logger.warn('Refresh token reuse detected (concurrent rotation)', {
                    userId: storedToken.user_id,
                });
                throw app_error_1.AppError.unauthorized('Refresh token has been revoked');
            }
            return (0, token_utility_1.buildTokenPair)(accessToken, raw);
        });
    }
    async logout(refreshToken) {
        const tokenHash = (0, token_utility_1.hashToken)(refreshToken);
        await prisma_client_1.prisma.refresh_Token.updateMany({
            where: { token_hash: tokenHash, revoked_at: null },
            data: { revoked_at: new Date() },
        });
    }
    async logoutAll(userId) {
        await prisma_client_1.prisma.refresh_Token.updateMany({
            where: { user_id: userId, revoked_at: null },
            data: { revoked_at: new Date() },
        });
        logger_util_1.logger.info('All refresh tokens revoked', { userId });
    }
    async _issueTokens(userId, ipAddress, userAgent) {
        const user = await prisma_client_1.prisma.user.findUniqueOrThrow({
            where: { id: userId },
            include: prisma_types_1.userWithRolesInclude,
        });
        const accessToken = this._generateUserAccessToken(user);
        const { raw, hash, expiresAt } = (0, token_utility_1.generateRefreshToken)();
        await prisma_client_1.prisma.refresh_Token.create({
            data: {
                user_id: userId,
                token_hash: hash,
                expires_at: expiresAt,
                ip_address: ipAddress,
                user_agent: userAgent,
            },
        });
        return (0, token_utility_1.buildTokenPair)(accessToken, raw);
    }
    _generateUserAccessToken(user) {
        const now = new Date();
        const activeUserRoles = user.user_roles.filter((ur) => ur.expires_at === null || ur.expires_at > now);
        const roles = activeUserRoles.map((ur) => ur.role.name);
        const permissions = [
            ...new Set(activeUserRoles.flatMap((ur) => ur.role.role_permissions.map((rp) => rp.permission.slug))),
        ];
        return (0, token_utility_1.generateAccessToken)({
            sub: user.id,
            email: user.email,
            displayName: user.display_name ?? `${user.first_name} ${user.last_name}`,
            roles,
            permissions,
            isSuperAdmin: user.is_super_admin,
        });
    }
}
exports.AuthService = AuthService;
//# sourceMappingURL=auth.service.js.map