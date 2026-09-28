import { PaginationMeta } from '../../../../../shared/types/api-response.type';
import { SystemAuditActor } from '../../../domain/entity/system-audit.entity';
import { ExtractFile, ServedExtract } from '../../../analytics/service/interface/analytics.service.interface';
import {
  CreateSystemDocumentDto,
  SystemDocumentListQueryDto,
  UpdateSystemDocumentDto,
  UploadSystemDocumentVersionDto,
} from '../../dto/request/documentation.request.dto';
import { SystemDocumentResponseDto, SystemDocumentSummaryDto } from '../../dto/response/documentation.response.dto';

/**
 * Library of policies, procedures, architecture and network diagrams, process
 * manuals, continuity plans, and IT contracts. Each item is linked to the audit
 * universe and/or an asset so auditors see what is relevant to their scope.
 */
export interface ISystemDocumentationService {
  create(dto: CreateSystemDocumentDto, file: ExtractFile, actor: SystemAuditActor): Promise<SystemDocumentResponseDto>;
  update(id: string, dto: UpdateSystemDocumentDto, actor: SystemAuditActor): Promise<SystemDocumentResponseDto>;
  uploadVersion(
    id: string,
    dto: UploadSystemDocumentVersionDto,
    file: ExtractFile,
    actor: SystemAuditActor,
  ): Promise<SystemDocumentResponseDto>;
  remove(id: string, actor: SystemAuditActor): Promise<void>;
  get(id: string): Promise<SystemDocumentResponseDto>;
  list(query: SystemDocumentListQueryDto, actor: SystemAuditActor): Promise<{ documents: SystemDocumentResponseDto[]; meta: PaginationMeta }>;
  summary(): Promise<SystemDocumentSummaryDto>;
  getFile(id: string, actor: SystemAuditActor): Promise<ServedExtract>;
}
