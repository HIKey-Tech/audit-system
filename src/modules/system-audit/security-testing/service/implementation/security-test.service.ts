import { Prisma } from '@prisma/client';
import { prisma } from '../../../../../shared/prisma/prisma.client';
import { AppError } from '../../../../../shared/errors/app.error';
import { logger } from '../../../../../shared/utils/logger.util';
import {
  PaginationMeta,
  buildPaginationMeta,
  parsePagination,
} from '../../../../../shared/types/api-response.type';
import { SecurityTestWithRelations, securityTestInclude } from '../../../../../shared/prisma/prisma.types';
import { auditLogService } from '../../../../logging/service/implementation/audit-log.service';
import { IUserService } from '../../../../user/service/interface/user.service.interface';
import { IDocumentService } from '../../../../document/service/interface/document.service.interface';
import { IEngagementService } from '../../../../audit/engagement/service/interface/engagement.service.interface';
import { IAssetService } from '../../../../asset/service/interface/asset.service.interface';
import { SystemAuditActor } from '../../../domain/entity/system-audit.entity';
import { ExceptionDisposition, SecurityTestStatus } from '../../../domain/enum/system-audit.enum';
import { ExtractFile, ServedExtract } from '../../../analytics/service/interface/analytics.service.interface';
import { nextReference, parseJson } from '../../../utility/system-audit.utility';
import {
  AuthoriseSecurityTestDto,
  ChangeSecurityTestStatusDto,
  CreateSecurityTestDto,
  SecurityTestAssetsDto,
  SecurityTestListQueryDto,
  UpdateSecurityTestDto,
} from '../../dto/request/security-test.request.dto';
import {
  SecurityTestDetailResponseDto,
  SecurityTestResponseDto,
  SecurityTestResultsDto,
  mapSecurityTestToResponse,
} from '../../dto/response/security-test.response.dto';
import { ISecurityTestService } from '../interface/security-test.service.interface';

const TEST_PREFIX = 'SEC';

/** Authorisation (planned → authorised) is a separate, segregated action. */
const TRANSITIONS: Record<SecurityTestStatus, SecurityTestStatus[]> = {
  [SecurityTestStatus.Planned]: [SecurityTestStatus.Cancelled],
  [SecurityTestStatus.Authorised]: [SecurityTestStatus.InProgress, SecurityTestStatus.Cancelled],
  [SecurityTestStatus.InProgress]: [SecurityTestStatus.Reporting, SecurityTestStatus.Cancelled],
  [SecurityTestStatus.Reporting]: [SecurityTestStatus.Remediation, SecurityTestStatus.Closed],
  [SecurityTestStatus.Remediation]: [SecurityTestStatus.Closed],
  [SecurityTestStatus.Closed]: [],
  [SecurityTestStatus.Cancelled]: [],
};

const FINAL = [SecurityTestStatus.Closed, SecurityTestStatus.Cancelled];
// Changing any of these after authorisation means the tester is no longer covered by it.
const AUTHORISED_TERMS = ['testType', 'scope', 'rulesOfEngagement', 'plannedStart', 'plannedEnd', 'provider'] as const;

const isUniqueViolation = (err: unknown): boolean =>
  err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002';

export class SecurityTestService implements ISecurityTestService {
  constructor(
    private readonly userService: IUserService,
    private readonly documentService: IDocumentService,
    private readonly engagementService: IEngagementService,
    private readonly assetService: IAssetService,
  ) {}

