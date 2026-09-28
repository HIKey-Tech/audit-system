import { createHash, randomUUID } from 'crypto';
import { Prisma } from '@prisma/client';
import { ZodError } from 'zod';
import { prisma } from '../../../../../shared/prisma/prisma.client';
import { AppError } from '../../../../../shared/errors/app.error';
import { logger } from '../../../../../shared/utils/logger.util';
import {
  PaginationMeta,
  buildPaginationMeta,
  parsePagination,
} from '../../../../../shared/types/api-response.type';
import { ExportFormat, TabularExportFile, buildTabularExport } from '../../../../../shared/utils/tabular-export.util';
import {
  SystemAuditRunWithRelations,
  systemAuditExceptionInclude,
  systemAuditRunInclude,
} from '../../../../../shared/prisma/prisma.types';
import { auditLogService } from '../../../../logging/service/implementation/audit-log.service';
import { IUserService } from '../../../../user/service/interface/user.service.interface';
import { IEvidenceService } from '../../../../audit/evidence/service/interface/evidence.service.interface';
import { IDocumentService } from '../../../../document/service/interface/document.service.interface';
import { IEngagementService } from '../../../../audit/engagement/service/interface/engagement.service.interface';
import { IFindingService } from '../../../../audit/findings/service/interface/finding.service.interface';
import {
  AnalysisRecord,
  AnalysisResult,
  AnalyzerContext,
  AnalyzerDefinition,
  ConfigurationSnapshot,
  DirectoryEntry,
  SystemAuditActor,
} from '../../../domain/entity/system-audit.entity';
import {
  AccessDecision,
  AnalysisSource,
  AnalysisType,
  ExceptionDisposition,
  ExceptionSeverity,
  RunReviewStatus,
  RunTrigger,
} from '../../../domain/enum/system-audit.enum';
import { ANALYZERS } from '../../../utility/analyzers';
import {
  ColumnMapping,
  missingRequiredFields,
  normaliseRecords,
  parseExtract,
  rawRecords,
  suggestMapping,
} from '../../../utility/extract-parser.utility';
import { SEVERITY_RANK, nextReference, parseJson } from '../../../utility/system-audit.utility';
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
  DispositionCounts,
  ExceptionResponseDto,
  ExtractPreviewResponseDto,
  RunDetailResponseDto,
  RunResponseDto,
  SeverityCounts,
  emptySeverityCounts,
  mapExceptionToResponse,
  mapRunToResponse,
} from '../../dto/response/analytics.response.dto';
import { ExtractFile, ISystemAuditAnalyticsService, ServedExtract } from '../interface/analytics.service.interface';
import { ILiveSourceService } from '../interface/live-source.service.interface';

const RUN_PREFIX = 'SAR';
const PREVIEW_ROWS = 5;
// A run is evidence, not a data store: keep the most severe hits and say so.
const MAX_STORED_EXCEPTIONS = 2000;
const MAX_ACCESS_ITEMS = 20_000;
// SQL Server allows ~2100 bound parameters per statement.
const EXCEPTION_CHUNK = 150;
const ACCESS_ITEM_CHUNK = 120;
const FINDING_EXCEPTION_LIST = 50;

interface PersistRunInput {
  id: string;
  analyzer: AnalyzerDefinition<unknown>;
  title: string;
  source: AnalysisSource;
  systemName: string;
  trigger: RunTrigger;
  engagementId: string | null;
  securityTestId: string | null;
  evidenceId: string | null;
  documentId: string | null;
  fileName: string | null;
  contentSha256: string | null;
  recordCount: number;
  parameters: Record<string, unknown>;
  baselineRunId: string | null;
  createdById: string | null;
  result: AnalysisResult;
}

interface RunCounts {
  severity: SeverityCounts;
  disposition: DispositionCounts;
  open: number;
}

const emptyDispositionCounts = (): DispositionCounts => ({ open: 0, confirmed: 0, false_positive: 0, explained: 0 });

const analyzerLabel = (type: string): string => ANALYZERS[type as AnalysisType]?.label ?? type;

const ruleLabel = (type: string, code: string): string =>
  ANALYZERS[type as AnalysisType]?.rules.find((r) => r.code === code)?.label ?? code;

const isUniqueViolation = (err: unknown): boolean =>
  err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002';

export class SystemAuditAnalyticsService implements ISystemAuditAnalyticsService {
  constructor(
    private readonly liveSources: ILiveSourceService,
    private readonly userService: IUserService,
    private readonly evidenceService: IEvidenceService,
    private readonly documentService: IDocumentService,
    private readonly engagementService: IEngagementService,
    private readonly findingService: IFindingService,
  ) {}

