import { PaginationMeta } from '../../../../../shared/types/api-response.type';
import { IUserService } from '../../../../user/service/interface/user.service.interface';
import { IDocumentService } from '../../../../document/service/interface/document.service.interface';
import { IEngagementService } from '../../../../audit/engagement/service/interface/engagement.service.interface';
import { IAssetService } from '../../../../asset/service/interface/asset.service.interface';
import { SystemAuditActor } from '../../../domain/entity/system-audit.entity';
import { ExtractFile, ServedExtract } from '../../../analytics/service/interface/analytics.service.interface';
import { AuthoriseSecurityTestDto, ChangeSecurityTestStatusDto, CreateSecurityTestDto, SecurityTestAssetsDto, SecurityTestListQueryDto, UpdateSecurityTestDto } from '../../dto/request/security-test.request.dto';
import { SecurityTestDetailResponseDto, SecurityTestResponseDto } from '../../dto/response/security-test.response.dto';
import { ISecurityTestService } from '../interface/security-test.service.interface';
export declare class SecurityTestService implements ISecurityTestService {
    private readonly userService;
    private readonly documentService;
    private readonly engagementService;
    private readonly assetService;
    constructor(userService: IUserService, documentService: IDocumentService, engagementService: IEngagementService, assetService: IAssetService);
    createTest(dto: CreateSecurityTestDto, actor: SystemAuditActor): Promise<SecurityTestDetailResponseDto>;
    updateTest(id: string, dto: UpdateSecurityTestDto, actor: SystemAuditActor): Promise<SecurityTestDetailResponseDto>;
    deleteTest(id: string, actor: SystemAuditActor): Promise<void>;
    getTest(id: string, actor: SystemAuditActor): Promise<SecurityTestDetailResponseDto>;
    listTests(query: SecurityTestListQueryDto, actor: SystemAuditActor): Promise<{
        tests: SecurityTestResponseDto[];
        meta: PaginationMeta;
    }>;
    authoriseTest(id: string, dto: AuthoriseSecurityTestDto, actor: SystemAuditActor): Promise<SecurityTestDetailResponseDto>;
    changeStatus(id: string, dto: ChangeSecurityTestStatusDto, actor: SystemAuditActor): Promise<SecurityTestDetailResponseDto>;
    addAssets(id: string, dto: SecurityTestAssetsDto, actor: SystemAuditActor): Promise<SecurityTestDetailResponseDto>;
    removeAsset(id: string, assetId: string, actor: SystemAuditActor): Promise<SecurityTestDetailResponseDto>;
    uploadReport(id: string, file: ExtractFile, actor: SystemAuditActor): Promise<SecurityTestDetailResponseDto>;
    getReportFile(id: string, actor: SystemAuditActor): Promise<ServedExtract>;
    /** Tests on an engagement follow its team; others are visible to every sectest:read holder. */
    private _visibility;
    private _getVisible;
    private _assertEngagementAccess;
    private _assertAssets;
    private _results;
}
//# sourceMappingURL=security-test.service.d.ts.map