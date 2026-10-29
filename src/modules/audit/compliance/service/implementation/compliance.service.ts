import { Prisma } from '@prisma/client';
import { prisma } from '../../../../../shared/prisma/prisma.client';
import { AppError } from '../../../../../shared/errors/app.error';
import { logger } from '../../../../../shared/utils/logger.util';
import { PaginationMeta, buildPaginationMeta } from '../../../../../shared/types/api-response.type';
import { ActorContext } from '../../../domain/entity/audit.entity';
import { assertHasPermission } from '../../../utility/audit.utility';
import {
  ControlQueryDto,
  CreateControlRequestDto,
  CreateFrameworkRequestDto,
  UpdateControlRequestDto,
  UpdateFrameworkRequestDto,
  UploadFrameworkDocumentDto,
} from '../../dto/request/compliance.request.dto';
import {
  ComplianceCoverageDto,
  ControlResponseDto,
  ControlRiskDto,
  FrameworkResponseDto,
  RiskCoverageDto,
  TestedCoverageDto,
  mapControlToResponse,
  mapFrameworkToResponse,
} from '../../dto/response/compliance.response.dto';
import {
  ExtractedDocumentResult,
  deriveFrameworkMetaFromFilename,
  extractControlsFromDocument,
} from '../../utility/document-control-extractor.utility';
import { IComplianceService } from '../interface/compliance.service.interface';

const frameworkSelect = { code: true, name: true } as const;

export class ComplianceService implements IComplianceService {
  async listFrameworks(): Promise<FrameworkResponseDto[]> {
    const frameworks = await prisma.compliance_Framework.findMany({
      where: { deleted_at: null },
      orderBy: { code: 'asc' },
    });
    return frameworks.map(mapFrameworkToResponse);
  }

  async createFramework(dto: CreateFrameworkRequestDto, actor: ActorContext): Promise<FrameworkResponseDto> {
    assertHasPermission(actor.permissions, 'control:manage');
    const code = dto.code.trim();
    const existing = await prisma.compliance_Framework.findFirst({ where: { code } });
    if (existing) throw AppError.conflict(`A framework with code '${code}' already exists`);

    const framework = await prisma.compliance_Framework.create({
      data: {
        code,
        name: dto.name.trim(),
        description: dto.description?.trim() || null,
        category: dto.category,
        is_active: dto.isActive ?? true,
        created_by_id: actor.id,
      },
    });
    logger.info('Compliance framework created', { actorId: actor.id, frameworkId: framework.id, code });
    return mapFrameworkToResponse(framework);
  }

  async updateFramework(id: string, dto: UpdateFrameworkRequestDto, actor: ActorContext): Promise<FrameworkResponseDto> {
    assertHasPermission(actor.permissions, 'control:manage');
    const existing = await prisma.compliance_Framework.findFirst({ where: { id, deleted_at: null } });
    if (!existing) throw AppError.notFound('Compliance framework');

    const framework = await prisma.compliance_Framework.update({
      where: { id },
      data: {
        name: dto.name?.trim(),
        description: dto.description === undefined ? undefined : dto.description?.trim() || null,
        category: dto.category,
        is_active: dto.isActive,
      },
    });
    logger.info('Compliance framework updated', { actorId: actor.id, frameworkId: id });
    return mapFrameworkToResponse(framework);
  }

