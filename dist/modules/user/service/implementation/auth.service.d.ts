import { IAuthService } from '../interface/auth.service.interface';
import { IUserService } from '../interface/user.service.interface';
import { LoginRequestDto, RefreshTokenRequestDto } from '../../dto/request/auth.request.dto';
import { AuthResponseDto, SsoRedirectResponseDto } from '../../dto/response/user.response.dto';
import { TokenPair } from '../../domain/entity/token.entity';
export declare class AuthService implements IAuthService {
    private readonly userService;
    private readonly oidcClient;
    constructor(userService: IUserService);
    login(dto: LoginRequestDto, ipAddress?: string, userAgent?: string): Promise<AuthResponseDto>;
    getSsoAuthorizationUrl(state?: string): Promise<SsoRedirectResponseDto>;
    handleOidcCallback(code: string, state: string, ipAddress?: string, userAgent?: string): Promise<AuthResponseDto>;
    refreshToken(dto: RefreshTokenRequestDto, ipAddress?: string): Promise<TokenPair>;
    logout(refreshToken: string): Promise<void>;
    logoutAll(userId: string): Promise<void>;
    private _issueTokens;
    private _generateUserAccessToken;
}
//# sourceMappingURL=auth.service.d.ts.map