  async createTest(dto: CreateSecurityTestDto, actor: SystemAuditActor): Promise<SecurityTestDetailResponseDto> {
    const coordinatorId = dto.coordinatorId ?? actor.id;
    await this.userService.getUserById(coordinatorId);
    if (dto.engagementId) await this._assertEngagementAccess(dto.engagementId, actor);
    const assetIds = Array.from(new Set(dto.assetIds ?? []));
    await this._assertAssets(assetIds, actor);

    let id = '';
    for (let attempt = 1; ; attempt += 1) {
      try {
        id = await prisma.$transaction(async (tx) => {
          const latest = await tx.security_Test.findFirst({
            where: { reference: { startsWith: `${TEST_PREFIX}-${new Date().getFullYear()}-` } },
            orderBy: { reference: 'desc' },
            select: { reference: true },
          });
          const created = await tx.security_Test.create({
            data: {
              reference: nextReference(TEST_PREFIX, latest?.reference),
              title: dto.title,
              test_type: dto.testType,
              engagement_id: dto.engagementId ?? null,
              provider: dto.provider,
              provider_type: dto.providerType,
              scope: dto.scope,
              rules_of_engagement: dto.rulesOfEngagement ?? null,
              planned_start: new Date(dto.plannedStart),
              planned_end: new Date(dto.plannedEnd),
              coordinator_id: coordinatorId,
              notes: dto.notes ?? null,
              created_by_id: actor.id,
            },
            select: { id: true },
          });
          if (assetIds.length > 0) {
            await tx.security_Test_Asset.createMany({
              data: assetIds.map((assetId) => ({ test_id: created.id, asset_id: assetId, created_by_id: actor.id })),
            });
          }
          return created.id;
        });
        break;
      } catch (err) {
        if (attempt < 3 && isUniqueViolation(err)) continue;
        throw err;
      }
    }

    logger.info('Security test planned', { testId: id, actorId: actor.id, testType: dto.testType });
    auditLogService.logAsync({
      userId: actor.id,
      action: 'system_audit.security_test.create',
      module: 'system-audit',
      entityType: 'security_test',
      entityId: id,
      newValues: { ...dto, coordinatorId },
    });
    return this.getTest(id, actor);
  }

  async updateTest(id: string, dto: UpdateSecurityTestDto, actor: SystemAuditActor): Promise<SecurityTestDetailResponseDto> {
    const existing = await this._getVisible(id, actor);
    const status = existing.status as SecurityTestStatus;
    if (FINAL.includes(status)) throw AppError.badRequest(`A ${status} security test can no longer be edited`);

    const changesTerms = AUTHORISED_TERMS.some((key) => dto[key] !== undefined);
    const started = [SecurityTestStatus.InProgress, SecurityTestStatus.Reporting, SecurityTestStatus.Remediation].includes(status);
    if (changesTerms && started) {
      throw AppError.badRequest('Scope, schedule, provider, and rules of engagement are fixed once testing has started');
    }
    if (dto.coordinatorId) await this.userService.getUserById(dto.coordinatorId);
    if (dto.engagementId) await this._assertEngagementAccess(dto.engagementId, actor);
    const plannedStart = dto.plannedStart ? new Date(dto.plannedStart) : existing.planned_start;
    const plannedEnd = dto.plannedEnd ? new Date(dto.plannedEnd) : existing.planned_end;
    if (plannedEnd < plannedStart) throw AppError.badRequest('The planned end must be on or after the planned start');
    const voidsAuthorisation = changesTerms && status === SecurityTestStatus.Authorised;

    await prisma.security_Test.update({
      where: { id },
      data: {
        ...(dto.title !== undefined && { title: dto.title }),
        ...(dto.testType !== undefined && { test_type: dto.testType }),
        ...(dto.engagementId !== undefined && { engagement_id: dto.engagementId }),
        ...(dto.provider !== undefined && { provider: dto.provider }),
        ...(dto.providerType !== undefined && { provider_type: dto.providerType }),
        ...(dto.scope !== undefined && { scope: dto.scope }),
        ...(dto.rulesOfEngagement !== undefined && { rules_of_engagement: dto.rulesOfEngagement }),
        ...(dto.plannedStart !== undefined && { planned_start: plannedStart }),
        ...(dto.plannedEnd !== undefined && { planned_end: plannedEnd }),
        ...(dto.coordinatorId !== undefined && { coordinator_id: dto.coordinatorId }),
        ...(dto.notes !== undefined && { notes: dto.notes }),
        ...(voidsAuthorisation && { status: SecurityTestStatus.Planned, authorised_by_id: null, authorised_at: null }),
      },
    });

    logger.info('Security test updated', { testId: id, actorId: actor.id, voidsAuthorisation });
    auditLogService.logAsync({
      userId: actor.id,
      action: 'system_audit.security_test.update',
      module: 'system-audit',
      entityType: 'security_test',
      entityId: id,
      newValues: { ...dto, authorisationVoided: voidsAuthorisation },
    });
    return this.getTest(id, actor);
  }

