import { PaginationMeta } from '../../../../../shared/types/api-response.type';
import { ExportFormat, TabularExportFile } from '../../../../../shared/utils/tabular-export.util';
import { SystemAuditActor } from '../../../domain/entity/system-audit.entity';
import { RunTrigger } from '../../../domain/enum/system-audit.enum';
import {
  CompleteReviewDto,
  DispositionExceptionsDto,
  ExceptionListQueryDto,
  PreviewExtractDto,
  RaiseFindingDto,
  RunListQueryDto,
  RunLiveAnalysisDto,
  RunUploadAnalysisDto,
} from '../../dto/request/analytics.request.dto';
import {
  AnalysisTypeResponseDto,
  ExceptionResponseDto,
  ExtractPreviewResponseDto,
  RunDetailResponseDto,
  RunResponseDto,
} from '../../dto/response/analytics.response.dto';

export interface ExtractFile {
  originalName: string;
  mimeType: string;
  fileSize: number;
  buffer: Buffer;
}

export interface ServedExtract {
  buffer: Buffer;
  mimeType: string;
  originalName: string;
}

/**
 * Computer-assisted audit techniques over GBB system data. Every run is an
 * immutable record: the extract (hashed, stored as evidence), the parameters
 * used, and the exceptions found. Auditors disposition exceptions and raise
 * confirmed ones as findings; nothing is ever written back to the source.
 */
export interface ISystemAuditAnalyticsService {
  listAnalysisTypes(): AnalysisTypeResponseDto[];
  previewExtract(dto: PreviewExtractDto, file: ExtractFile): ExtractPreviewResponseDto;
  runUploadAnalysis(dto: RunUploadAnalysisDto, file: ExtractFile, actor: SystemAuditActor): Promise<RunDetailResponseDto>;
  /** `trigger = scheduled` is used by continuous monitoring; the run then has no creator. */
  runLiveAnalysis(dto: RunLiveAnalysisDto, actor: SystemAuditActor, trigger?: RunTrigger): Promise<RunDetailResponseDto>;
  listRuns(query: RunListQueryDto, actor: SystemAuditActor): Promise<{ runs: RunResponseDto[]; meta: PaginationMeta }>;
  getRun(id: string, actor: SystemAuditActor): Promise<RunDetailResponseDto>;
  listExceptions(
    runId: string,
    query: ExceptionListQueryDto,
    actor: SystemAuditActor,
  ): Promise<{ exceptions: ExceptionResponseDto[]; meta: PaginationMeta }>;
  exportExceptions(runId: string, format: ExportFormat, actor: SystemAuditActor): Promise<TabularExportFile>;
  getExtractFile(runId: string, actor: SystemAuditActor): Promise<ServedExtract>;
  dispositionExceptions(dto: DispositionExceptionsDto, actor: SystemAuditActor): Promise<{ updated: number }>;
  raiseFinding(runId: string, dto: RaiseFindingDto, actor: SystemAuditActor): Promise<{ findingId: string; linkedExceptions: number }>;
  markBaseline(runId: string, actor: SystemAuditActor): Promise<RunDetailResponseDto>;
  completeReview(runId: string, dto: CompleteReviewDto, actor: SystemAuditActor): Promise<RunDetailResponseDto>;
  /** Visibility guard shared with the access-review service. */
  assertRunVisible(runId: string, actor: SystemAuditActor): Promise<{ id: string; analysisType: string; reviewStatus: string }>;
}
