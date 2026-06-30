import { api } from '../api-client';
import type {
  AuditUniverseEntity,
  AuditUniverseDetail,
  AuditPlan,
  AuditPlanItem,
  AuditEngagement,
  AuditEngagementDetail,
  AuditWorkingPaper,
  WorkingPaperImportPreview,
  AuditEvidence,
  AuditFinding,
  AuditChecklistItem,
  ChecklistTemplateConfig,
  ChecklistTemplateControl,
  AuditReport,
  AuditFollowUp,
  EligibleUserDto,
} from '../types/domain';

// ============================================================
// Universe
// ============================================================
export interface UniverseListQuery {
  page?: number;
  pageSize?: number;
  search?: string;
  category?: string;
  status?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface CreateUniverseEntityDto {
  name: string;
  description?: string;
  category: string;
  ownerId: string;
  auditFrequency: string;
}

export interface UpdateUniverseEntityDto extends Partial<CreateUniverseEntityDto> {
  status?: string;
}

export const universeApi = {
  list: (q?: UniverseListQuery) =>
    api.getPaginated<AuditUniverseEntity>('/audit/universe', q as Record<string, string | number | boolean | undefined>),
  get: (id: string) => api.get<AuditUniverseDetail>(`/audit/universe/${id}`),
  create: (dto: CreateUniverseEntityDto) =>
    api.post<AuditUniverseEntity>('/audit/universe', dto),
  update: (id: string, dto: UpdateUniverseEntityDto) =>
    api.put<AuditUniverseEntity>(`/audit/universe/${id}`, dto),
  remove: (id: string) => api.delete(`/audit/universe/${id}`),
};

// ============================================================
// Plans
// ============================================================
export interface PlansListQuery {
  page?: number;
  pageSize?: number;
  year?: number;
  status?: string;
}

export interface CreatePlanDto {
  title: string;
  year: number;
  description?: string;
}

export interface AddPlanItemDto {
  universeId: string;
  auditType: string;
  priority: string;
  plannedStartDate: string;
  plannedEndDate: string;
  notes?: string | null;
}

export const plansApi = {
  list: (q?: PlansListQuery) =>
    api.getPaginated<AuditPlan>('/audit/plans', q as Record<string, string | number | boolean | undefined>),
  get: (id: string) => api.get<AuditPlan>(`/audit/plans/${id}`),
  create: (dto: CreatePlanDto) => api.post<AuditPlan>('/audit/plans', dto),
  update: (id: string, dto: Partial<CreatePlanDto>) =>
    api.put<AuditPlan>(`/audit/plans/${id}`, dto),
  remove: (id: string) => api.delete(`/audit/plans/${id}`),
  addItem: (planId: string, dto: AddPlanItemDto) =>
    api.post<AuditPlanItem>(`/audit/plans/${planId}/items`, dto),
  removeItem: (planId: string, itemId: string) =>
    api.delete(`/audit/plans/${planId}/items/${itemId}`),
  submit: (id: string) => api.post<AuditPlan>(`/audit/plans/${id}/submit`),
  approve: (id: string, comment?: string) =>
    api.post<AuditPlan>(`/audit/plans/${id}/approve`, { comment }),
  reject: (id: string, reason: string) =>
    api.post<AuditPlan>(`/audit/plans/${id}/reject`, { reason }),
  /** POST /audit/engagements with planItemId in body */
  createEngagement: (planItemId: string, dto: Omit<CreateEngagementFromPlanDto, 'planItemId'>) =>
    api.post<AuditEngagement>('/audit/engagements', { ...dto, planItemId }),
};

// ============================================================
// Engagements
// ============================================================
export interface EngagementsListQuery {
  page?: number;
  pageSize?: number;
  status?: string;
  auditType?: string;
  priority?: string;
  leadAuditorId?: string;
  overdue?: boolean;
  search?: string;
}

/** Customisable checklist control set chosen at engagement creation. */
export interface ChecklistControlInput {
  controlReference: string;
  controlDescription: string;
  testProcedure: string;
}

export interface CreateEngagementFromPlanDto {
  title: string;
  leadAuditorId: string;
  auditManagerId: string;
  auditeeId: string;
  plannedStartDate: string;
  plannedEndDate: string;
  slaDeadline: string;
  planItemId: string;
  universeId?: string;
  auditType?: string;
  priority?: string;
  checklistControls?: ChecklistControlInput[];
}

export interface CreateAdhocEngagementDto {
  title: string;
  leadAuditorId: string;
  auditManagerId: string;
  auditeeId: string;
  plannedStartDate: string;
  plannedEndDate: string;
  slaDeadline: string;
  universeId: string;
  auditType: string;
  priority: string;
  adhocReason: string;
  checklistControls?: ChecklistControlInput[];
}

export interface UpdateEngagementDto {
  title?: string;
  leadAuditorId?: string;
  auditManagerId?: string;
  auditeeId?: string;
  plannedStartDate?: string;
  plannedEndDate?: string;
  slaDeadline?: string;
  priority?: string;
  adhocReason?: string | null;
}

export const engagementsApi = {
  list: (q?: EngagementsListQuery) =>
    api.getPaginated<AuditEngagement>('/audit/engagements', q as Record<string, string | number | boolean | undefined>),
  get: (id: string) => api.get<AuditEngagementDetail>(`/audit/engagements/${id}`),
  /** POST /audit/engagements — create from plan item */
  createFromPlan: (dto: CreateEngagementFromPlanDto) =>
    api.post<AuditEngagement>('/audit/engagements', dto),
  /** POST /audit/engagements/adhoc — create ad-hoc engagement */
  createAdhoc: (dto: CreateAdhocEngagementDto) =>
    api.post<AuditEngagement>('/audit/engagements/adhoc', dto),
  /** PUT /audit/engagements/:id */
  update: (id: string, dto: UpdateEngagementDto) =>
    api.put<AuditEngagement>(`/audit/engagements/${id}`, dto),
  updateStatus: (id: string, status: string) =>
    api.patch<AuditEngagement>(`/audit/engagements/${id}/status`, { status }),
  /** GET /audit/engagements/eligible-users — permission-eligible, scored candidates for lead/manager */
  eligibleUsers: (q: { role: 'lead_auditor' | 'audit_manager'; auditType?: string; priority?: string }) =>
    api.get<EligibleUserDto[]>(
      `/audit/engagements/eligible-users`,
      q as Record<string, string | number | boolean | undefined>,
    ),
};

// ============================================================
// Working Papers
// ============================================================
export const workingPapersApi = {
  listByEngagement: (engagementId: string) =>
    api.get<AuditWorkingPaper[]>(
      `/audit/engagements/${engagementId}/working-papers`,
    ),
  get: (id: string) => api.get<AuditWorkingPaper>(`/audit/working-papers/${id}`),
  create: (
    engagementId: string,
    dto: {
      title: string;
      content: string;
      templateId?: string;
      sourceDocumentId?: string;
      workingPaperType?: string;
      importMetadata?: Record<string, unknown>;
    },
  ) =>
    api.post<AuditWorkingPaper>(
      `/audit/engagements/${engagementId}/working-papers`,
      dto,
    ),
  importPreview: (
    engagementId: string,
    file: File,
    dto?: { templateId?: string; workingPaperType?: string },
  ) => {
    const fd = new FormData();
    fd.append('file', file);
    if (dto?.templateId) fd.append('templateId', dto.templateId);
    if (dto?.workingPaperType) fd.append('workingPaperType', dto.workingPaperType);
    return api.upload<WorkingPaperImportPreview>(
      `/audit/engagements/${engagementId}/working-papers/import-preview`,
      fd,
    );
  },
  /** Fix 1: PATCH → PUT */
  update: (id: string, dto: { title?: string; content?: string }) =>
    api.put<AuditWorkingPaper>(`/audit/working-papers/${id}`, dto),
  submit: (id: string) =>
    api.post<AuditWorkingPaper>(`/audit/working-papers/${id}/submit`),
  approve: (id: string, comment?: string) =>
    api.post<AuditWorkingPaper>(`/audit/working-papers/${id}/approve`, { comment }),
  reject: (id: string, reason: string) =>
    api.post<AuditWorkingPaper>(`/audit/working-papers/${id}/reject`, { reason }),
  exportFile: async (
    id: string,
    format: 'pdf' | 'docx' = 'docx',
  ): Promise<{ blob: Blob; fileName: string }> => {
    const res = await fetch(`/api/proxy/audit/working-papers/${id}/export?format=${format}`, {
      credentials: 'include',
    });
    if (!res.ok) {
      let msg = `Export failed (${res.status})`;
      try {
        const body = (await res.json()) as { message?: string };
        if (body.message) msg = body.message;
      } catch { /* ignore */ }
      throw new Error(msg);
    }
    const blob = await res.blob();
    const disposition = res.headers.get('content-disposition') ?? '';
    const match = /filename[^;=\n]*=["']?([^"';\n]+)["']?/i.exec(disposition);
    const fileName =
      (match?.[1] ? decodeURIComponent(match[1].trim()) : null) ??
      `working-paper-${id}.${format}`;
    return { blob, fileName };
  },
};

// ============================================================
// Evidence
// ============================================================
export const evidenceApi = {
  listByEngagement: (engagementId: string) =>
    api.get<AuditEvidence[]>(`/audit/engagements/${engagementId}/evidence`),
  upload: (engagementId: string, file: File, description?: string, workingPaperId?: string, findingId?: string) => {
    const fd = new FormData();
    fd.append('file', file);
    if (description) fd.append('description', description);
    if (workingPaperId) fd.append('workingPaperId', workingPaperId);
    if (findingId) fd.append('findingId', findingId);
    return api.upload<AuditEvidence>(
      `/audit/engagements/${engagementId}/evidence`,
      fd,
    );
  },
  dispute: (id: string, reason: string) =>
    api.post(`/audit/evidence/${id}/dispute`, { reason }),
};

// ============================================================
// Findings
// ============================================================
export interface FindingsListQuery {
  page?: number;
  pageSize?: number;
  severity?: string;
  status?: string;
  category?: string;
  auditeeId?: string;
  search?: string;
}

export interface CreateFindingDto {
  title: string;
  description: string;
  category: string;
  severity: string;
  rootCause: string;
  riskImplication: string;
  recommendation: string;
  auditeeId: string;
  /** Co-responders who may also answer this finding alongside the primary auditee. */
  additionalAuditeeIds?: string[];
  dueDate: string;
  workingPaperId?: string;
}

export const findingsApi = {
  list: (q?: FindingsListQuery) =>
    api.getPaginated<AuditFinding>(
      '/audit/findings',
      q as Record<string, string | number | boolean | undefined>,
    ),
  get: (id: string) => api.get<AuditFinding>(`/audit/findings/${id}`),
  listByEngagement: (engagementId: string, q?: FindingsListQuery) =>
    api.get<AuditFinding[]>(
      `/audit/engagements/${engagementId}/findings`,
      q as Record<string, string | number | boolean | undefined>,
    ),
  create: (engagementId: string, dto: CreateFindingDto) =>
    api.post<AuditFinding>(`/audit/engagements/${engagementId}/findings`, dto),
  /** Fix 3: PATCH → PUT */
  update: (id: string, dto: Partial<CreateFindingDto>) =>
    api.put<AuditFinding>(`/audit/findings/${id}`, dto),
  updateStatus: (id: string, status: string) =>
    api.patch<AuditFinding>(`/audit/findings/${id}/status`, { status }),
  close: (id: string) =>
    api.post<AuditFinding>(`/audit/findings/${id}/close`),
  /** Fix 4: no DELETE /audit/findings — stub that throws */
  remove: (_id: string): Promise<void> => {
    throw new Error('Not supported: findings cannot be deleted via API');
  },
};

// ============================================================
// Checklists
// ============================================================
export const checklistsApi = {
  listByEngagement: (engagementId: string) =>
    api.get<Record<string, AuditChecklistItem[]>>(`/audit/engagements/${engagementId}/checklists`),
  update: (id: string, dto: { result: string; notes?: string | null }) =>
    api.patch<AuditChecklistItem>(`/audit/checklists/${id}`, dto),
  /** Link an already-uploaded evidence record to a checklist item. */
  linkEvidence: (checklistItemId: string, evidenceId: string) =>
    api.post<AuditChecklistItem>(`/audit/checklists/${checklistItemId}/evidence/${evidenceId}`),
  getTemplates: () => api.get<ChecklistTemplateConfig>('/audit/checklist-templates'),
  updateTemplates: (templates: ChecklistTemplateConfig) =>
    api.put<ChecklistTemplateConfig>('/audit/checklist-templates', { templates }),
  /** Controls that would populate an engagement of this audit type — pre-fills the wizard. */
  previewControls: (auditType: string) =>
    api.get<ChecklistTemplateControl[]>(`/audit/checklist-controls/${auditType}`),
};

// ============================================================
// Reports
// ============================================================
export interface ReportsListQuery {
  page?: number;
  pageSize?: number;
  status?: string;
  search?: string;
}

export interface CreateReportDto {
  title: string;
  executiveSummary?: string;
  scope?: string;
  methodology?: string;
  templateId?: string;
}

export const reportsApi = {
  list: (q?: ReportsListQuery) =>
    api.getPaginated<AuditReport>(
      '/audit/reports',
      q as Record<string, string | number | boolean | undefined>,
    ),
  get: (id: string) => api.get<AuditReport>(`/audit/reports/${id}`),
  getByEngagement: (engagementId: string) =>
    api.get<AuditReport>(`/audit/engagements/${engagementId}/report`),
  /** Fix 7: POST /audit/engagements/:id/report → POST /audit/engagements/:id/report/generate */
  generate: (engagementId: string, dto: CreateReportDto) =>
    api.post<AuditReport>(`/audit/engagements/${engagementId}/report/generate`, dto),
  /** Fix 8: PATCH → PUT */
  update: (id: string, dto: Partial<CreateReportDto>) =>
    api.put<AuditReport>(`/audit/reports/${id}`, dto),
  submit: (id: string) => api.post<AuditReport>(`/audit/reports/${id}/submit`),
  approve: (id: string, comment?: string) =>
    api.post<AuditReport>(`/audit/reports/${id}/approve`, { comment }),
  reject: (id: string, reason: string) =>
    api.post<AuditReport>(`/audit/reports/${id}/reject`, { reason }),
  issue: (id: string) => api.post<AuditReport>(`/audit/reports/${id}/issue`),
  exportFile: async (
    id: string,
    format: 'pdf' | 'docx',
    referenceNumber?: string,
  ): Promise<{ blob: Blob; fileName: string }> => {
    const res = await fetch(`/api/proxy/audit/reports/${id}/export?format=${format}`, {
      credentials: 'include',
    });
    if (!res.ok) {
      let msg = `Export failed (${res.status})`;
      try {
        const body = (await res.json()) as { message?: string };
        if (body.message) msg = body.message;
      } catch { /* ignore */ }
      throw new Error(msg);
    }
    const blob = await res.blob();
    const disposition = res.headers.get('content-disposition') ?? '';
    const match = /filename[^;=\n]*=["']?([^"';\n]+)["']?/i.exec(disposition);
    const fileName =
      match?.[1]?.trim() ??
      `GBB-IAR-${referenceNumber ?? 'RPT'}-${new Date().toISOString().slice(0, 10)}.${format}`;
    return { blob, fileName };
  },
};

// ============================================================
// Follow-up
// ============================================================
export const followUpApi = {
  /** Fix 9: follow-up → followup */
  getByFinding: (findingId: string) =>
    api.get<AuditFollowUp>(`/audit/findings/${findingId}/followup`),
  /** Fix 10: follow-up → followup */
  submitResponse: (
    findingId: string,
    dto: { managementResponse: string },
  ) =>
    api.post<AuditFollowUp>(
      `/audit/findings/${findingId}/followup/response`,
      dto,
    ),
  /** Fix 11: follow-up → followup */
  submitEvidence: (findingId: string, evidenceId: string) =>
    api.post<AuditFollowUp>(
      `/audit/findings/${findingId}/followup/evidence`,
      { evidenceId },
    ),
  uploadEvidence: (findingId: string, file: File) => {
    const fd = new FormData();
    fd.append('file', file);
    return api.upload<AuditFollowUp>(
      `/audit/findings/${findingId}/followup/evidence/upload`,
      fd,
    );
  },
  verify: (
    findingId: string,
    dto: { verificationStatus: 'verified' | 'rejected'; verificationNotes?: string },
  ) =>
    api.post<AuditFollowUp>(
      `/audit/findings/${findingId}/followup/verify`,
      dto,
    ),
};

// ============================================================
// Compliance frameworks & controls
// ============================================================
export interface ComplianceFramework {
  id: string;
  code: string;
  name: string;
  description: string | null;
  category: string;
  isActive: boolean;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface ComplianceControl {
  id: string;
  frameworkId: string;
  frameworkCode: string | null;
  frameworkName: string | null;
  controlReference: string;
  controlDescription: string;
  testProcedure: string;
  auditType: string;
  isActive: boolean;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface FrameworkCoverage {
  id: string;
  code: string;
  name: string;
  category: string;
  isActive: boolean;
  totalControls: number;
  activeControls: number;
  byAuditType: Record<string, number>;
}

export interface ComplianceCoverage {
  frameworks: FrameworkCoverage[];
  totalFrameworks: number;
  totalControls: number;
  activeControls: number;
}

export interface ControlsListQuery {
  page?: number;
  pageSize?: number;
  search?: string;
  frameworkId?: string;
  auditType?: string;
  isActive?: boolean;
}

export interface CreateFrameworkDto {
  code: string;
  name: string;
  description?: string;
  category: string;
  isActive?: boolean;
}

export interface CreateControlDto {
  frameworkId: string;
  controlReference: string;
  controlDescription: string;
  testProcedure: string;
  auditType: string;
  isActive?: boolean;
}

export interface FrameworkTestedCoverage {
  id: string;
  code: string;
  name: string;
  category: string;
  totalControls: number;
  testedControls: number;
  coveragePct: number;
  passed: number;
  failed: number;
  notApplicable: number;
  passRatePct: number;
}

export interface TestedCoverage {
  frameworks: FrameworkTestedCoverage[];
  totalControls: number;
  testedControls: number;
  coveragePct: number;
  passed: number;
  failed: number;
  notApplicable: number;
}

export interface ControlRisk {
  riskId: string;
  title: string;
  currentScore: number;
  status: string;
  category: string | null;
}

export interface RiskCoverageItem {
  id: string;
  title: string;
  currentScore: number;
  status: string;
  category: string | null;
  mappedControls: number;
  testedControls: number;
}

export interface RiskCoverage {
  risks: RiskCoverageItem[];
  totalRisks: number;
  coveredRisks: number;
  uncoveredRisks: number;
}

export const complianceApi = {
  coverage: () => api.get<ComplianceCoverage>('/audit/compliance/coverage'),
  testedCoverage: () => api.get<TestedCoverage>('/audit/compliance/tested-coverage'),
  riskCoverage: () => api.get<RiskCoverage>('/audit/compliance/risk-coverage'),
  listControlRisks: (controlId: string) =>
    api.get<ControlRisk[]>(`/audit/compliance/controls/${controlId}/risks`),
  linkRisk: (controlId: string, riskId: string) =>
    api.post<ControlRisk[]>(`/audit/compliance/controls/${controlId}/risks`, { riskId }),
  unlinkRisk: (controlId: string, riskId: string) =>
    api.delete(`/audit/compliance/controls/${controlId}/risks/${riskId}`),
  listFrameworks: () => api.get<ComplianceFramework[]>('/audit/compliance/frameworks'),
  createFramework: (dto: CreateFrameworkDto) =>
    api.post<ComplianceFramework>('/audit/compliance/frameworks', dto),
  updateFramework: (id: string, dto: Partial<CreateFrameworkDto>) =>
    api.put<ComplianceFramework>(`/audit/compliance/frameworks/${id}`, dto),
  listControls: (q?: ControlsListQuery) =>
    api.getPaginated<ComplianceControl>(
      '/audit/compliance/controls',
      q as Record<string, string | number | boolean | undefined>,
    ),
  createControl: (dto: CreateControlDto) =>
    api.post<ComplianceControl>('/audit/compliance/controls', dto),
  updateControl: (id: string, dto: Partial<CreateControlDto>) =>
    api.put<ComplianceControl>(`/audit/compliance/controls/${id}`, dto),
  deleteControl: (id: string) => api.delete(`/audit/compliance/controls/${id}`),
};
