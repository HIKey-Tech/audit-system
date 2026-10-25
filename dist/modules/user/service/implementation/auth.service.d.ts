import { IAuthService } from '../interface/auth.service.interface';
import { IUserService } from '../interface/user.service.interface';
import { IMfaService } from '../interface/mfa.service.interface';
import { LoginRequestDto, RefreshTokenRequestDto } from '../../dto/request/auth.request.dto';
import { AuthResponseDto, SsoRedirectResponseDto, LoginResultDto } from '../../dto/response/user.response.dto';
import { TokenPair } from '../../domain/entity/token.entity';
import { ILdapClient } from '../client/ldap.client';
export declare class AuthService implements IAuthService {
    private readonly userService;
    private readonly mfaService;
    private readonly oidcClient;
    private readonly ldapClient;
    constructor(userService: IUserService, mfaService: IMfaService, ldapClient?: ILdapClient);
    login(dto: LoginRequestDto, ipAddress?: string, userAgent?: string): Promise<LoginResultDto>;
    private _completeLogin;
    /** Emails the user that their account was just signed in to. Never blocks or fails a login. */
    private _sendLoginNotice;
    completeMfaLogin(userId: string, ipAddress?: string, userAgent?: string): Promise<AuthResponseDto>;
    getSsoAuthorizationUrl(state?: string): Promise<SsoRedirectResponseDto>;
    handleOidcCallback(code: string, state: string, ipAddress?: string, userAgent?: string): Promise<AuthResponseDto>;
    refreshToken(dto: RefreshTokenRequestDto, ipAddress?: string): Promise<TokenPair>;
    logout(refreshToken: string): Promise<void>;
    logoutAll(userId: string): Promise<void>;
    private _issueTokens;
    private _generateUserAccessToken;
}
//# sourceMappingURL=auth.service.d.ts.map