  async deleteTest(id: string, actor: SystemAuditActor): Promise<void> {
    const existing = await this._getVisible(id, actor);
    if (![SecurityTestStatus.Planned, SecurityTestStatus.Cancelled].includes(existing.status as SecurityTestStatus)) {
      throw AppError.badRequest('Only planned or cancelled security tests can be deleted — cancel it instead');
    }
    await prisma.security_Test.update({ where: { id }, data: { deleted_at: new Date() } });
    logger.info('Security test deleted', { testId: id, actorId: actor.id });
    auditLogService.logAsync({
      userId: actor.id,
      action: 'system_audit.security_test.delete',
      module: 'system-audit',
      entityType: 'security_test',
      entityId: id,
    });
  }

  async getTest(id: string, actor: SystemAuditActor): Promise<SecurityTestDetailResponseDto> {
    const test = await this._getVisible(id, actor);
    const [results, runs] = await Promise.all([
      this._results([id]),
      prisma.system_Audit_Run.findMany({
        where: { security_test_id: id },
        orderBy: { created_at: 'desc' },
        select: { id: true, reference: true, title: true, created_at: true, exception_count: true, summary: true },
      }),
    ]);
    return {
      ...mapSecurityTestToResponse(test, TRANSITIONS[test.status as SecurityTestStatus] ?? [], results.get(id)!),
      scanRuns: runs.map((r) => ({
        id: r.id,
        reference: r.reference,
        title: r.title,
        createdAt: r.created_at.toISOString(),
        exceptionCount: r.exception_count,
        summary: parseJson<Record<string, unknown>>(r.summary, {}),
      })),
    };
  }

  async listTests(
    query: SecurityTestListQueryDto,
    actor: SystemAuditActor,
  ): Promise<{ tests: SecurityTestResponseDto[]; meta: PaginationMeta }> {
    const { skip, take, page, pageSize } = parsePagination(query);
    const where: Prisma.Security_TestWhereInput = {
      AND: [
        { deleted_at: null },
        this._visibility(actor),
        {
          ...(query.status && { status: query.status }),
          ...(query.testType && { test_type: query.testType }),
          ...(query.engagementId && { engagement_id: query.engagementId }),
          ...(query.search && {
            OR: [
              { title: { contains: query.search } },
              { reference: { contains: query.search } },
              { provider: { contains: query.search } },
              { scope: { contains: query.search } },
            ],
          }),
        },
      ],
    };
    const [total, tests] = await prisma.$transaction([
      prisma.security_Test.count({ where }),
      prisma.security_Test.findMany({ where, include: securityTestInclude, orderBy: { planned_start: 'desc' }, skip, take }),
    ]);
    const results = await this._results(tests.map((t) => t.id));
    return {
      tests: tests.map((t) => mapSecurityTestToResponse(t, TRANSITIONS[t.status as SecurityTestStatus] ?? [], results.get(t.id)!)),
      meta: buildPaginationMeta(total, page, pageSize),
    };
  }

  async authoriseTest(id: string, dto: AuthoriseSecurityTestDto, actor: SystemAuditActor): Promise<SecurityTestDetailResponseDto> {
    const test = await this._getVisible(id, actor);
    if (test.status !== SecurityTestStatus.Planned) throw AppError.badRequest('Only a planned security test can be authorised');
    // Segregation of duties: whoever arranges the test cannot also sign it off.
    if (test.coordinator_id === actor.id || test.created_by_id === actor.id) {
      throw AppError.forbidden('A security test must be authorised by someone other than its coordinator or creator');
    }

    await prisma.security_Test.update({
      where: { id },
      data: { status: SecurityTestStatus.Authorised, authorised_by_id: actor.id, authorised_at: new Date() },
    });
    logger.info('Security test authorised', { testId: id, actorId: actor.id });
    auditLogService.logAsync({
      userId: actor.id,
      action: 'system_audit.security_test.authorise',
      module: 'system-audit',
      entityType: 'security_test',
      entityId: id,
      newValues: { note: dto.note },
    });
    return this.getTest(id, actor);
  }

