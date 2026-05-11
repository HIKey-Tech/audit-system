// src/modules/user/service/implementation/auth.service.ts
import { prisma } from '../../../../shared/prisma/prisma.client';
import { AppError } from '../../../../shared/errors/app.error';
import { logger } from '../../../../shared/utils/logger.util';
import { config } from '../../../../shared/config/app.config';
import { IAuthService } from '../interface/auth.service.interface';
import { IUserService } from '../interface/user.service.interface';
import {
  LoginRequestDto,
  RefreshTokenRequestDto,
} from '../../dto/request/auth.request.dto';
import {
  AuthResponseDto,
  SsoRedirectResponseDto,
  mapUserToResponse,
} from '../../dto/response/user.response.dto';
import { TokenPair } from '../../domain/entity/token.entity';
import {
  generateAccessToken,
  generateRefreshToken,
  comparePassword,
  hashToken,
  buildTokenPair,
} from '../../utility/token.utility';
import { createOidcClient, IOidcClient } from '../client/oidc.client';
import { userWithRolesInclude, UserWithRoles } from '../../../../shared/prisma/prisma.types';


export class AuthService implements IAuthService {
  private readonly oidcClient: IOidcClient;

  constructor(private readonly userService: IUserService) {
    this.oidcClient = createOidcClient();
  }