  listAnalysisTypes(): AnalysisTypeResponseDto[] {
    const live = this.liveSources.supportedSources();
    return Object.values(ANALYZERS).map((a) => ({
      type: a.type,
      label: a.label,
      description: a.description,
      controls: a.controls,
      fields: a.fields,
      rules: a.rules,
      defaultParameters: a.parametersSchema.parse({}),
      liveSources: live[a.type] ?? [],
    }));
  }

  previewExtract(dto: PreviewExtractDto, file: ExtractFile): ExtractPreviewResponseDto {
    const analyzer = ANALYZERS[dto.analysisType];
    const { headers, rows } = parseExtract(file.buffer, file.originalName);
    const suggestedMapping = suggestMapping(headers, analyzer.fields);
    return {
      analysisType: dto.analysisType,
      fileName: file.originalName,
      rowCount: rows.length,
      headers,
      sampleRows: rows.slice(0, PREVIEW_ROWS),
      suggestedMapping,
      missingRequired: missingRequiredFields(analyzer.fields, suggestedMapping).map((f) => ({ key: f.key, label: f.label })),
    };
  }

  async runUploadAnalysis(dto: RunUploadAnalysisDto, file: ExtractFile, actor: SystemAuditActor): Promise<RunDetailResponseDto> {
    const analyzer = ANALYZERS[dto.analysisType];
    if (dto.engagementId) await this._assertEngagementAccess(dto.engagementId, actor);
    if (dto.securityTestId) await this._assertSecurityTest(dto.securityTestId);

    const { headers, rows } = parseExtract(file.buffer, file.originalName);
    let records: AnalysisRecord[];
    let mappedFields: Set<string>;
    let mapping: ColumnMapping | null = null;
    let unreadableValues = 0;
    if (analyzer.fields.length === 0) {
      records = rawRecords(rows);
      mappedFields = new Set(headers);
    } else {
      mapping = this._resolveMapping(headers, analyzer, dto.mapping);
      const normalised = normaliseRecords(rows, analyzer.fields, mapping, dto.dateOrder);
      records = normalised.records;
      unreadableValues = normalised.unreadableValues;
      mappedFields = new Set(Object.entries(mapping).filter(([, h]) => h).map(([k]) => k));
    }

    const parameters = this._parseParameters(analyzer, dto.parameters ?? {}, {});
    const context: AnalyzerContext = { now: new Date(), mappedFields };
    await this._enrichContext(dto.analysisType, parameters, context);
    let baselineRunId: string | null = null;
    if (dto.analysisType === AnalysisType.Configuration) {
      const baseline = await this._findBaseline(dto.systemName, dto.baselineRunId);
      if (baseline) {
        context.baseline = baseline.snapshot;
        baselineRunId = baseline.id;
      }
    }

    const result = this._analyse(analyzer, records, parameters, context);
    if (unreadableValues > 0) result.summary.unreadableValues = unreadableValues;

    // Store the extract only once it has analysed cleanly, so rejected uploads leave no evidence behind.
    const runId = randomUUID();
    const stored = await this._storeExtract(runId, dto.engagementId ?? null, file, actor);

    await this._persistRun({
      id: runId,
      analyzer,
      title: dto.title ?? `${analyzer.label} — ${dto.systemName}`,
      source: AnalysisSource.Upload,
      systemName: dto.systemName,
      trigger: RunTrigger.Manual,
      engagementId: dto.engagementId ?? null,
      securityTestId: dto.securityTestId ?? null,
      evidenceId: stored.evidenceId,
      documentId: stored.documentId,
      fileName: file.originalName,
      contentSha256: createHash('sha256').update(file.buffer).digest('hex'),
      recordCount: records.length,
      parameters: { ...(parameters as Record<string, unknown>), columnMapping: mapping, dateOrder: dto.dateOrder },
      baselineRunId,
      createdById: actor.id,
      result,
    });

    return this.getRun(runId, actor);
  }