  async changeStatus(id: string, dto: ChangeSecurityTestStatusDto, actor: SystemAuditActor): Promise<SecurityTestDetailResponseDto> {
    const test = await this._getVisible(id, actor);
    const from = test.status as SecurityTestStatus;
    const to = dto.status as SecurityTestStatus;
    if (!TRANSITIONS[from]?.includes(to)) {
      throw AppError.badRequest(
        from === SecurityTestStatus.Planned && to === SecurityTestStatus.InProgress
          ? 'The test must be authorised before testing starts'
          : `A security test cannot move from ${from} to ${to}`,
      );
    }
    if (from === SecurityTestStatus.Reporting && !test.report_document_id) {
      throw AppError.badRequest('Upload the test report before moving to remediation or closing the test');
    }

    const now = new Date();
    await prisma.security_Test.update({
      where: { id },
      data: {
        status: to,
        ...(to === SecurityTestStatus.InProgress && !test.actual_start && { actual_start: now }),
        ...(to === SecurityTestStatus.Reporting && !test.actual_end && { actual_end: now }),
      },
    });
    logger.info('Security test status changed', { testId: id, actorId: actor.id, from, to });
    auditLogService.logAsync({
      userId: actor.id,
      action: 'system_audit.security_test.status',
      module: 'system-audit',
      entityType: 'security_test',
      entityId: id,
      oldValues: { status: from },
      newValues: { status: to, note: dto.note },
    });
    return this.getTest(id, actor);
  }

  async addAssets(id: string, dto: SecurityTestAssetsDto, actor: SystemAuditActor): Promise<SecurityTestDetailResponseDto> {
    const test = await this._getVisible(id, actor);
    if (FINAL.includes(test.status as SecurityTestStatus)) throw AppError.badRequest('The test is finished — its scope is fixed');
    const existing = new Set(test.assets.map((a) => a.asset.id));
    const toAdd = Array.from(new Set(dto.assetIds)).filter((a) => !existing.has(a));
    await this._assertAssets(toAdd, actor);
    if (toAdd.length > 0) {
      await prisma.security_Test_Asset.createMany({
        data: toAdd.map((assetId) => ({ test_id: id, asset_id: assetId, created_by_id: actor.id })),
      });
    }
    logger.info('Assets added to security test scope', { testId: id, actorId: actor.id, count: toAdd.length });
    auditLogService.logAsync({
      userId: actor.id,
      action: 'system_audit.security_test.assets.add',
      module: 'system-audit',
      entityType: 'security_test',
      entityId: id,
      newValues: { assetIds: toAdd },
    });
    return this.getTest(id, actor);
  }

  async removeAsset(id: string, assetId: string, actor: SystemAuditActor): Promise<SecurityTestDetailResponseDto> {
    const test = await this._getVisible(id, actor);
    if (FINAL.includes(test.status as SecurityTestStatus)) throw AppError.badRequest('The test is finished — its scope is fixed');
    const removed = await prisma.security_Test_Asset.deleteMany({ where: { test_id: id, asset_id: assetId } });
    if (removed.count === 0) throw AppError.notFound('Asset in this test scope');
    logger.info('Asset removed from security test scope', { testId: id, assetId, actorId: actor.id });
    auditLogService.logAsync({
      userId: actor.id,
      action: 'system_audit.security_test.assets.remove',
      module: 'system-audit',
      entityType: 'security_test',
      entityId: id,
      oldValues: { assetId },
    });
    return this.getTest(id, actor);
  }

