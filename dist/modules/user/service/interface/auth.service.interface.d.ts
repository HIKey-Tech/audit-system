import { TokenPair } from '../../domain/entity/token.entity';
import { LoginRequestDto, RefreshTokenRequestDto } from '../../dto/request/auth.request.dto';
import { AuthResponseDto, SsoRedirectResponseDto, LoginResultDto } from '../../dto/response/user.response.dto';
export interface IAuthService {
    /**
     * Authenticate user with email/password (local accounts only). Returns either
     * a full token pair or an intermediate 2FA state.
     */
    login(dto: LoginRequestDto, ipAddress?: string, userAgent?: string): Promise<LoginResultDto>;
    /**
     * Issue the real token pair after a 2FA challenge or enrolment succeeds.
     */
    completeMfaLogin(userId: string, ipAddress?: string, userAgent?: string): Promise<AuthResponseDto>;
    /**
     * Generate the SSO authorization URL to redirect the client to
     */
    getSsoAuthorizationUrl(state?: string): Promise<SsoRedirectResponseDto>;
    /**
     * Handle the OIDC callback — exchange code for tokens, provision user
     */
    handleOidcCallback(code: string, state: string, ipAddress?: string, userAgent?: string): Promise<AuthResponseDto>;
    /**
     * Issue a new access token from a valid refresh token
     */
    refreshToken(dto: RefreshTokenRequestDto, ipAddress?: string): Promise<TokenPair>;
    /**
     * Revoke a refresh token (logout)
     */
    logout(refreshToken: string): Promise<void>;
    /**
     * Revoke all refresh tokens for a user (logout everywhere)
     */
    logoutAll(userId: string): Promise<void>;
}
//# sourceMappingURL=auth.service.interface.d.ts.map