  async runLiveAnalysis(
    dto: RunLiveAnalysisDto,
    actor: SystemAuditActor,
    trigger: RunTrigger = RunTrigger.Manual,
  ): Promise<RunDetailResponseDto> {
    const analyzer = ANALYZERS[dto.analysisType];
    const scheduled = trigger === RunTrigger.Scheduled;
    if (dto.engagementId && !scheduled) await this._assertEngagementAccess(dto.engagementId, actor);

    const extract = await this.liveSources.fetch(dto.analysisType, dto.source, { days: dto.days, actor });
    const parameters = this._parseParameters(analyzer, dto.parameters ?? {}, extract.parameterDefaults);
    const context: AnalyzerContext = { now: new Date(), mappedFields: extract.mappedFields };
    await this._enrichContext(dto.analysisType, parameters, context);
    const result = this._analyse(analyzer, extract.records, parameters, context);
    const usesWindow = dto.analysisType === AnalysisType.SecurityEventLog || dto.analysisType === AnalysisType.IncidentLog;
    if (usesWindow) result.summary.lookbackDays = dto.days;

    const runId = randomUUID();
    await this._persistRun({
      id: runId,
      analyzer,
      title: dto.title ?? `${analyzer.label} — ${extract.systemName}${scheduled ? ' (continuous monitoring)' : ''}`,
      source: dto.source,
      systemName: extract.systemName,
      trigger,
      engagementId: dto.engagementId ?? null,
      securityTestId: null,
      evidenceId: null,
      documentId: null,
      fileName: null,
      contentSha256: null,
      recordCount: extract.records.length,
      parameters: { ...(parameters as Record<string, unknown>), ...(usesWindow && { lookbackDays: dto.days }) },
      baselineRunId: null,
      createdById: scheduled ? null : actor.id,
      result,
    });

    return this.getRun(runId, actor);
  }

  async listRuns(query: RunListQueryDto, actor: SystemAuditActor): Promise<{ runs: RunResponseDto[]; meta: PaginationMeta }> {
    const { skip, take, page, pageSize } = parsePagination(query);
    const where: Prisma.System_Audit_RunWhereInput = {
      AND: [
        this._visibility(actor),
        {
          ...(query.analysisType && { analysis_type: query.analysisType }),
          ...(query.source && { source: query.source }),
          ...(query.trigger && { trigger: query.trigger }),
          ...(query.reviewStatus && { review_status: query.reviewStatus }),
          ...(query.engagementId && { engagement_id: query.engagementId }),
          ...(query.securityTestId && { security_test_id: query.securityTestId }),
          ...(query.search && {
            OR: [
              { title: { contains: query.search } },
              { system_name: { contains: query.search } },
              { reference: { contains: query.search } },
            ],
          }),
        },
      ],
    };

    const [total, runs] = await prisma.$transaction([
      prisma.system_Audit_Run.count({ where }),
      prisma.system_Audit_Run.findMany({
        where,
        include: systemAuditRunInclude,
        orderBy: { created_at: 'desc' },
        skip,
        take,
      }),
    ]);
    const counts = await this._exceptionCounts(runs.map((r) => r.id));
    return {
      runs: runs.map((r) => this._toResponse(r, counts.get(r.id))),
      meta: buildPaginationMeta(total, page, pageSize),
    };
  }

  async getRun(id: string, actor: SystemAuditActor): Promise<RunDetailResponseDto> {
    const run = await prisma.system_Audit_Run.findFirst({
      where: { AND: [{ id }, this._visibility(actor)] },
      include: systemAuditRunInclude,
    });
    if (!run) throw AppError.notFound('Analysis run');

    const [counts, rules, decisions] = await Promise.all([
      this._exceptionCounts([id]),
      prisma.system_Audit_Exception.groupBy({
        by: ['rule_code'],
        where: { run_id: id },
        _count: { _all: true },
      }),
      run.analysis_type === AnalysisType.AccessListing
        ? prisma.access_Review_Item.groupBy({ by: ['decision'], where: { run_id: id }, _count: { _all: true } })
        : Promise.resolve(null),
    ]);

    const accessReview = decisions
      ? (() => {
          const byDecision = Object.fromEntries(decisions.map((d) => [d.decision, d._count._all])) as Record<string, number>;
          return {
            total: decisions.reduce((n, d) => n + d._count._all, 0),
            pending: byDecision[AccessDecision.Pending] ?? 0,
            appropriate: byDecision[AccessDecision.Appropriate] ?? 0,
            revoke: byDecision[AccessDecision.Revoke] ?? 0,
            modify: byDecision[AccessDecision.Modify] ?? 0,
          };
        })()
      : null;

    const runCounts = counts.get(id);
    return {
      ...this._toResponse(run, runCounts),
      parameters: parseJson<Record<string, unknown>>(run.parameters, {}),
      controls: ANALYZERS[run.analysis_type as AnalysisType]?.controls ?? [],
      dispositionCounts: runCounts?.disposition ?? emptyDispositionCounts(),
      ruleCounts: rules
        .map((r) => ({ ruleCode: r.rule_code, label: ruleLabel(run.analysis_type, r.rule_code), count: r._count._all }))
        .sort((a, b) => b.count - a.count),
      accessReview,
      hasExtract: Boolean(run.document_id || run.evidence_id),
    };
  }