  async uploadReport(id: string, file: ExtractFile, actor: SystemAuditActor): Promise<SecurityTestDetailResponseDto> {
    const test = await this._getVisible(id, actor);
    if ([SecurityTestStatus.Planned, SecurityTestStatus.Authorised, SecurityTestStatus.Cancelled].includes(test.status as SecurityTestStatus)) {
      throw AppError.badRequest('A report can be attached once testing has started');
    }

    if (test.report_document_id) {
      // Keep the earlier report as a prior version rather than replacing it.
      await this.documentService.uploadNewVersion(test.report_document_id, {
        uploadedById: actor.id,
        originalName: file.originalName,
        mimeType: file.mimeType,
        fileSize: file.fileSize,
        buffer: file.buffer,
        changeNote: 'Updated security test report',
      });
    } else {
      const document = await this.documentService.upload({
        uploadedById: actor.id,
        originalName: file.originalName,
        mimeType: file.mimeType,
        fileSize: file.fileSize,
        buffer: file.buffer,
        module: 'system-audit',
        entityType: 'security_test',
        entityId: id,
      });
      await prisma.security_Test.update({ where: { id }, data: { report_document_id: document.id } });
    }

    logger.info('Security test report uploaded', { testId: id, actorId: actor.id });
    auditLogService.logAsync({
      userId: actor.id,
      action: 'system_audit.security_test.report',
      module: 'system-audit',
      entityType: 'security_test',
      entityId: id,
      newValues: { fileName: file.originalName, fileSize: file.fileSize },
    });
    return this.getTest(id, actor);
  }

  async getReportFile(id: string, actor: SystemAuditActor): Promise<ServedExtract> {
    const test = await this._getVisible(id, actor);
    if (!test.report_document_id) throw AppError.notFound('Security test report');
    const file = await this.documentService.getFileById(test.report_document_id);
    return { buffer: file.buffer, mimeType: file.mimeType, originalName: file.originalName };
  }

  // ── internals ───────────────────────────────────────────────

  /** Tests on an engagement follow its team; others are visible to every sectest:read holder. */
  private _visibility(actor: SystemAuditActor): Prisma.Security_TestWhereInput {
    if (actor.isSuperAdmin || actor.permissions.includes('engagement:read_all')) return {};
    return {
      OR: [
        { engagement_id: null },
        { coordinator_id: actor.id },
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

  private async _getVisible(id: string, actor: SystemAuditActor): Promise<SecurityTestWithRelations> {
    const test = await prisma.security_Test.findFirst({
      where: { AND: [{ id, deleted_at: null }, this._visibility(actor)] },
      include: securityTestInclude,
    });
    if (!test) throw AppError.notFound('Security test');
    return test;
  }

  private async _assertEngagementAccess(engagementId: string, actor: SystemAuditActor): Promise<void> {
    await this.engagementService.getEngagementById(engagementId, {
      id: actor.id,
      roles: actor.roles,
      permissions: actor.permissions,
    });
  }

  private async _assertAssets(assetIds: string[], actor: SystemAuditActor): Promise<void> {
    for (const assetId of assetIds) await this.assetService.getAssetById(assetId, actor);
  }

  private async _results(testIds: string[]): Promise<Map<string, SecurityTestResultsDto>> {
    const map = new Map<string, SecurityTestResultsDto>(
      testIds.map((id) => [id, { scanRuns: 0, latestScan: null, openExceptions: 0, findingsRaised: 0 }]),
    );
    if (testIds.length === 0) return map;

    const runs = await prisma.system_Audit_Run.findMany({
      where: { security_test_id: { in: testIds } },
      orderBy: { created_at: 'desc' },
      select: { id: true, security_test_id: true, summary: true },
    });
    const runToTest = new Map(runs.map((r) => [r.id, r.security_test_id!]));
    for (const run of runs) {
      const result = map.get(run.security_test_id!)!;
      result.scanRuns += 1;
      if (!result.latestScan) {
        const summary = parseJson<Record<string, number>>(run.summary, {});
        result.latestScan = {
          critical: summary.critical ?? 0,
          high: summary.high ?? 0,
          medium: summary.medium ?? 0,
          low: summary.low ?? 0,
        };
      }
    }
    if (runs.length > 0) {
      const exceptions = await prisma.system_Audit_Exception.findMany({
        where: { run_id: { in: runs.map((r) => r.id) } },
        select: { run_id: true, disposition: true, finding_id: true },
      });
      const findings = new Map<string, Set<string>>();
      for (const e of exceptions) {
        const testId = runToTest.get(e.run_id)!;
        const result = map.get(testId)!;
        if (e.disposition === ExceptionDisposition.Open) result.openExceptions += 1;
        if (e.finding_id) findings.set(testId, (findings.get(testId) ?? new Set()).add(e.finding_id));
      }
      for (const [testId, ids] of findings) map.get(testId)!.findingsRaised = ids.size;
    }
    return map;
  }
}
