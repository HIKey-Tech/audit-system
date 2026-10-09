import { ChainVerificationResult } from '../../utility/audit-log-hash.util';
import { ExportFormat, TabularExportFile } from '../../../../shared/utils/tabular-export.util';
import { PaginationMeta } from '../../../../shared/types/api-response.type';
import { IAuditLogService, CreateAuditLogDto } from '../interface/audit-log.service.interface';
import { AuditLogListQueryDto, AuditLogSummaryQueryDto, SecuritySummaryQueryDto } from '../../dto/request/logging.request.dto';
import { AuditLogResponseDto, AuditLogSummaryDto, SecuritySummaryDto } from '../../dto/response/logging.response.dto';
export declare class AuditLogService implements IAuditLogService {
    private _chainLock;
    private _lastRowHash;
    log(dto: CreateAuditLogDto): Promise<void>;
    /** Append one sealed row, serialized against every other append in this process. */
    private _appendSealed;
    /** Walk the sealed chain and report the first break, if any. */
    verifyChain(): Promise<ChainVerificationResult>;
    logAsync(dto: CreateAuditLogDto): void;
    listLogs(query: AuditLogListQueryDto): Promise<{
        logs: AuditLogResponseDto[];
        meta: PaginationMeta;
    }>;
    exportLogs(query: AuditLogListQueryDto, format: ExportFormat, actorId: string): Promise<TabularExportFile>;
    getSecuritySummary(query: SecuritySummaryQueryDto): Promise<SecuritySummaryDto>;
    listSecurityEvents(since: Date, limit: number): Promise<AuditLogResponseDto[]>;
    getLogById(id: string): Promise<AuditLogResponseDto>;
    getDistinctModules(): Promise<string[]>;
    getLogSummary(query: AuditLogSummaryQueryDto): Promise<AuditLogSummaryDto[]>;
    private _buildWhere;
    private _buildDateWhere;
}
export declare const auditLogService: AuditLogService;
//# sourceMappingURL=audit-log.service.d.ts.map