// src/modules/user/service/implementation/auth.service.ts
import ms from 'ms';
import { prisma } from '../../../../shared/prisma/prisma.client';
import { AppError } from '../../../../shared/errors/app.error';
import { logger } from '../../../../shared/utils/logger.util';
import { config } from '../../../../shared/config/app.config';
import { IAuthService } from '../interface/auth.service.interface';
import { IUserService } from '../interface/user.service.interface';
import { IMfaService } from '../interface/mfa.service.interface';
import {
  LoginRequestDto,
  RefreshTokenRequestDto,
} from '../../dto/request/auth.request.dto';
import {
  AuthResponseDto,
  SsoRedirectResponseDto,
  LoginResultDto,
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
import { generateScopedToken } from '../../utility/mfa.utility';
import { createOidcClient, IOidcClient } from '../client/oidc.client';
import { userWithRolesInclude, UserWithRoles } from '../../../../shared/prisma/prisma.types';
import { revokeUserSessions } from '../../../../shared/security/session-guard';


export class AuthService implements IAuthService {
  private readonly oidcClient: IOidcClient;

  constructor(
    private readonly userService: IUserService,
    private readonly mfaService: IMfaService,
  ) {
    this.oidcClient = createOidcClient();
  }

  async login(
    dto: LoginRequestDto,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<LoginResultDto> {
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

    // ── 2FA gate ──────────────────────────────────────────────
    if (user.mfa_enabled) {
      const method = (user.mfa_method ?? 'totp') as 'totp' | 'email';
      if (method === 'email') {
        await this.mfaService.startEmailChallenge(user.id, user.email);
      }
      const challengeToken = generateScopedToken(
        user.id,
        user.email,
        'mfa_challenge',
        config.mfa.challengeTtl,
      );
      logger.info('Password OK — 2FA challenge issued', { userId: user.id, method });
      return { status: 'MFA_REQUIRED', method, challengeToken };
    }

    if (config.mfa.mandatory) {
      const now = new Date();
      // Grace deadline starts on the first login (lazy init), so existing
      // users get a full window from the moment this ships — never blocked
      // immediately. Once the deadline passes, enrolment is forced.
      const graceUntil =
        user.mfa_grace_until ??
        new Date(now.getTime() + config.mfa.gracePeriodDays * 86_400_000);

      if (graceUntil <= now) {
        const enrollmentToken = generateScopedToken(
          user.id,
          user.email,
          'mfa_enroll',
          config.mfa.enrollTtl,
        );
        logger.info('Password OK — 2FA grace expired, enrolment required', {
          userId: user.id,
        });
        return { status: 'MFA_ENROLLMENT_REQUIRED', enrollmentToken };
      }

      // Within grace: log in normally, but flag that setup is still pending.
      // Fix (Obs #1): issue tokens and persist the grace deadline atomically so
      // a crash between the two cannot grant a second full grace window.
      const tokens = await prisma.$transaction(async (tx) => {
        const issued = await this._issueTokens(user.id, ipAddress, userAgent, tx);
        await tx.user.update({
          where: { id: user.id },
          data: {
            last_login_at: now,
            // Persist the deadline the first time we compute it.
            ...(user.mfa_grace_until ? {} : { mfa_grace_until: graceUntil }),
          },
        });
        return issued;
      });
      logger.info('User logged in via password (2FA grace active)', { userId: user.id });
      return {
        status: 'OK',
        mfaSetupRequired: true,
        ...tokens,
        user: mapUserToResponse(user),
      };
    }

    // No 2FA required (mandatory disabled) — issue tokens directly.
    const tokens = await this._issueTokens(user.id, ipAddress, userAgent);

    await prisma.user.update({
      where: { id: user.id },
      data: { last_login_at: new Date() },
    });

    logger.info('User logged in via password', { userId: user.id });

    return {
      status: 'OK',
      ...tokens,
      user: mapUserToResponse(user),
    };
  }

  async completeMfaLogin(
    userId: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<AuthResponseDto> {
    // Bug fix: use findUnique with deleted_at:null so a user soft-deleted
    // between password-OK and MFA-verify cannot complete login.
    const user = (await prisma.user.findUnique({
      where: { id: userId, deleted_at: null },
      include: userWithRolesInclude,
    })) as UserWithRoles | null;

    if (!user) {
      throw AppError.unauthorized('Invalid credentials');
    }

    if (!user.is_active) {
      throw AppError.unauthorized('Account is deactivated');
    }

    const tokens = await this._issueTokens(user.id, ipAddress, userAgent);

    await prisma.user.update({
      where: { id: user.id },
      data: { last_login_at: new Date() },
    });

    logger.info('User completed 2FA login', { userId: user.id });

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

    // Trust the IdP for MFA (no IAMS double-prompt on SSO), but verify it
    // actually happened when policy requires it: the `amr` claim must include
    // "mfa". Otherwise reject the login.
    if (config.oidc.requireIdpMfa) {
      const amr = result.profile.authMethods ?? [];
      if (!amr.includes('mfa')) {
        logger.warn('SSO login rejected — IdP did not assert MFA', {
          oid: result.profile.oid,
          amr,
        });
        throw AppError.unauthorized(
          'Multi-factor authentication is required. Please complete MFA with your identity provider.',
        );
      }
    }

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

      if (!storedToken.user.is_active) {
        throw AppError.unauthorized('Account is deactivated');
      }

      // ── Already-revoked token presented ────────────────────────────────
      // This is normal when several clients share one refresh cookie (e.g.
      // multiple browser tabs): one rotates the token, the others arrive a
      // moment later still holding the token that was just rotated out. That
      // is NOT theft — blindly revoking every session here is exactly what was
      // bouncing users to the login screen several times an hour.
      if (storedToken.revoked_at) {
        const replacedById = storedToken.replaced_by;
        const withinGrace =
          replacedById !== null &&
          Date.now() - storedToken.revoked_at.getTime() <
            ms(config.jwt.refreshRotationGrace);

        if (withinGrace) {
          // Forgive the reuse only while the legitimate successor is still
          // live. If the successor was itself revoked (logout, or a real
          // theft response), fall through to the hard revoke-all below.
          const successor = await tx.refresh_Token.findUnique({
            where: { id: replacedById! },
          });

          if (
            successor &&
            !successor.revoked_at &&
            successor.expires_at > new Date()
          ) {
            const accessToken = this._generateUserAccessToken(
              storedToken.user as UserWithRoles,
            );
            const { raw, hash, expiresAt } = generateRefreshToken();
            await tx.refresh_Token.create({
              data: {
                user_id: storedToken.user_id,
                token_hash: hash,
                expires_at: expiresAt,
                ip_address: ipAddress,
              },
            });
            logger.info('Refresh within rotation grace — benign concurrent refresh', {
              userId: storedToken.user_id,
            });
            return buildTokenPair(accessToken, raw);
          }
        }

        // Genuine replay of a dead token — revoke everything for security.
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

      // ── Normal rotation ────────────────────────────────────────────────
      // Issue the successor first so the old row can record the rotation link.
      // The conditional updateMany is an atomic compare-and-swap: only one
      // concurrent request can flip revoked_at, and the loser's freshly created
      // token is discarded when the transaction rolls back on throw.
      const accessToken = this._generateUserAccessToken(
        storedToken.user as UserWithRoles,
      );

      const { raw, hash, expiresAt } = generateRefreshToken();

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
        logger.warn('Refresh token reuse detected (concurrent rotation)', {
          userId: storedToken.user_id,
        });
        throw AppError.unauthorized('Refresh token has been revoked');
      }

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
    // Also invalidate outstanding access tokens, not just refresh tokens.
    await revokeUserSessions(userId);
    logger.info('All refresh tokens revoked', { userId });
  }

  private async _issueTokens(
    userId: string,
    ipAddress?: string,
    userAgent?: string,
    tx?: Parameters<Parameters<typeof prisma.$transaction>[0]>[0],
  ): Promise<TokenPair> {
    const db = tx ?? prisma;
    const user = await db.user.findUniqueOrThrow({
      where: { id: userId },
      include: userWithRolesInclude,
    });

    const accessToken = this._generateUserAccessToken(user as UserWithRoles);

    const { raw, hash, expiresAt } = generateRefreshToken();

    await db.refresh_Token.create({
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