  async getCoverage(): Promise<ComplianceCoverageDto> {
    const [frameworks, controls] = await Promise.all([
      prisma.compliance_Framework.findMany({ where: { deleted_at: null }, orderBy: { code: 'asc' } }),
      prisma.compliance_Control.findMany({
        where: { deleted_at: null },
        select: { framework_id: true, audit_type: true, is_active: true },
      }),
    ]);

    const byFramework = new Map<string, { total: number; active: number; byAuditType: Record<string, number> }>();
    for (const c of controls) {
      const agg = byFramework.get(c.framework_id) ?? { total: 0, active: 0, byAuditType: {} };
      agg.total += 1;
      if (c.is_active) agg.active += 1;
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

  async getTestedCoverage(): Promise<TestedCoverageDto> {
    const [frameworks, controls, grouped] = await Promise.all([
      prisma.compliance_Framework.findMany({ where: { deleted_at: null }, orderBy: { code: 'asc' } }),
      prisma.compliance_Control.findMany({
        where: { deleted_at: null, is_active: true },
        select: { framework_id: true, control_reference: true },
      }),
      prisma.audit_Checklist.groupBy({
        by: ['control_reference', 'result'],
        _count: { _all: true },
      }),
    ]);

    // control reference -> framework id, and framework id -> set of references
    const refToFramework = new Map<string, string>();
    const frameworkRefs = new Map<string, Set<string>>();
    for (const c of controls) {
      refToFramework.set(c.control_reference, c.framework_id);
      const set = frameworkRefs.get(c.framework_id) ?? new Set<string>();
      set.add(c.control_reference);
      frameworkRefs.set(c.framework_id, set);
    }

    interface Acc { tested: Set<string>; passed: number; failed: number; na: number; }
    const accByFramework = new Map<string, Acc>();
    const ensure = (frameworkId: string): Acc => {
      let acc = accByFramework.get(frameworkId);
      if (!acc) {
        acc = { tested: new Set<string>(), passed: 0, failed: 0, na: 0 };
        accByFramework.set(frameworkId, acc);
      }
      return acc;
    };

    for (const row of grouped) {
      const frameworkId = refToFramework.get(row.control_reference);
      if (!frameworkId) continue; // snapshot of a retired/unmapped control — skip rollup
      const acc = ensure(frameworkId);
      const count = row._count._all;
      if (row.result === 'passed') { acc.passed += count; acc.tested.add(row.control_reference); }
      else if (row.result === 'failed') { acc.failed += count; acc.tested.add(row.control_reference); }
      else if (row.result === 'not_applicable') { acc.na += count; acc.tested.add(row.control_reference); }
      // 'not_tested' does not count as exercised
    }

    const pct = (n: number, d: number): number => (d > 0 ? Math.round((n / d) * 100) : 0);

    const perFramework = frameworks.map((f) => {
      const total = frameworkRefs.get(f.id)?.size ?? 0;
      const acc = accByFramework.get(f.id) ?? { tested: new Set<string>(), passed: 0, failed: 0, na: 0 };
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

    const totals = perFramework.reduce(
      (s, f) => ({
        totalControls: s.totalControls + f.totalControls,
        testedControls: s.testedControls + f.testedControls,
        passed: s.passed + f.passed,
        failed: s.failed + f.failed,
        na: s.na + f.notApplicable,
      }),
      { totalControls: 0, testedControls: 0, passed: 0, failed: 0, na: 0 },
    );

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

  async listControls(query: ControlQueryDto): Promise<{ controls: ControlResponseDto[]; meta: PaginationMeta }> {
    const where: Prisma.Compliance_ControlWhereInput = {
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

    const [rows, total] = await prisma.$transaction([
      prisma.compliance_Control.findMany({
        where,
        include: { framework: { select: frameworkSelect } },
        orderBy: [{ audit_type: 'asc' }, { control_reference: 'asc' }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      prisma.compliance_Control.count({ where }),
    ]);

    return {
      controls: rows.map(mapControlToResponse),
      meta: buildPaginationMeta(total, query.page, query.pageSize),
    };
  }

  async createControl(dto: CreateControlRequestDto, actor: ActorContext): Promise<ControlResponseDto> {
    assertHasPermission(actor.permissions, 'control:manage');
    const framework = await prisma.compliance_Framework.findFirst({
      where: { id: dto.frameworkId, deleted_at: null },
    });
    if (!framework) throw AppError.notFound('Compliance framework');

    const controlReference = dto.controlReference.trim();
    const duplicate = await prisma.compliance_Control.findFirst({
      where: { framework_id: dto.frameworkId, control_reference: controlReference, deleted_at: null },
    });
    if (duplicate) throw AppError.conflict(`Control '${controlReference}' already exists for this framework`);

    const control = await prisma.compliance_Control.create({
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
    logger.info('Compliance control created', { actorId: actor.id, controlId: control.id, controlReference });
    return mapControlToResponse(control);
  }

  async updateControl(id: string, dto: UpdateControlRequestDto, actor: ActorContext): Promise<ControlResponseDto> {
    assertHasPermission(actor.permissions, 'control:manage');
    const existing = await prisma.compliance_Control.findFirst({ where: { id, deleted_at: null } });
    if (!existing) throw AppError.notFound('Compliance control');

    if (dto.frameworkId && dto.frameworkId !== existing.framework_id) {
      const framework = await prisma.compliance_Framework.findFirst({
        where: { id: dto.frameworkId, deleted_at: null },
      });
      if (!framework) throw AppError.notFound('Compliance framework');
    }

    const control = await prisma.compliance_Control.update({
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
    logger.info('Compliance control updated', { actorId: actor.id, controlId: id });
    return mapControlToResponse(control);
  }

  async deleteControl(id: string, actor: ActorContext): Promise<void> {
    assertHasPermission(actor.permissions, 'control:manage');
    const existing = await prisma.compliance_Control.findFirst({ where: { id, deleted_at: null } });
    if (!existing) throw AppError.notFound('Compliance control');

    await prisma.compliance_Control.update({
      where: { id },
      data: { deleted_at: new Date(), is_active: false },
    });
    logger.info('Compliance control retired', { actorId: actor.id, controlId: id });
  }

  async listControlRisks(controlId: string): Promise<ControlRiskDto[]> {
    const links = await prisma.compliance_Control_Risk.findMany({
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

  async linkRisk(controlId: string, riskId: string, actor: ActorContext): Promise<ControlRiskDto[]> {
    assertHasPermission(actor.permissions, 'control:manage');
    const control = await prisma.compliance_Control.findFirst({ where: { id: controlId, deleted_at: null } });
    if (!control) throw AppError.notFound('Compliance control');
    const risk = await prisma.risk_Register.findFirst({ where: { id: riskId, deleted_at: null } });
    if (!risk) throw AppError.notFound('Risk');

    const existing = await prisma.compliance_Control_Risk.findFirst({ where: { control_id: controlId, risk_id: riskId } });
    if (!existing) {
      await prisma.compliance_Control_Risk.create({
        data: { control_id: controlId, risk_id: riskId, created_by_id: actor.id },
      });
      logger.info('Compliance control linked to risk', { actorId: actor.id, controlId, riskId });
    }
    return this.listControlRisks(controlId);
  }

  async unlinkRisk(controlId: string, riskId: string, actor: ActorContext): Promise<void> {
    assertHasPermission(actor.permissions, 'control:manage');
    await prisma.compliance_Control_Risk.deleteMany({ where: { control_id: controlId, risk_id: riskId } });
    logger.info('Compliance control unlinked from risk', { actorId: actor.id, controlId, riskId });
  }

  async getRiskCoverage(): Promise<RiskCoverageDto> {
    const [risks, links, grouped] = await Promise.all([
      prisma.risk_Register.findMany({
        where: { deleted_at: null },
        select: { id: true, title: true, current_score: true, status: true, category: { select: { name: true } } },
        orderBy: { current_score: 'desc' },
      }),
      prisma.compliance_Control_Risk.findMany({
        include: { control: { select: { control_reference: true, is_active: true, deleted_at: true } } },
      }),
      prisma.audit_Checklist.groupBy({ by: ['control_reference', 'result'], _count: { _all: true } }),
    ]);

    // References exercised at least once (any evaluated result).
    const testedRefs = new Set<string>();
    for (const row of grouped) {
      if (row.result === 'passed' || row.result === 'failed' || row.result === 'not_applicable') {
        testedRefs.add(row.control_reference);
      }
    }

    // risk id -> mapped active control references
    const mappedByRisk = new Map<string, Set<string>>();
    for (const link of links) {
      if (!link.control || link.control.deleted_at || !link.control.is_active) continue;
      const set = mappedByRisk.get(link.risk_id) ?? new Set<string>();
      set.add(link.control.control_reference);
      mappedByRisk.set(link.risk_id, set);
    }

    const items = risks.map((r) => {
      const mapped = mappedByRisk.get(r.id) ?? new Set<string>();
      let tested = 0;
      for (const ref of mapped) if (testedRefs.has(ref)) tested += 1;
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

  async extractDocumentPreview(
    file: { buffer: Buffer; mimetype: string; originalname: string },
    prefix?: string,
  ): Promise<ExtractedDocumentResult> {
    if (!file || !file.buffer) {
      throw AppError.badRequest('A document file is required');
    }
    return extractControlsFromDocument(file.buffer, file.mimetype, file.originalname, prefix);
  }

  async uploadFrameworkDocument(
    file: { buffer: Buffer; mimetype: string; originalname: string } | undefined,
    dto: UploadFrameworkDocumentDto,
    actor: ActorContext,
  ): Promise<{
    framework: FrameworkResponseDto;
    controlsCreated: number;
    controls: ControlResponseDto[];
  }> {
    let extractedControls = Array.isArray(dto.controls)
      ? dto.controls
          .map((c) => ({
            controlReference: String(c.controlReference ?? '').trim(),
            controlDescription: String(c.controlDescription ?? '').trim(),
            testProcedure: String(c.testProcedure ?? '').trim(),
          }))
          .filter((c) => c.controlReference && c.controlDescription && c.testProcedure)
      : [];

    let suggestedCode = dto.code?.trim() || '';
    let suggestedName = dto.name?.trim() || '';

    if (file && file.buffer) {
      const extracted = await extractControlsFromDocument(
        file.buffer,
        file.mimetype,
        file.originalname,
        dto.prefix || dto.code,
      );
      if (!suggestedCode) suggestedCode = extracted.suggestedCode;
      if (!suggestedName) suggestedName = extracted.suggestedName;
      if (extractedControls.length === 0) {
        extractedControls = extracted.controls;
      }
    } else if (!suggestedCode || !suggestedName) {
      const derived = deriveFrameworkMetaFromFilename(dto.name || 'Policy Framework', dto.prefix || dto.code);
      if (!suggestedCode) suggestedCode = derived.suggestedCode;
      if (!suggestedName) suggestedName = derived.suggestedName;
    }

    if (extractedControls.length === 0) {
      throw AppError.badRequest('No controls could be extracted from the provided document');
    }

    let frameworkRecord;
    if (dto.frameworkId) {
      frameworkRecord = await prisma.compliance_Framework.findFirst({
        where: { id: dto.frameworkId, deleted_at: null },
      });
      if (!frameworkRecord) throw AppError.notFound('Compliance framework');
    } else {
      const code = (dto.code?.trim() || suggestedCode || 'DOC-001')
        .replace(/[^A-Za-z0-9.\-]/g, '-')
        .slice(0, 40);
      const name = (dto.name?.trim() || suggestedName || code).slice(0, 160);
      const category = (dto.category?.trim() || 'regulatory').slice(0, 50);

      const existing = await prisma.compliance_Framework.findFirst({
        where: { code },
      });

      if (existing) {
        frameworkRecord = await prisma.compliance_Framework.update({
          where: { id: existing.id },
          data: {
            name: dto.name?.trim() || existing.name,
            description: dto.description?.trim() ?? existing.description,
            category: dto.category?.trim() || existing.category,
            is_active: true,
            deleted_at: null,
          },
        });
      } else {
        frameworkRecord = await prisma.compliance_Framework.create({
          data: {
            code,
            name,
            description: dto.description?.trim() || null,
            category,
            is_active: true,
            created_by_id: actor.id,
          },
        });
      }
    }

    const existingRefs = new Set(
      (
        await prisma.compliance_Control.findMany({
          where: { framework_id: frameworkRecord.id, deleted_at: null },
          select: { control_reference: true },
        })
      ).map((r) => r.control_reference.toUpperCase()),
    );

    const auditType = dto.auditType?.trim() || 'compliance';
    const createdRows: ControlResponseDto[] = [];

    for (const item of extractedControls) {
      const ref = item.controlReference.trim().slice(0, 80);
      if (!ref || existingRefs.has(ref.toUpperCase())) continue;
      existingRefs.add(ref.toUpperCase());

      const created = await prisma.compliance_Control.create({
        data: {
          framework_id: frameworkRecord.id,
          control_reference: ref,
          control_description: item.controlDescription.trim(),
          test_procedure: item.testProcedure.trim(),
          audit_type: auditType,
          is_active: true,
          created_by_id: actor.id,
        },
        include: { framework: { select: frameworkSelect } },
      });
      createdRows.push(mapControlToResponse(created));
    }

    logger.info('Compliance framework document uploaded', {
      actorId: actor.id,
      frameworkId: frameworkRecord.id,
      controlsCreated: createdRows.length,
    });

    return {
      framework: mapFrameworkToResponse(frameworkRecord),
      controlsCreated: createdRows.length,
      controls: createdRows,
    };
  }
}