  async listExceptions(
    runId: string,
    query: ExceptionListQueryDto,
    actor: SystemAuditActor,
  ): Promise<{ exceptions: ExceptionResponseDto[]; meta: PaginationMeta }> {
    const run = await this.assertRunVisible(runId, actor);
    const { skip, take, page, pageSize } = parsePagination(query);
    const all = await this._sortedExceptions(runId, {
      ...(query.severity && { severity: query.severity }),
      ...(query.disposition && { disposition: query.disposition }),
      ...(query.ruleCode && { rule_code: query.ruleCode }),
      ...(query.search && {
        OR: [{ title: { contains: query.search } }, { record_ref: { contains: query.search } }],
      }),
    });
    return {
      exceptions: all.slice(skip, skip + take).map((e) => mapExceptionToResponse(e, ruleLabel(run.analysisType, e.rule_code))),
      meta: buildPaginationMeta(all.length, page, pageSize),
    };
  }

  async exportExceptions(runId: string, format: ExportFormat, actor: SystemAuditActor): Promise<TabularExportFile> {
    const visible = await this.assertRunVisible(runId, actor);
    const run = await prisma.system_Audit_Run.findUniqueOrThrow({ where: { id: runId }, select: { reference: true } });
    const exceptions = (await this._sortedExceptions(runId, {})).map((e) =>
      mapExceptionToResponse(e, ruleLabel(visible.analysisType, e.rule_code)),
    );

    logger.info('System audit exceptions exported', { runId, actorId: actor.id, format, count: exceptions.length });
    auditLogService.logAsync({
      userId: actor.id,
      action: 'system_audit.exceptions.export',
      module: 'system-audit',
      entityType: 'system_audit_run',
      entityId: runId,
      newValues: { format, count: exceptions.length },
    });

    return buildTabularExport(
      exceptions,
      [
        { header: 'Run', value: () => run.reference },
        { header: 'Rule', value: (e) => e.ruleCode },
        { header: 'Rule description', value: (e) => e.ruleLabel },
        { header: 'Severity', value: (e) => e.severity },
        { header: 'Exception', value: (e) => e.title },
        { header: 'Record', value: (e) => e.recordRef },
        { header: 'Disposition', value: (e) => e.disposition },
        { header: 'Disposition note', value: (e) => e.dispositionNote },
        { header: 'Dispositioned by', value: (e) => e.disposedBy?.name },
        { header: 'Dispositioned on', value: (e) => e.disposedAt },
        { header: 'Finding', value: (e) => e.finding?.title },
        { header: 'Details', value: (e) => JSON.stringify(e.details) },
      ],
      { baseName: `${run.reference}-exceptions`, format, sheetName: 'Exceptions' },
    );
  }

  async getExtractFile(runId: string, actor: SystemAuditActor): Promise<ServedExtract> {
    await this.assertRunVisible(runId, actor);
    const run = await prisma.system_Audit_Run.findUniqueOrThrow({
      where: { id: runId },
      select: { document_id: true, evidence: { select: { document_id: true } } },
    });
    const documentId = run.document_id ?? run.evidence?.document_id;
    if (!documentId) throw AppError.notFound('Extract file (live-source runs have no uploaded file)');
    if (run.evidence) {
      await this.documentService.assertCanUserAccess(documentId, {
        id: actor.id,
        permissions: actor.permissions,
        isSuperAdmin: Boolean(actor.isSuperAdmin),
      });
    }
    const file = await this.documentService.getFileById(documentId);
    return { buffer: file.buffer, mimeType: file.mimeType, originalName: file.originalName };
  }

  async dispositionExceptions(dto: DispositionExceptionsDto, actor: SystemAuditActor): Promise<{ updated: number }> {
    const ids = Array.from(new Set(dto.exceptionIds));
    const rows = await prisma.system_Audit_Exception.findMany({
      where: { id: { in: ids } },
      select: { id: true, run_id: true, finding_id: true, run: { select: { review_status: true } } },
    });
    if (rows.length !== ids.length) throw AppError.notFound('Exception');
    for (const runId of new Set(rows.map((r) => r.run_id))) await this.assertRunVisible(runId, actor);
    if (rows.some((r) => r.run.review_status === RunReviewStatus.Completed)) {
      throw AppError.badRequest('The review of this analysis is complete — its exceptions can no longer change');
    }
    if (dto.disposition !== ExceptionDisposition.Confirmed && rows.some((r) => r.finding_id)) {
      throw AppError.badRequest('Exceptions already raised as findings stay confirmed');
    }

    const reopening = dto.disposition === ExceptionDisposition.Open;
    const result = await prisma.system_Audit_Exception.updateMany({
      where: { id: { in: ids } },
      data: {
        disposition: dto.disposition,
        disposition_note: reopening ? null : dto.note ?? null,
        disposed_by_id: reopening ? null : actor.id,
        disposed_at: reopening ? null : new Date(),
      },
    });

    logger.info('System audit exceptions dispositioned', { actorId: actor.id, disposition: dto.disposition, count: result.count });
    auditLogService.logAsync({
      userId: actor.id,
      action: 'system_audit.exceptions.disposition',
      module: 'system-audit',
      entityType: 'system_audit_exception',
      newValues: { exceptionIds: ids, disposition: dto.disposition, note: dto.note },
    });
    return { updated: result.count };
  }