  async login(
    dto: LoginRequestDto,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<AuthResponseDto> {
    const user = await prisma.user.findUnique({
      where: { email: dto.email, deleted_at: null },
      include: userWithRolesInclude,
    }) as UserWithRoles | null;

    if (!user || !user.password_hash) {
      throw AppError.unauthorized('Invalid credentials');
    }

    if (!user.is_active) {
      throw AppError.unauthorized('Account is deactivated');
    }

    const passwordValid = await comparePassword(dto.password, user.password_hash);
    if (!passwordValid) {
      throw AppError.unauthorized('Invalid credentials');
    }

    const tokens = await this._issueTokens(user.id, ipAddress, userAgent);

    await prisma.user.update({
      where: { id: user.id },
      data: { last_login_at: new Date() },
    });

    logger.info('User logged in via password', { userId: user.id });

    return {
      ...tokens,
      user: mapUserToResponse(user),
    };
  }

  async getSsoAuthorizationUrl(state?: string): Promise<SsoRedirectResponseDto> {
    const { url, state: generatedState } =
      await this.oidcClient.getAuthorizationUrl(state);
    return { authorizationUrl: url, state: generatedState };
  }

  async handleOidcCallback(
    code: string,
    state: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<AuthResponseDto> {
    const result = await this.oidcClient.handleCallback(code, state);

    // Provision or sync the user
    const userDto = await this.userService.syncFromAzureAd(
      result.profile.oid,
      result.profile,
    );

    const user = await prisma.user.findUniqueOrThrow({
      where: { id: userDto.id },
      include: userWithRolesInclude,
    }) as UserWithRoles;

    if (!user.is_active) {
      throw AppError.unauthorized('Account is deactivated');
    }

    const tokens = await this._issueTokens(user.id, ipAddress, userAgent);

    await prisma.user.update({
      where: { id: user.id },
      data: { last_login_at: new Date() },
    });

    logger.info('User logged in via SSO', { userId: user.id, provider: config.oidc.provider });

    return {
      ...tokens,
      user: mapUserToResponse(user),
    };
  }

  async refreshToken(
    dto: RefreshTokenRequestDto,
    ipAddress?: string,
  ): Promise<TokenPair> {
    const tokenHash = hashToken(dto.refreshToken);

    return prisma.$transaction(async (tx) => {
      const storedToken = await tx.refresh_Token.findUnique({
        where: { token_hash: tokenHash },
        include: { user: { include: userWithRolesInclude } },
      });

      if (!storedToken) {
        throw AppError.unauthorized('Invalid refresh token');
      }

      if (storedToken.revoked_at) {
        // Token reuse detected — revoke all tokens for security
        await tx.refresh_Token.updateMany({
          where: { user_id: storedToken.user_id, revoked_at: null },
          data: { revoked_at: new Date() },
        });
        logger.warn('Refresh token reuse detected', { userId: storedToken.user_id });
        throw AppError.unauthorized('Refresh token has been revoked');
      }

      if (storedToken.expires_at < new Date()) {
        throw AppError.unauthorized('Refresh token has expired');
      }

      if (!storedToken.user.is_active) {
        throw AppError.unauthorized('Account is deactivated');
      }

      // Atomic compare-and-swap: the conditional updateMany re-evaluates the
      // predicate after acquiring the row lock, so only one concurrent
      // refresh request can flip revoked_at from null to a timestamp.
      const revokeResult = await tx.refresh_Token.updateMany({
        where: { id: storedToken.id, revoked_at: null },
        data: { revoked_at: new Date() },
      });

      if (revokeResult.count === 0) {
        logger.warn('Refresh token reuse detected (concurrent rotation)', {
          userId: storedToken.user_id,
        });
        throw AppError.unauthorized('Refresh token has been revoked');
      }

      // Issue new tokens within the same transaction so the revocation and
      // issuance commit atomically.
      const userForToken = await tx.user.findUniqueOrThrow({
        where: { id: storedToken.user_id },
        include: userWithRolesInclude,
      });

      const accessToken = this._generateUserAccessToken(userForToken as UserWithRoles);

      const { raw, hash, expiresAt } = generateRefreshToken();

      await tx.refresh_Token.create({
        data: {
          user_id: storedToken.user_id,
          token_hash: hash,
          expires_at: expiresAt,
          ip_address: ipAddress,
        },
      });

      return buildTokenPair(accessToken, raw);
    });
  }

  async logout(refreshToken: string): Promise<void> {
    const tokenHash = hashToken(refreshToken);
    await prisma.refresh_Token.updateMany({
      where: { token_hash: tokenHash, revoked_at: null },
      data: { revoked_at: new Date() },
    });
  }

  async logoutAll(userId: string): Promise<void> {
    await prisma.refresh_Token.updateMany({
      where: { user_id: userId, revoked_at: null },
      data: { revoked_at: new Date() },
    });
    logger.info('All refresh tokens revoked', { userId });
  }

  private async _issueTokens(
    userId: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<TokenPair> {
    const user = await prisma.user.findUniqueOrThrow({
      where: { id: userId },
      include: userWithRolesInclude,
    });

    const accessToken = this._generateUserAccessToken(user as UserWithRoles);

    const { raw, hash, expiresAt } = generateRefreshToken();

    await prisma.refresh_Token.create({
      data: {
        user_id: userId,
        token_hash: hash,
        expires_at: expiresAt,
        ip_address: ipAddress,
        user_agent: userAgent,
      },
    });

    return buildTokenPair(accessToken, raw);
  }

  private _generateUserAccessToken(user: UserWithRoles): string {
    type UserRoleWithPermissions = UserWithRoles['user_roles'][number];
    type RolePermission = UserRoleWithPermissions['role']['role_permissions'][number];

    const now = new Date();
    const activeUserRoles = user.user_roles.filter(
      (ur: UserRoleWithPermissions) => ur.expires_at === null || ur.expires_at > now,
    );

    const roles = activeUserRoles.map((ur: UserRoleWithPermissions) => ur.role.name);
    const permissions = [
      ...new Set(
        activeUserRoles.flatMap((ur: UserRoleWithPermissions) =>
          ur.role.role_permissions.map((rp: RolePermission) => rp.permission.slug),
        ),
      ),
    ];

    return generateAccessToken({
      sub: user.id,
      email: user.email,
      displayName: user.display_name ?? `${user.first_name} ${user.last_name}`,
      roles,
      permissions,
      isSuperAdmin: user.is_super_admin,
    });
  }
}
