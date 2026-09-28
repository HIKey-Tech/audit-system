import { PaginationMeta } from '../../../../../shared/types/api-response.type';
import { SystemAuditActor } from '../../../domain/entity/system-audit.entity';
import { ExtractFile, ServedExtract } from '../../../analytics/service/interface/analytics.service.interface';
import {
  AuthoriseSecurityTestDto,
  ChangeSecurityTestStatusDto,
  CreateSecurityTestDto,
  SecurityTestAssetsDto,
  SecurityTestListQueryDto,
  UpdateSecurityTestDto,
} from '../../dto/request/security-test.request.dto';
import { SecurityTestDetailResponseDto, SecurityTestResponseDto } from '../../dto/response/security-test.response.dto';

/**
 * Coordination of vulnerability assessments and penetration tests: scope and
 * schedule, written authorisation (never by the coordinator), provider,
 * report, and the scan-result analyses that feed remediation findings.
 */
export interface ISecurityTestService {
  createTest(dto: CreateSecurityTestDto, actor: SystemAuditActor): Promise<SecurityTestDetailResponseDto>;
  updateTest(id: string, dto: UpdateSecurityTestDto, actor: SystemAuditActor): Promise<SecurityTestDetailResponseDto>;
  deleteTest(id: string, actor: SystemAuditActor): Promise<void>;
  getTest(id: string, actor: SystemAuditActor): Promise<SecurityTestDetailResponseDto>;
  listTests(query: SecurityTestListQueryDto, actor: SystemAuditActor): Promise<{ tests: SecurityTestResponseDto[]; meta: PaginationMeta }>;
  authoriseTest(id: string, dto: AuthoriseSecurityTestDto, actor: SystemAuditActor): Promise<SecurityTestDetailResponseDto>;
  changeStatus(id: string, dto: ChangeSecurityTestStatusDto, actor: SystemAuditActor): Promise<SecurityTestDetailResponseDto>;
  addAssets(id: string, dto: SecurityTestAssetsDto, actor: SystemAuditActor): Promise<SecurityTestDetailResponseDto>;
  removeAsset(id: string, assetId: string, actor: SystemAuditActor): Promise<SecurityTestDetailResponseDto>;
  uploadReport(id: string, file: ExtractFile, actor: SystemAuditActor): Promise<SecurityTestDetailResponseDto>;
  getReportFile(id: string, actor: SystemAuditActor): Promise<ServedExtract>;
}