  async raiseFinding(
    runId: string,
    dto: RaiseFindingDto,
    actor: SystemAuditActor,
  ): Promise<{ findingId: string; linkedExceptions: number }> {
    await this.assertRunVisible(runId, actor);
    const run = await prisma.system_Audit_Run.findUniqueOrThrow({ where: { id: runId } });
    if (run.review_status === RunReviewStatus.Completed) {
      throw AppError.badRequest('The review of this analysis is complete — raise findings before completing it');
    }
    const engagementId = dto.engagementId ?? run.engagement_id;
    if (!engagementId) throw AppError.badRequest('Choose the engagement this finding belongs to');
    await this._assertEngagementAccess(engagementId, actor);

    const ids = Array.from(new Set(dto.exceptionIds));
    const exceptions = await prisma.system_Audit_Exception.findMany({
      where: { id: { in: ids }, run_id: runId },
      orderBy: { created_at: 'asc' },
    });
    if (exceptions.length !== ids.length) throw AppError.badRequest('Every exception must belong to this analysis run');
    if (exceptions.some((e) => e.finding_id)) throw AppError.conflict('Some of these exceptions are already linked to a finding');

    const source = [
      `Source: system audit analysis ${run.reference} — ${analyzerLabel(run.analysis_type)} of ${run.system_name}`,
      run.file_name ? `, extract "${run.file_name}" (SHA-256 ${run.content_sha256})` : ` (live ${run.source} data)`,
      `, run on ${run.created_at.toISOString().slice(0, 10)}.`,
    ].join('');
    const listed = exceptions
      .sort((a, b) => SEVERITY_RANK[b.severity as ExceptionSeverity] - SEVERITY_RANK[a.severity as ExceptionSeverity])
      .slice(0, FINDING_EXCEPTION_LIST)
      .map((e) => `- [${e.severity}] ${e.title}`);
    const more = exceptions.length > FINDING_EXCEPTION_LIST ? [`- …and ${exceptions.length - FINDING_EXCEPTION_LIST} more`] : [];
    const description = [
      dto.description ?? `The analysis identified ${exceptions.length} exception(s):`,
      '',
      ...(dto.description ? [`Exceptions (${exceptions.length}):`] : []),
      ...listed,
      ...more,
      '',
      source,
    ].join('\n');

    const finding = await this.findingService.createFinding(
      engagementId,
      {
        title: dto.title,
        description,
        category: dto.category,
        severity: dto.severity,
        rootCause: dto.rootCause,
        riskImplication: dto.riskImplication,
        recommendation: dto.recommendation,
        auditeeId: dto.auditeeId,
        dueDate: dto.dueDate,
      },
      { id: actor.id, roles: actor.roles, permissions: actor.permissions },
    );

    const linked = await prisma.system_Audit_Exception.updateMany({
      where: { id: { in: ids } },
      data: {
        finding_id: finding.id,
        disposition: ExceptionDisposition.Confirmed,
        disposed_by_id: actor.id,
        disposed_at: new Date(),
      },
    });

    logger.info('Finding raised from system audit exceptions', { runId, findingId: finding.id, actorId: actor.id, count: linked.count });
    auditLogService.logAsync({
      userId: actor.id,
      action: 'system_audit.finding.raise',
      module: 'system-audit',
      entityType: 'system_audit_run',
      entityId: runId,
      newValues: { findingId: finding.id, engagementId, exceptionIds: ids },
    });
    return { findingId: finding.id, linkedExceptions: linked.count };
  }

  async markBaseline(runId: string, actor: SystemAuditActor): Promise<RunDetailResponseDto> {
    await this.assertRunVisible(runId, actor);
    const run = await prisma.system_Audit_Run.findUniqueOrThrow({
      where: { id: runId },
      select: { analysis_type: true, system_name: true, snapshot: true },
    });
    if (run.analysis_type !== AnalysisType.Configuration || !run.snapshot) {
      throw AppError.badRequest('Only configuration reviews can be marked as the approved baseline');
    }

    await prisma.$transaction([
      prisma.system_Audit_Run.updateMany({
        where: { analysis_type: AnalysisType.Configuration, system_name: run.system_name, is_baseline: true },
        data: { is_baseline: false },
      }),
      prisma.system_Audit_Run.update({ where: { id: runId }, data: { is_baseline: true } }),
    ]);

    logger.info('Configuration baseline approved', { runId, systemName: run.system_name, actorId: actor.id });
    auditLogService.logAsync({
      userId: actor.id,
      action: 'system_audit.baseline.approve',
      module: 'system-audit',
      entityType: 'system_audit_run',
      entityId: runId,
      newValues: { systemName: run.system_name },
    });
    return this.getRun(runId, actor);
  }

