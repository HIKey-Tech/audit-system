// src/modules/user/service/interface/auth.service.interface.ts
import { TokenPair } from '../../domain/entity/token.entity';
import {
  LoginRequestDto,
  RefreshTokenRequestDto,
} from '../../dto/request/auth.request.dto';
import { AuthResponseDto, SsoRedirectResponseDto } from '../../dto/response/user.response.dto';

export interface IAuthService {
  /**
   * Authenticate user with email/password (local accounts only)
   */
  login(
    dto: LoginRequestDto,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<AuthResponseDto>;

  /**
   * Generate the SSO authorization URL to redirect the client to
   */
  getSsoAuthorizationUrl(state?: string): Promise<SsoRedirectResponseDto>;

  /**
   * Handle the OIDC callback — exchange code for tokens, provision user
   */
  handleOidcCallback(
    code: string,
    state: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<AuthResponseDto>;

  /**
   * Issue a new access token from a valid refresh token
   */
  refreshToken(
    dto: RefreshTokenRequestDto,
    ipAddress?: string,
  ): Promise<TokenPair>;

  /**
   * Revoke a refresh token (logout)
   */
  logout(refreshToken: string): Promise<void>;

  /**
   * Revoke all refresh tokens for a user (logout everywhere)
   */
  logoutAll(userId: string): Promise<void>;
}