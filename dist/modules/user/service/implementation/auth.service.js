"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthService = void 0;
// src/modules/user/service/implementation/auth.service.ts
const prisma_client_1 = require("../../../../shared/prisma/prisma.client");
const app_error_1 = require("../../../../shared/errors/app.error");
const logger_util_1 = require("../../../../shared/utils/logger.util");
const app_config_1 = require("../../../../shared/config/app.config");
const user_response_dto_1 = require("../../dto/response/user.response.dto");
const token_utility_1 = require("../../utility/token.utility");
const oidc_client_1 = require("../client/oidc.client");
const prisma_types_1 = require("../../../../shared/prisma/prisma.types");
class AuthService {
    userService;
    oidcClient;
    constructor(userService) {
        this.userService = userService;
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
        const tokens = await this._issueTokens(user.id, ipAddress, userAgent);
        await prisma_client_1.prisma.user.update({
            where: { id: user.id },
            data: { last_login_at: new Date() },
        });
        logger_util_1.logger.info('User logged in via password', { userId: user.id });
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
            if (storedToken.revoked_at) {
                // Token reuse detected — revoke all tokens for security
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
            if (!storedToken.user.is_active) {
                throw app_error_1.AppError.unauthorized('Account is deactivated');
            }
            // Atomic compare-and-swap: the conditional updateMany re-evaluates the
            // predicate after acquiring the row lock, so only one concurrent
            // refresh request can flip revoked_at from null to a timestamp.
            const revokeResult = await tx.refresh_Token.updateMany({
                where: { id: storedToken.id, revoked_at: null },
                data: { revoked_at: new Date() },
            });
            if (revokeResult.count === 0) {
                logger_util_1.logger.warn('Refresh token reuse detected (concurrent rotation)', {
                    userId: storedToken.user_id,
                });
                throw app_error_1.AppError.unauthorized('Refresh token has been revoked');
            }
            // Issue new tokens within the same transaction so the revocation and
            // issuance commit atomically.
            const userForToken = await tx.user.findUniqueOrThrow({
                where: { id: storedToken.user_id },
                select: {
                    id: true,
                    email: true,
                    display_name: true,
                    first_name: true,
                    last_name: true,
                },
            });
            const accessToken = (0, token_utility_1.generateAccessToken)({
                sub: userForToken.id,
                email: userForToken.email,
                displayName: userForToken.display_name ??
                    `${userForToken.first_name} ${userForToken.last_name}`,
            });
            const { raw, hash, expiresAt } = (0, token_utility_1.generateRefreshToken)();
            await tx.refresh_Token.create({
                data: {
                    user_id: storedToken.user_id,
                    token_hash: hash,
                    expires_at: expiresAt,
                    ip_address: ipAddress,
                },
            });
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
            select: { id: true, email: true, display_name: true, first_name: true, last_name: true },
        });
        const accessToken = (0, token_utility_1.generateAccessToken)({
            sub: user.id,
            email: user.email,
            displayName: user.display_name ?? `${user.first_name} ${user.last_name}`,
        });
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
}
exports.AuthService = AuthService;
//# sourceMappingURL=auth.service.js.map