  async completeReview(runId: string, dto: CompleteReviewDto, actor: SystemAuditActor): Promise<RunDetailResponseDto> {
    const visible = await this.assertRunVisible(runId, actor);
    if (visible.reviewStatus === RunReviewStatus.Completed) throw AppError.conflict('This review is already complete');

    const [openExceptions, pendingItems] = await Promise.all([
      prisma.system_Audit_Exception.count({ where: { run_id: runId, disposition: ExceptionDisposition.Open } }),
      visible.analysisType === AnalysisType.AccessListing
        ? prisma.access_Review_Item.count({ where: { run_id: runId, decision: AccessDecision.Pending } })
        : Promise.resolve(0),
    ]);
    if (openExceptions > 0) throw AppError.badRequest(`${openExceptions} exception(s) still need a disposition`);
    if (pendingItems > 0) throw AppError.badRequest(`${pendingItems} account(s) still need an access decision`);

    await prisma.system_Audit_Run.update({
      where: { id: runId },
      data: {
        review_status: RunReviewStatus.Completed,
        review_note: dto.note ?? null,
        reviewed_by_id: actor.id,
        reviewed_at: new Date(),
      },
    });

    logger.info('System audit review completed', { runId, actorId: actor.id });
    auditLogService.logAsync({
      userId: actor.id,
      action: 'system_audit.review.complete',
      module: 'system-audit',
      entityType: 'system_audit_run',
      entityId: runId,
      newValues: { note: dto.note },
    });
    return this.getRun(runId, actor);
  }

  async assertRunVisible(
    runId: string,
    actor: SystemAuditActor,
  ): Promise<{ id: string; analysisType: string; reviewStatus: string }> {
    const run = await prisma.system_Audit_Run.findFirst({
      where: { AND: [{ id: runId }, this._visibility(actor)] },
      select: { id: true, analysis_type: true, review_status: true },
    });
    if (!run) throw AppError.notFound('Analysis run');
    return { id: run.id, analysisType: run.analysis_type, reviewStatus: run.review_status };
  }

  // ── internals ───────────────────────────────────────────────

  /**
   * Runs on an engagement are visible to its team and to oversight; runs with
   * no engagement (organisation-wide reviews, continuous monitoring) are
   * visible to every holder of sysaudit:read.
   */
  private _visibility(actor: SystemAuditActor): Prisma.System_Audit_RunWhereInput {
    if (actor.isSuperAdmin || actor.permissions.includes('engagement:read_all')) return {};
    return {
      OR: [
        { engagement_id: null },
        { created_by_id: actor.id },
        {
          engagement: {
            OR: [
              { lead_auditor_id: actor.id },
              { audit_manager_id: actor.id },
              { workflow_assignments: { some: { user_id: actor.id } } },
            ],
          },
        },
      ],
    };
  }

  private async _assertEngagementAccess(engagementId: string, actor: SystemAuditActor): Promise<void> {
    await this.engagementService.getEngagementById(engagementId, {
      id: actor.id,
      roles: actor.roles,
      permissions: actor.permissions,
    });
  }

  private async _assertSecurityTest(id: string): Promise<void> {
    const test = await prisma.security_Test.findFirst({ where: { id, deleted_at: null }, select: { id: true } });
    if (!test) throw AppError.notFound('Security test');
  }

  private _resolveMapping(
    headers: string[],
    analyzer: AnalyzerDefinition<unknown>,
    requested: Record<string, string | null> | undefined,
  ): ColumnMapping {
    const known = new Set(analyzer.fields.map((f) => f.key));
    const mapping: ColumnMapping = { ...suggestMapping(headers, analyzer.fields) };
    for (const [key, header] of Object.entries(requested ?? {})) {
      if (!known.has(key)) continue;
      if (header && !headers.includes(header)) {
        throw AppError.badRequest(`Column "${header}" (mapped to ${key}) is not in the file`, { headers });
      }
      mapping[key] = header;
    }
    const missing = missingRequiredFields(analyzer.fields, mapping);
    if (missing.length > 0) {
      throw AppError.badRequest(
        `Map a column for: ${missing.map((f) => f.label).join(', ')}`,
        { missing: missing.map((f) => f.key), headers },
      );
    }
    return mapping;
  }

