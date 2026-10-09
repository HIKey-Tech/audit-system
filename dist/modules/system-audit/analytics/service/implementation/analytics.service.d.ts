import { PaginationMeta } from '../../../../../shared/types/api-response.type';
import { ExportFormat, TabularExportFile } from '../../../../../shared/utils/tabular-export.util';
import { IUserService } from '../../../../user/service/interface/user.service.interface';
import { IEvidenceService } from '../../../../audit/evidence/service/interface/evidence.service.interface';
import { IDocumentService } from '../../../../document/service/interface/document.service.interface';
import { IEngagementService } from '../../../../audit/engagement/service/interface/engagement.service.interface';
import { IFindingService } from '../../../../audit/findings/service/interface/finding.service.interface';
import { SystemAuditActor } from '../../../domain/entity/system-audit.entity';
import { RunTrigger } from '../../../domain/enum/system-audit.enum';
import { CompleteReviewDto, DispositionExceptionsDto, ExceptionListQueryDto, PreviewExtractDto, RaiseFindingDto, RunListQueryDto, RunLiveAnalysisDto, RunUploadAnalysisDto } from '../../dto/request/analytics.request.dto';
import { AnalysisTypeResponseDto, ExceptionResponseDto, ExtractPreviewResponseDto, RunDetailResponseDto, RunResponseDto } from '../../dto/response/analytics.response.dto';
import { ExtractFile, ISystemAuditAnalyticsService, ServedExtract } from '../interface/analytics.service.interface';
import { ILiveSourceService } from '../interface/live-source.service.interface';
export declare class SystemAuditAnalyticsService implements ISystemAuditAnalyticsService {
    private readonly liveSources;
    private readonly userService;
    private readonly evidenceService;
    private readonly documentService;
    private readonly engagementService;
    private readonly findingService;
    constructor(liveSources: ILiveSourceService, userService: IUserService, evidenceService: IEvidenceService, documentService: IDocumentService, engagementService: IEngagementService, findingService: IFindingService);
    listAnalysisTypes(): AnalysisTypeResponseDto[];
    previewExtract(dto: PreviewExtractDto, file: ExtractFile): ExtractPreviewResponseDto;
    runUploadAnalysis(dto: RunUploadAnalysisDto, file: ExtractFile, actor: SystemAuditActor): Promise<RunDetailResponseDto>;
    runLiveAnalysis(dto: RunLiveAnalysisDto, actor: SystemAuditActor, trigger?: RunTrigger): Promise<RunDetailResponseDto>;
    listRuns(query: RunListQueryDto, actor: SystemAuditActor): Promise<{
        runs: RunResponseDto[];
        meta: PaginationMeta;
    }>;
    getRun(id: string, actor: SystemAuditActor): Promise<RunDetailResponseDto>;
    listExceptions(runId: string, query: ExceptionListQueryDto, actor: SystemAuditActor): Promise<{
        exceptions: ExceptionResponseDto[];
        meta: PaginationMeta;
    }>;
    exportExceptions(runId: string, format: ExportFormat, actor: SystemAuditActor): Promise<TabularExportFile>;
    getExtractFile(runId: string, actor: SystemAuditActor): Promise<ServedExtract>;
    dispositionExceptions(dto: DispositionExceptionsDto, actor: SystemAuditActor): Promise<{
        updated: number;
    }>;
    raiseFinding(runId: string, dto: RaiseFindingDto, actor: SystemAuditActor): Promise<{
        findingId: string;
        linkedExceptions: number;
    }>;
    markBaseline(runId: string, actor: SystemAuditActor): Promise<RunDetailResponseDto>;
    completeReview(runId: string, dto: CompleteReviewDto, actor: SystemAuditActor): Promise<RunDetailResponseDto>;
    assertRunVisible(runId: string, actor: SystemAuditActor): Promise<{
        id: string;
        analysisType: string;
        reviewStatus: string;
    }>;
    /**
     * Runs on an engagement are visible to its team and to oversight; runs with
     * no engagement (organisation-wide reviews, continuous monitoring) are
     * visible to every holder of sysaudit:read.
     */
    private _visibility;
    private _assertEngagementAccess;
    private _assertSecurityTest;
    private _resolveMapping;
    private _parseParameters;
    private _enrichContext;
    private _directory;
    private _findBaseline;
    private _analyse;
    private _storeExtract;
    private _persistRun;
    private _sortedExceptions;
    private _exceptionCounts;
    private _toResponse;
}
//# sourceMappingURL=analytics.service.d.ts.map