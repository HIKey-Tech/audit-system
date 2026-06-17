"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ComplianceService = void 0;
const prisma_client_1 = require("../../../../../shared/prisma/prisma.client");
const app_error_1 = require("../../../../../shared/errors/app.error");
const logger_util_1 = require("../../../../../shared/utils/logger.util");
const api_response_type_1 = require("../../../../../shared/types/api-response.type");
const audit_utility_1 = require("../../../utility/audit.utility");
const compliance_response_dto_1 = require("../../dto/response/compliance.response.dto");
const frameworkSelect = { code: true, name: true };
class ComplianceService {
    async listFrameworks() {
        const frameworks = await prisma_client_1.prisma.compliance_Framework.findMany({
            where: { deleted_at: null },
            orderBy: { code: 'asc' },
        });
        return frameworks.map(compliance_response_dto_1.mapFrameworkToResponse);
    }
    async createFramework(dto, actor) {
        (0, audit_utility_1.assertHasPermission)(actor.permissions, 'control:manage');
        const code = dto.code.trim();
        const existing = await prisma_client_1.prisma.compliance_Framework.findFirst({ where: { code } });
        if (existing)
            throw app_error_1.AppError.conflict(`A framework with code '${code}' already exists`);
        const framework = await prisma_client_1.prisma.compliance_Framework.create({
            data: {
                code,
                name: dto.name.trim(),
                description: dto.description?.trim() || null,
                category: dto.category,
                is_active: dto.isActive ?? true,
                created_by_id: actor.id,
            },
        });
        logger_util_1.logger.info('Compliance framework created', { actorId: actor.id, frameworkId: framework.id, code });
        return (0, compliance_response_dto_1.mapFrameworkToResponse)(framework);
    }
    async updateFramework(id, dto, actor) {
        (0, audit_utility_1.assertHasPermission)(actor.permissions, 'control:manage');
        const existing = await prisma_client_1.prisma.compliance_Framework.findFirst({ where: { id, deleted_at: null } });
        if (!existing)
            throw app_error_1.AppError.notFound('Compliance framework');
        const framework = await prisma_client_1.prisma.compliance_Framework.update({
            where: { id },
            data: {
                name: dto.name?.trim(),
                description: dto.description === undefined ? undefined : dto.description?.trim() || null,
                category: dto.category,
                is_active: dto.isActive,
            },
        });
        logger_util_1.logger.info('Compliance framework updated', { actorId: actor.id, frameworkId: id });
        return (0, compliance_response_dto_1.mapFrameworkToResponse)(framework);
    }
    async getCoverage() {
        const [frameworks, controls] = await Promise.all([
            prisma_client_1.prisma.compliance_Framework.findMany({ where: { deleted_at: null }, orderBy: { code: 'asc' } }),
            prisma_client_1.prisma.compliance_Control.findMany({
                where: { deleted_at: null },
                select: { framework_id: true, audit_type: true, is_active: true },
            }),
        ]);
        const byFramework = new Map();
        for (const c of controls) {
            const agg = byFramework.get(c.framework_id) ?? { total: 0, active: 0, byAuditType: {} };
            agg.total += 1;
            if (c.is_active)
                agg.active += 1;
            agg.byAuditType[c.audit_type] = (agg.byAuditType[c.audit_type] ?? 0) + 1;
            byFramework.set(c.framework_id, agg);
        }
        const coverage = frameworks.map((f) => {
            const agg = byFramework.get(f.id) ?? { total: 0, active: 0, byAuditType: {} };
            return {
                id: f.id,
                code: f.code,
                name: f.name,
                category: f.category,
                isActive: f.is_active,
                totalControls: agg.total,
                activeControls: agg.active,
                byAuditType: agg.byAuditType,
            };
        });
        return {
            frameworks: coverage,
            totalFrameworks: frameworks.length,
            totalControls: controls.length,
            activeControls: controls.filter((c) => c.is_active).length,
        };
    }
    async getTestedCoverage() {
        const [frameworks, controls, grouped] = await Promise.all([
            prisma_client_1.prisma.compliance_Framework.findMany({ where: { deleted_at: null }, orderBy: { code: 'asc' } }),
            prisma_client_1.prisma.compliance_Control.findMany({
                where: { deleted_at: null, is_active: true },
                select: { framework_id: true, control_reference: true },
            }),
            prisma_client_1.prisma.audit_Checklist.groupBy({
                by: ['control_reference', 'result'],
                _count: { _all: true },
            }),
        ]);
        // control reference -> framework id, and framework id -> set of references
        const refToFramework = new Map();
        const frameworkRefs = new Map();
        for (const c of controls) {
            refToFramework.set(c.control_reference, c.framework_id);
            const set = frameworkRefs.get(c.framework_id) ?? new Set();
            set.add(c.control_reference);
            frameworkRefs.set(c.framework_id, set);
        }
        const accByFramework = new Map();
        const ensure = (frameworkId) => {
            let acc = accByFramework.get(frameworkId);
            if (!acc) {
                acc = { tested: new Set(), passed: 0, failed: 0, na: 0 };
                accByFramework.set(frameworkId, acc);
            }
            return acc;
        };
        for (const row of grouped) {
            const frameworkId = refToFramework.get(row.control_reference);
            if (!frameworkId)
                continue; // snapshot of a retired/unmapped control — skip rollup
            const acc = ensure(frameworkId);
            const count = row._count._all;
            if (row.result === 'passed') {
                acc.passed += count;
                acc.tested.add(row.control_reference);
            }
            else if (row.result === 'failed') {
                acc.failed += count;
                acc.tested.add(row.control_reference);
            }
            else if (row.result === 'not_applicable') {
                acc.na += count;
                acc.tested.add(row.control_reference);
            }
            // 'not_tested' does not count as exercised
        }
        const pct = (n, d) => (d > 0 ? Math.round((n / d) * 100) : 0);
        const perFramework = frameworks.map((f) => {
            const total = frameworkRefs.get(f.id)?.size ?? 0;
            const acc = accByFramework.get(f.id) ?? { tested: new Set(), passed: 0, failed: 0, na: 0 };
            return {
                id: f.id,
                code: f.code,
                name: f.name,
                category: f.category,
                totalControls: total,
                testedControls: acc.tested.size,
                coveragePct: pct(acc.tested.size, total),
                passed: acc.passed,
                failed: acc.failed,
                notApplicable: acc.na,
                passRatePct: pct(acc.passed, acc.passed + acc.failed),
            };
        });
        const totals = perFramework.reduce((s, f) => ({
            totalControls: s.totalControls + f.totalControls,
            testedControls: s.testedControls + f.testedControls,
            passed: s.passed + f.passed,
            failed: s.failed + f.failed,
            na: s.na + f.notApplicable,
        }), { totalControls: 0, testedControls: 0, passed: 0, failed: 0, na: 0 });
        return {
            frameworks: perFramework,
            totalControls: totals.totalControls,
            testedControls: totals.testedControls,
            coveragePct: pct(totals.testedControls, totals.totalControls),
            passed: totals.passed,
            failed: totals.failed,
            notApplicable: totals.na,
        };
    }
    async listControls(query) {
        const where = {
            deleted_at: null,
            ...(query.frameworkId ? { framework_id: query.frameworkId } : {}),
            ...(query.auditType ? { audit_type: query.auditType } : {}),
            ...(query.isActive === undefined ? {} : { is_active: query.isActive }),
            ...(query.search
                ? {
                    OR: [
                        { control_reference: { contains: query.search } },
                        { control_description: { contains: query.search } },
                    ],
                }
                : {}),
        };
        const [rows, total] = await prisma_client_1.prisma.$transaction([
            prisma_client_1.prisma.compliance_Control.findMany({
                where,
                include: { framework: { select: frameworkSelect } },
                orderBy: [{ audit_type: 'asc' }, { control_reference: 'asc' }],
                skip: (query.page - 1) * query.pageSize,
                take: query.pageSize,
            }),
            prisma_client_1.prisma.compliance_Control.count({ where }),
        ]);
        return {
            controls: rows.map(compliance_response_dto_1.mapControlToResponse),
            meta: (0, api_response_type_1.buildPaginationMeta)(total, query.page, query.pageSize),
        };
    }
    async createControl(dto, actor) {
        (0, audit_utility_1.assertHasPermission)(actor.permissions, 'control:manage');
        const framework = await prisma_client_1.prisma.compliance_Framework.findFirst({
            where: { id: dto.frameworkId, deleted_at: null },
        });
        if (!framework)
            throw app_error_1.AppError.notFound('Compliance framework');
        const controlReference = dto.controlReference.trim();
        const duplicate = await prisma_client_1.prisma.compliance_Control.findFirst({
            where: { framework_id: dto.frameworkId, control_reference: controlReference, deleted_at: null },
        });
        if (duplicate)
            throw app_error_1.AppError.conflict(`Control '${controlReference}' already exists for this framework`);
        const control = await prisma_client_1.prisma.compliance_Control.create({
            data: {
                framework_id: dto.frameworkId,
                control_reference: controlReference,
                control_description: dto.controlDescription.trim(),
                test_procedure: dto.testProcedure.trim(),
                audit_type: dto.auditType,
                is_active: dto.isActive ?? true,
                created_by_id: actor.id,
            },
            include: { framework: { select: frameworkSelect } },
        });
        logger_util_1.logger.info('Compliance control created', { actorId: actor.id, controlId: control.id, controlReference });
        return (0, compliance_response_dto_1.mapControlToResponse)(control);
    }
    async updateControl(id, dto, actor) {
        (0, audit_utility_1.assertHasPermission)(actor.permissions, 'control:manage');
        const existing = await prisma_client_1.prisma.compliance_Control.findFirst({ where: { id, deleted_at: null } });
        if (!existing)
            throw app_error_1.AppError.notFound('Compliance control');
        if (dto.frameworkId && dto.frameworkId !== existing.framework_id) {
            const framework = await prisma_client_1.prisma.compliance_Framework.findFirst({
                where: { id: dto.frameworkId, deleted_at: null },
            });
            if (!framework)
                throw app_error_1.AppError.notFound('Compliance framework');
        }
        const control = await prisma_client_1.prisma.compliance_Control.update({
            where: { id },
            data: {
                framework_id: dto.frameworkId,
                control_reference: dto.controlReference?.trim(),
                control_description: dto.controlDescription?.trim(),
                test_procedure: dto.testProcedure?.trim(),
                audit_type: dto.auditType,
                is_active: dto.isActive,
            },
            include: { framework: { select: frameworkSelect } },
        });
        logger_util_1.logger.info('Compliance control updated', { actorId: actor.id, controlId: id });
        return (0, compliance_response_dto_1.mapControlToResponse)(control);
    }
    async deleteControl(id, actor) {
        (0, audit_utility_1.assertHasPermission)(actor.permissions, 'control:manage');
        const existing = await prisma_client_1.prisma.compliance_Control.findFirst({ where: { id, deleted_at: null } });
        if (!existing)
            throw app_error_1.AppError.notFound('Compliance control');
        await prisma_client_1.prisma.compliance_Control.update({
            where: { id },
            data: { deleted_at: new Date(), is_active: false },
        });
        logger_util_1.logger.info('Compliance control retired', { actorId: actor.id, controlId: id });
    }
    async listControlRisks(controlId) {
        const links = await prisma_client_1.prisma.compliance_Control_Risk.findMany({
            where: { control_id: controlId, risk: { deleted_at: null } },
            include: { risk: { select: { id: true, title: true, current_score: true, status: true, category: { select: { name: true } } } } },
            orderBy: { risk: { current_score: 'desc' } },
        });
        return links.map((l) => ({
            riskId: l.risk.id,
            title: l.risk.title,
            currentScore: l.risk.current_score,
            status: l.risk.status,
            category: l.risk.category?.name ?? null,
        }));
    }
    async linkRisk(controlId, riskId, actor) {
        (0, audit_utility_1.assertHasPermission)(actor.permissions, 'control:manage');
        const control = await prisma_client_1.prisma.compliance_Control.findFirst({ where: { id: controlId, deleted_at: null } });
        if (!control)
            throw app_error_1.AppError.notFound('Compliance control');
        const risk = await prisma_client_1.prisma.risk_Register.findFirst({ where: { id: riskId, deleted_at: null } });
        if (!risk)
            throw app_error_1.AppError.notFound('Risk');
        const existing = await prisma_client_1.prisma.compliance_Control_Risk.findFirst({ where: { control_id: controlId, risk_id: riskId } });
        if (!existing) {
            await prisma_client_1.prisma.compliance_Control_Risk.create({
                data: { control_id: controlId, risk_id: riskId, created_by_id: actor.id },
            });
            logger_util_1.logger.info('Compliance control linked to risk', { actorId: actor.id, controlId, riskId });
        }
        return this.listControlRisks(controlId);
    }
    async unlinkRisk(controlId, riskId, actor) {
        (0, audit_utility_1.assertHasPermission)(actor.permissions, 'control:manage');
        await prisma_client_1.prisma.compliance_Control_Risk.deleteMany({ where: { control_id: controlId, risk_id: riskId } });
        logger_util_1.logger.info('Compliance control unlinked from risk', { actorId: actor.id, controlId, riskId });
    }
    async getRiskCoverage() {
        const [risks, links, grouped] = await Promise.all([
            prisma_client_1.prisma.risk_Register.findMany({
                where: { deleted_at: null },
                select: { id: true, title: true, current_score: true, status: true, category: { select: { name: true } } },
                orderBy: { current_score: 'desc' },
            }),
            prisma_client_1.prisma.compliance_Control_Risk.findMany({
                include: { control: { select: { control_reference: true, is_active: true, deleted_at: true } } },
            }),
            prisma_client_1.prisma.audit_Checklist.groupBy({ by: ['control_reference', 'result'], _count: { _all: true } }),
        ]);
        // References exercised at least once (any evaluated result).
        const testedRefs = new Set();
        for (const row of grouped) {
            if (row.result === 'passed' || row.result === 'failed' || row.result === 'not_applicable') {
                testedRefs.add(row.control_reference);
            }
        }
        // risk id -> mapped active control references
        const mappedByRisk = new Map();
        for (const link of links) {
            if (!link.control || link.control.deleted_at || !link.control.is_active)
                continue;
            const set = mappedByRisk.get(link.risk_id) ?? new Set();
            set.add(link.control.control_reference);
            mappedByRisk.set(link.risk_id, set);
        }
        const items = risks.map((r) => {
            const mapped = mappedByRisk.get(r.id) ?? new Set();
            let tested = 0;
            for (const ref of mapped)
                if (testedRefs.has(ref))
                    tested += 1;
            return {
                id: r.id,
                title: r.title,
                currentScore: r.current_score,
                status: r.status,
                category: r.category?.name ?? null,
                mappedControls: mapped.size,
                testedControls: tested,
            };
        });
        const coveredRisks = items.filter((i) => i.mappedControls > 0).length;
        return {
            risks: items,
            totalRisks: items.length,
            coveredRisks,
            uncoveredRisks: items.length - coveredRisks,
        };
    }
}
exports.ComplianceService = ComplianceService;
//# sourceMappingURL=compliance.service.js.map