  private _parseParameters(
    analyzer: AnalyzerDefinition<unknown>,
    input: Record<string, unknown>,
    defaults: Record<string, unknown>,
  ): unknown {
    try {
      return analyzer.parametersSchema.parse({ ...defaults, ...input });
    } catch (err) {
      if (err instanceof ZodError) {
        throw AppError.validationError(err.errors.map((e) => ({ field: `parameters.${e.path.join('.')}`, message: e.message })));
      }
      throw err;
    }
  }

  private async _enrichContext(type: AnalysisType, parameters: unknown, context: AnalyzerContext): Promise<void> {
    if (type !== AnalysisType.AccessListing) return;
    if (!(parameters as { checkDirectory?: boolean }).checkDirectory) return;
    context.directory = await this._directory();
  }

  private async _directory(): Promise<DirectoryEntry[]> {
    const users = await this.userService.listAccessEntitlements();
    return users.map((u) => ({ email: u.email, displayName: u.displayName, isActive: u.isActive }));
  }

  private async _findBaseline(
    systemName: string,
    baselineRunId: string | undefined,
  ): Promise<{ id: string; snapshot: ConfigurationSnapshot } | null> {
    const run = await prisma.system_Audit_Run.findFirst({
      where: baselineRunId
        ? { id: baselineRunId, analysis_type: AnalysisType.Configuration }
        : { analysis_type: AnalysisType.Configuration, system_name: systemName, is_baseline: true },
      orderBy: { created_at: 'desc' },
      select: { id: true, snapshot: true },
    });
    if (!run?.snapshot) {
      if (baselineRunId) throw AppError.notFound('Baseline configuration run');
      return null;
    }
    return { id: run.id, snapshot: parseJson<ConfigurationSnapshot>(run.snapshot, {}) };
  }

  private _analyse(
    analyzer: AnalyzerDefinition<unknown>,
    records: AnalysisRecord[],
    parameters: unknown,
    context: AnalyzerContext,
  ): AnalysisResult {
    if (records.length === 0) throw AppError.badRequest('There are no records to analyse');
    try {
      return analyzer.analyse(records, parameters, context);
    } catch (err) {
      if (err instanceof AppError) throw err;
      // Analyzers are pure and report bad configuration (e.g. unknown columns) as plain errors.
      throw AppError.badRequest(err instanceof Error ? err.message : 'Analysis failed');
    }
  }

  private async _storeExtract(
    runId: string,
    engagementId: string | null,
    file: ExtractFile,
    actor: SystemAuditActor,
  ): Promise<{ evidenceId: string | null; documentId: string | null }> {
    if (engagementId) {
      const evidence = await this.evidenceService.uploadEvidence(
        engagementId,
        { originalName: file.originalName, mimeType: file.mimeType, fileSize: file.fileSize, buffer: file.buffer },
        { id: actor.id, roles: actor.roles, permissions: actor.permissions },
      );
      return { evidenceId: evidence.id, documentId: null };
    }
    const document = await this.documentService.upload({
      uploadedById: actor.id,
      originalName: file.originalName,
      mimeType: file.mimeType,
      fileSize: file.fileSize,
      buffer: file.buffer,
      module: 'system-audit',
      entityType: 'system_audit_run',
      entityId: runId,
    });
    return { evidenceId: null, documentId: document.id };
  }

  private async _persistRun(input: PersistRunInput): Promise<void> {
    const { result } = input;
    const sorted = [...result.exceptions].sort(
      (a, b) => SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity],
    );
    const exceptions = sorted.slice(0, MAX_STORED_EXCEPTIONS);
    const accessItems = (result.accessItems ?? []).slice(0, MAX_ACCESS_ITEMS);
    const summary: Record<string, unknown> = { ...result.summary };
    if (sorted.length > exceptions.length) {
      summary.exceptionsFound = sorted.length;
      summary.exceptionsStored = exceptions.length;
    }
    if ((result.accessItems?.length ?? 0) > accessItems.length) summary.accountsStored = accessItems.length;

