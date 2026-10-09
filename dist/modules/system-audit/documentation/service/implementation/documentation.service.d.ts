import { PaginationMeta } from '../../../../../shared/types/api-response.type';
import { IUserService } from '../../../../user/service/interface/user.service.interface';
import { IDocumentService } from '../../../../document/service/interface/document.service.interface';
import { IEngagementService } from '../../../../audit/engagement/service/interface/engagement.service.interface';
import { IUniverseService } from '../../../../audit/universe/service/interface/universe.service.interface';
import { IAssetService } from '../../../../asset/service/interface/asset.service.interface';
import { SystemAuditActor } from '../../../domain/entity/system-audit.entity';
import { ExtractFile, ServedExtract } from '../../../analytics/service/interface/analytics.service.interface';
import { CreateSystemDocumentDto, SystemDocumentListQueryDto, UpdateSystemDocumentDto, UploadSystemDocumentVersionDto } from '../../dto/request/documentation.request.dto';
import { SystemDocumentResponseDto, SystemDocumentSummaryDto } from '../../dto/response/documentation.response.dto';
import { ISystemDocumentationService } from '../interface/documentation.service.interface';
export declare class SystemDocumentationService implements ISystemDocumentationService {
    private readonly documentService;
    private readonly userService;
    private readonly universeService;
    private readonly assetService;
    private readonly engagementService;
    constructor(documentService: IDocumentService, userService: IUserService, universeService: IUniverseService, assetService: IAssetService, engagementService: IEngagementService);
    create(dto: CreateSystemDocumentDto, file: ExtractFile, actor: SystemAuditActor): Promise<SystemDocumentResponseDto>;
    update(id: string, dto: UpdateSystemDocumentDto, actor: SystemAuditActor): Promise<SystemDocumentResponseDto>;
    uploadVersion(id: string, dto: UploadSystemDocumentVersionDto, file: ExtractFile, actor: SystemAuditActor): Promise<SystemDocumentResponseDto>;
    remove(id: string, actor: SystemAuditActor): Promise<void>;
    get(id: string): Promise<SystemDocumentResponseDto>;
    list(query: SystemDocumentListQueryDto, actor: SystemAuditActor): Promise<{
        documents: SystemDocumentResponseDto[];
        meta: PaginationMeta;
    }>;
    summary(): Promise<SystemDocumentSummaryDto>;
    getFile(id: string, actor: SystemAuditActor): Promise<ServedExtract>;
    private _getExisting;
    private _assertReferences;
    /** An engagement's scope: its audit-universe entity plus the assets linked to it. */
    private _engagementScope;
}
//# sourceMappingURL=documentation.service.d.ts.map