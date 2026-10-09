"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SecurityTestService = void 0;
const client_1 = require("@prisma/client");
const prisma_client_1 = require("../../../../../shared/prisma/prisma.client");
const app_error_1 = require("../../../../../shared/errors/app.error");
const logger_util_1 = require("../../../../../shared/utils/logger.util");
const api_response_type_1 = require("../../../../../shared/types/api-response.type");
const prisma_types_1 = require("../../../../../shared/prisma/prisma.types");
const audit_log_service_1 = require("../../../../logging/service/implementation/audit-log.service");
const system_audit_enum_1 = require("../../../domain/enum/system-audit.enum");
const system_audit_utility_1 = require("../../../utility/system-audit.utility");
const security_test_response_dto_1 = require("../../dto/response/security-test.response.dto");
const TEST_PREFIX = 'SEC';
/** Authorisation (planned → authorised) is a separate, segregated action. */
const TRANSITIONS = {
    [system_audit_enum_1.SecurityTestStatus.Planned]: [system_audit_enum_1.SecurityTestStatus.Cancelled],
    [system_audit_enum_1.SecurityTestStatus.Authorised]: [system_audit_enum_1.SecurityTestStatus.InProgress, system_audit_enum_1.SecurityTestStatus.Cancelled],
    [system_audit_enum_1.SecurityTestStatus.InProgress]: [system_audit_enum_1.SecurityTestStatus.Reporting, system_audit_enum_1.SecurityTestStatus.Cancelled],
    [system_audit_enum_1.SecurityTestStatus.Reporting]: [system_audit_enum_1.SecurityTestStatus.Remediation, system_audit_enum_1.SecurityTestStatus.Closed],
    [system_audit_enum_1.SecurityTestStatus.Remediation]: [system_audit_enum_1.SecurityTestStatus.Closed],
    [system_audit_enum_1.SecurityTestStatus.Closed]: [],
    [system_audit_enum_1.SecurityTestStatus.Cancelled]: [],
};
const FINAL = [system_audit_enum_1.SecurityTestStatus.Closed, system_audit_enum_1.SecurityTestStatus.Cancelled];
// Changing any of these after authorisation means the tester is no longer covered by it.
const AUTHORISED_TERMS = ['testType', 'scope', 'rulesOfEngagement', 'plannedStart', 'plannedEnd', 'provider'];
const isUniqueViolation = (err) => err instanceof client_1.Prisma.PrismaClientKnownRequestError && err.code === 'P2002';
class SecurityTestService {
    userService;
    documentService;
    engagementService;
    assetService;
    constructor(userService, documentService, engagementService, assetService) {
        this.userService = userService;
        this.documentService = documentService;
        this.engagementService = engagementService;
        this.assetService = assetService;
    }
    async createTest(dto, actor) {
        const coordinatorId = dto.coordinatorId ?? actor.id;
        await this.userService.getUserById(coordinatorId);
        if (dto.engagementId)
            await this._assertEngagementAccess(dto.engagementId, actor);
        const assetIds = Array.from(new Set(dto.assetIds ?? []));
        await this._assertAssets(assetIds, actor);
        let id = '';
        for (let attempt = 1;; attempt += 1) {
            try {
                id = await prisma_client_1.prisma.$transaction(async (tx) => {
                    const latest = await tx.security_Test.findFirst({
                        where: { reference: { startsWith: `${TEST_PREFIX}-${new Date().getFullYear()}-` } },
                        orderBy: { reference: 'desc' },
                        select: { reference: true },
                    });
                    const created = await tx.security_Test.create({
                        data: {
                            reference: (0, system_audit_utility_1.nextReference)(TEST_PREFIX, latest?.reference),
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
            }
            catch (err) {
                if (attempt < 3 && isUniqueViolation(err))
                    continue;
                throw err;
            }
        }
        logger_util_1.logger.info('Security test planned', { testId: id, actorId: actor.id, testType: dto.testType });
        audit_log_service_1.auditLogService.logAsync({
            userId: actor.id,
            action: 'system_audit.security_test.create',
            module: 'system-audit',
            entityType: 'security_test',
            entityId: id,
            newValues: { ...dto, coordinatorId },
        });
        return this.getTest(id, actor);
    }
    async updateTest(id, dto, actor) {
        const existing = await this._getVisible(id, actor);
        const status = existing.status;
        if (FINAL.includes(status))
            throw app_error_1.AppError.badRequest(`A ${status} security test can no longer be edited`);
        const changesTerms = AUTHORISED_TERMS.some((key) => dto[key] !== undefined);
        const started = [system_audit_enum_1.SecurityTestStatus.InProgress, system_audit_enum_1.SecurityTestStatus.Reporting, system_audit_enum_1.SecurityTestStatus.Remediation].includes(status);
        if (changesTerms && started) {
            throw app_error_1.AppError.badRequest('Scope, schedule, provider, and rules of engagement are fixed once testing has started');
        }
        if (dto.coordinatorId)
            await this.userService.getUserById(dto.coordinatorId);
        if (dto.engagementId)
            await this._assertEngagementAccess(dto.engagementId, actor);
        const plannedStart = dto.plannedStart ? new Date(dto.plannedStart) : existing.planned_start;
        const plannedEnd = dto.plannedEnd ? new Date(dto.plannedEnd) : existing.planned_end;
        if (plannedEnd < plannedStart)
            throw app_error_1.AppError.badRequest('The planned end must be on or after the planned start');
        const voidsAuthorisation = changesTerms && status === system_audit_enum_1.SecurityTestStatus.Authorised;
        await prisma_client_1.prisma.security_Test.update({
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
                ...(voidsAuthorisation && { status: system_audit_enum_1.SecurityTestStatus.Planned, authorised_by_id: null, authorised_at: null }),
            },
        });
        logger_util_1.logger.info('Security test updated', { testId: id, actorId: actor.id, voidsAuthorisation });
        audit_log_service_1.auditLogService.logAsync({
            userId: actor.id,
            action: 'system_audit.security_test.update',
            module: 'system-audit',
            entityType: 'security_test',
            entityId: id,
            newValues: { ...dto, authorisationVoided: voidsAuthorisation },
        });
        return this.getTest(id, actor);
    }
    async deleteTest(id, actor) {
        const existing = await this._getVisible(id, actor);
        if (![system_audit_enum_1.SecurityTestStatus.Planned, system_audit_enum_1.SecurityTestStatus.Cancelled].includes(existing.status)) {
            throw app_error_1.AppError.badRequest('Only planned or cancelled security tests can be deleted — cancel it instead');
        }
        await prisma_client_1.prisma.security_Test.update({ where: { id }, data: { deleted_at: new Date() } });
        logger_util_1.logger.info('Security test deleted', { testId: id, actorId: actor.id });
        audit_log_service_1.auditLogService.logAsync({
            userId: actor.id,
            action: 'system_audit.security_test.delete',
            module: 'system-audit',
            entityType: 'security_test',
            entityId: id,
        });
    }
    async getTest(id, actor) {
        const test = await this._getVisible(id, actor);
        const [results, runs] = await Promise.all([
            this._results([id]),
            prisma_client_1.prisma.system_Audit_Run.findMany({
                where: { security_test_id: id },
                orderBy: { created_at: 'desc' },
                select: { id: true, reference: true, title: true, created_at: true, exception_count: true, summary: true },
            }),
        ]);
        return {
            ...(0, security_test_response_dto_1.mapSecurityTestToResponse)(test, TRANSITIONS[test.status] ?? [], results.get(id)),
            scanRuns: runs.map((r) => ({
                id: r.id,
                reference: r.reference,
                title: r.title,
                createdAt: r.created_at.toISOString(),
                exceptionCount: r.exception_count,
                summary: (0, system_audit_utility_1.parseJson)(r.summary, {}),
            })),
        };
    }
    async listTests(query, actor) {
        const { skip, take, page, pageSize } = (0, api_response_type_1.parsePagination)(query);
        const where = {
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
        const [total, tests] = await prisma_client_1.prisma.$transaction([
            prisma_client_1.prisma.security_Test.count({ where }),
            prisma_client_1.prisma.security_Test.findMany({ where, include: prisma_types_1.securityTestInclude, orderBy: { planned_start: 'desc' }, skip, take }),
        ]);
        const results = await this._results(tests.map((t) => t.id));
        return {
            tests: tests.map((t) => (0, security_test_response_dto_1.mapSecurityTestToResponse)(t, TRANSITIONS[t.status] ?? [], results.get(t.id))),
            meta: (0, api_response_type_1.buildPaginationMeta)(total, page, pageSize),
        };
    }
    async authoriseTest(id, dto, actor) {
        const test = await this._getVisible(id, actor);
        if (test.status !== system_audit_enum_1.SecurityTestStatus.Planned)
            throw app_error_1.AppError.badRequest('Only a planned security test can be authorised');
        // Segregation of duties: whoever arranges the test cannot also sign it off.
        if (test.coordinator_id === actor.id || test.created_by_id === actor.id) {
            throw app_error_1.AppError.forbidden('A security test must be authorised by someone other than its coordinator or creator');
        }
        await prisma_client_1.prisma.security_Test.update({
            where: { id },
            data: { status: system_audit_enum_1.SecurityTestStatus.Authorised, authorised_by_id: actor.id, authorised_at: new Date() },
        });
        logger_util_1.logger.info('Security test authorised', { testId: id, actorId: actor.id });
        audit_log_service_1.auditLogService.logAsync({
            userId: actor.id,
            action: 'system_audit.security_test.authorise',
            module: 'system-audit',
            entityType: 'security_test',
            entityId: id,
            oldValues: { status: test.status },
            newValues: { status: system_audit_enum_1.SecurityTestStatus.Authorised, note: dto.note },
        });
        return this.getTest(id, actor);
    }
    async changeStatus(id, dto, actor) {
        const test = await this._getVisible(id, actor);
        const from = test.status;
        const to = dto.status;
        if (!TRANSITIONS[from]?.includes(to)) {
            throw app_error_1.AppError.badRequest(from === system_audit_enum_1.SecurityTestStatus.Planned && to === system_audit_enum_1.SecurityTestStatus.InProgress
                ? 'The test must be authorised before testing starts'
                : `A security test cannot move from ${from} to ${to}`);
        }
        if (from === system_audit_enum_1.SecurityTestStatus.Reporting && !test.report_document_id) {
            throw app_error_1.AppError.badRequest('Upload the test report before moving to remediation or closing the test');
        }
        const now = new Date();
        await prisma_client_1.prisma.security_Test.update({
            where: { id },
            data: {
                status: to,
                ...(to === system_audit_enum_1.SecurityTestStatus.InProgress && !test.actual_start && { actual_start: now }),
                ...(to === system_audit_enum_1.SecurityTestStatus.Reporting && !test.actual_end && { actual_end: now }),
            },
        });
        logger_util_1.logger.info('Security test status changed', { testId: id, actorId: actor.id, from, to });
        audit_log_service_1.auditLogService.logAsync({
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
    async addAssets(id, dto, actor) {
        const test = await this._getVisible(id, actor);
        if (FINAL.includes(test.status))
            throw app_error_1.AppError.badRequest('The test is finished — its scope is fixed');
        const existing = new Set(test.assets.map((a) => a.asset.id));
        const toAdd = Array.from(new Set(dto.assetIds)).filter((a) => !existing.has(a));
        await this._assertAssets(toAdd, actor);
        if (toAdd.length > 0) {
            await prisma_client_1.prisma.security_Test_Asset.createMany({
                data: toAdd.map((assetId) => ({ test_id: id, asset_id: assetId, created_by_id: actor.id })),
            });
        }
        logger_util_1.logger.info('Assets added to security test scope', { testId: id, actorId: actor.id, count: toAdd.length });
        audit_log_service_1.auditLogService.logAsync({
            userId: actor.id,
            action: 'system_audit.security_test.assets.add',
            module: 'system-audit',
            entityType: 'security_test',
            entityId: id,
            newValues: { assetIds: toAdd },
        });
        return this.getTest(id, actor);
    }
    async removeAsset(id, assetId, actor) {
        const test = await this._getVisible(id, actor);
        if (FINAL.includes(test.status))
            throw app_error_1.AppError.badRequest('The test is finished — its scope is fixed');
        const removed = await prisma_client_1.prisma.security_Test_Asset.deleteMany({ where: { test_id: id, asset_id: assetId } });
        if (removed.count === 0)
            throw app_error_1.AppError.notFound('Asset in this test scope');
        logger_util_1.logger.info('Asset removed from security test scope', { testId: id, assetId, actorId: actor.id });
        audit_log_service_1.auditLogService.logAsync({
            userId: actor.id,
            action: 'system_audit.security_test.assets.remove',
            module: 'system-audit',
            entityType: 'security_test',
            entityId: id,
            oldValues: { assetId },
        });
        return this.getTest(id, actor);
    }
    async uploadReport(id, file, actor) {
        const test = await this._getVisible(id, actor);
        if ([system_audit_enum_1.SecurityTestStatus.Planned, system_audit_enum_1.SecurityTestStatus.Authorised, system_audit_enum_1.SecurityTestStatus.Cancelled].includes(test.status)) {
            throw app_error_1.AppError.badRequest('A report can be attached once testing has started');
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
        }
        else {
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
            await prisma_client_1.prisma.security_Test.update({ where: { id }, data: { report_document_id: document.id } });
        }
        logger_util_1.logger.info('Security test report uploaded', { testId: id, actorId: actor.id });
        audit_log_service_1.auditLogService.logAsync({
            userId: actor.id,
            action: 'system_audit.security_test.report',
            module: 'system-audit',
            entityType: 'security_test',
            entityId: id,
            newValues: { fileName: file.originalName, fileSize: file.fileSize },
        });
        return this.getTest(id, actor);
    }
    async getReportFile(id, actor) {
        const test = await this._getVisible(id, actor);
        if (!test.report_document_id)
            throw app_error_1.AppError.notFound('Security test report');
        const file = await this.documentService.getFileById(test.report_document_id);
        return { buffer: file.buffer, mimeType: file.mimeType, originalName: file.originalName };
    }
    // ── internals ───────────────────────────────────────────────
    /** Tests on an engagement follow its team; others are visible to every sectest:read holder. */
    _visibility(actor) {
        if (actor.isSuperAdmin || actor.permissions.includes('engagement:read_all'))
            return {};
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
    async _getVisible(id, actor) {
        const test = await prisma_client_1.prisma.security_Test.findFirst({
            where: { AND: [{ id, deleted_at: null }, this._visibility(actor)] },
            include: prisma_types_1.securityTestInclude,
        });
        if (!test)
            throw app_error_1.AppError.notFound('Security test');
        return test;
    }
    async _assertEngagementAccess(engagementId, actor) {
        await this.engagementService.getEngagementById(engagementId, {
            id: actor.id,
            roles: actor.roles,
            permissions: actor.permissions,
        });
    }
    async _assertAssets(assetIds, actor) {
        for (const assetId of assetIds)
            await this.assetService.getAssetById(assetId, actor);
    }
    async _results(testIds) {
        const map = new Map(testIds.map((id) => [id, { scanRuns: 0, latestScan: null, openExceptions: 0, findingsRaised: 0 }]));
        if (testIds.length === 0)
            return map;
        const runs = await prisma_client_1.prisma.system_Audit_Run.findMany({
            where: { security_test_id: { in: testIds } },
            orderBy: { created_at: 'desc' },
            select: { id: true, security_test_id: true, summary: true },
        });
        const runToTest = new Map(runs.map((r) => [r.id, r.security_test_id]));
        for (const run of runs) {
            const result = map.get(run.security_test_id);
            result.scanRuns += 1;
            if (!result.latestScan) {
                const summary = (0, system_audit_utility_1.parseJson)(run.summary, {});
                result.latestScan = {
                    critical: summary.critical ?? 0,
                    high: summary.high ?? 0,
                    medium: summary.medium ?? 0,
                    low: summary.low ?? 0,
                };
            }
        }
        if (runs.length > 0) {
            const exceptions = await prisma_client_1.prisma.system_Audit_Exception.findMany({
                where: { run_id: { in: runs.map((r) => r.id) } },
                select: { run_id: true, disposition: true, finding_id: true },
            });
            const findings = new Map();
            for (const e of exceptions) {
                const testId = runToTest.get(e.run_id);
                const result = map.get(testId);
                if (e.disposition === system_audit_enum_1.ExceptionDisposition.Open)
                    result.openExceptions += 1;
                if (e.finding_id)
                    findings.set(testId, (findings.get(testId) ?? new Set()).add(e.finding_id));
            }
            for (const [testId, ids] of findings)
                map.get(testId).findingsRaised = ids.size;
        }
        return map;
    }
}
exports.SecurityTestService = SecurityTestService;
//# sourceMappingURL=security-test.service.js.map