    for (let attempt = 1; ; attempt += 1) {
      try {
        await prisma.$transaction(
          async (tx) => {
            const latest = await tx.system_Audit_Run.findFirst({
              where: { reference: { startsWith: `${RUN_PREFIX}-${new Date().getFullYear()}-` } },
              orderBy: { reference: 'desc' },
              select: { reference: true },
            });
            await tx.system_Audit_Run.create({
              data: {
                id: input.id,
                reference: nextReference(RUN_PREFIX, latest?.reference),
                title: input.title,
                analysis_type: input.analyzer.type,
                source: input.source,
                system_name: input.systemName,
                trigger: input.trigger,
                engagement_id: input.engagementId,
                security_test_id: input.securityTestId,
                evidence_id: input.evidenceId,
                document_id: input.documentId,
                file_name: input.fileName,
                content_sha256: input.contentSha256,
                record_count: input.recordCount,
                exception_count: sorted.length,
                parameters: JSON.stringify(input.parameters),
                summary: JSON.stringify(summary),
                snapshot: result.snapshot ? JSON.stringify(result.snapshot) : null,
                baseline_run_id: input.baselineRunId,
                created_by_id: input.createdById,
              },
            });
            for (let i = 0; i < exceptions.length; i += EXCEPTION_CHUNK) {
              await tx.system_Audit_Exception.createMany({
                data: exceptions.slice(i, i + EXCEPTION_CHUNK).map((e) => ({
                  run_id: input.id,
                  rule_code: e.ruleCode,
                  severity: e.severity,
                  title: e.title.slice(0, 500),
                  record_ref: e.recordRef?.slice(0, 500) ?? null,
                  details: e.details ? JSON.stringify(e.details) : null,
                })),
              });
            }
            for (let i = 0; i < accessItems.length; i += ACCESS_ITEM_CHUNK) {
              await tx.access_Review_Item.createMany({
                data: accessItems.slice(i, i + ACCESS_ITEM_CHUNK).map((item) => ({
                  run_id: input.id,
                  account_id: item.accountId.slice(0, 300),
                  display_name: item.displayName,
                  email: item.email,
                  department: item.department,
                  account_status: item.accountStatus,
                  is_privileged: item.isPrivileged,
                  last_login_at: item.lastLoginAt,
                  entitlements: JSON.stringify(item.entitlements),
                  flags: item.flags.length ? JSON.stringify(item.flags) : null,
                })),
              });
            }
          },
          { timeout: 120_000, maxWait: 10_000 },
        );
        break;
      } catch (err) {
        // Two runs created in the same instant can race for the next reference.
        if (attempt < 3 && isUniqueViolation(err)) continue;
        throw err;
      }
    }

    logger.info('System audit analysis completed', {
      runId: input.id,
      analysisType: input.analyzer.type,
      source: input.source,
      records: input.recordCount,
      exceptions: sorted.length,
      actorId: input.createdById,
    });
    auditLogService.logAsync({
      userId: input.createdById ?? undefined,
      action: 'system_audit.analysis.run',
      module: 'system-audit',
      entityType: 'system_audit_run',
      entityId: input.id,
      newValues: {
        analysisType: input.analyzer.type,
        source: input.source,
        systemName: input.systemName,
        trigger: input.trigger,
        engagementId: input.engagementId,
        records: input.recordCount,
        exceptions: sorted.length,
        contentSha256: input.contentSha256,
      },
    });
  }

  private async _sortedExceptions(runId: string, where: Prisma.System_Audit_ExceptionWhereInput) {
    const rows = await prisma.system_Audit_Exception.findMany({
      where: { ...where, run_id: runId },
      include: systemAuditExceptionInclude,
      orderBy: { created_at: 'asc' },
    });
    // Severity is text; rank it here (a run holds at most MAX_STORED_EXCEPTIONS rows).
    return rows.sort(
      (a, b) =>
        SEVERITY_RANK[b.severity as ExceptionSeverity] - SEVERITY_RANK[a.severity as ExceptionSeverity] ||
        a.created_at.getTime() - b.created_at.getTime(),
    );
  }

  private async _exceptionCounts(runIds: string[]): Promise<Map<string, RunCounts>> {
    const map = new Map<string, RunCounts>();
    if (runIds.length === 0) return map;
    const grouped = await prisma.system_Audit_Exception.groupBy({
      by: ['run_id', 'severity', 'disposition'],
      where: { run_id: { in: runIds } },
      _count: { _all: true },
    });
    for (const row of grouped) {
      const counts = map.get(row.run_id) ?? { severity: emptySeverityCounts(), disposition: emptyDispositionCounts(), open: 0 };
      const n = row._count._all;
      if (row.severity in counts.severity) counts.severity[row.severity as keyof SeverityCounts] += n;
      if (row.disposition in counts.disposition) counts.disposition[row.disposition as keyof DispositionCounts] += n;
      if (row.disposition === ExceptionDisposition.Open) counts.open += n;
      map.set(row.run_id, counts);
    }
    return map;
  }

  private _toResponse(run: SystemAuditRunWithRelations, counts: RunCounts | undefined): RunResponseDto {
    return mapRunToResponse(run, analyzerLabel(run.analysis_type), {
      severity: counts?.severity ?? emptySeverityCounts(),
      open: counts?.open ?? 0,
    });
  }
}
