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
  AuditReport,
  AuditFollowUp,
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
    api.patch<AuditUniverseEntity>(`/audit/universe/${id}`, dto),
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
}

export interface AddPlanItemDto {
  universeId: string;
  auditType: string;
  priority: string;
  plannedStartDate: string;
  plannedEndDate: string;
}

export const plansApi = {
  list: (q?: PlansListQuery) =>
    api.getPaginated<AuditPlan>('/audit/plans', q as Record<string, string | number | boolean | undefined>),
  get: (id: string) => api.get<AuditPlan>(`/audit/plans/${id}`),
  create: (dto: CreatePlanDto) => api.post<AuditPlan>('/audit/plans', dto),
  update: (id: string, dto: Partial<CreatePlanDto>) =>
    api.patch<AuditPlan>(`/audit/plans/${id}`, dto),
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
  exportDocx: (id: string) =>
    api.get<{ buffer: string; fileName: string }>(`/audit/working-papers/${id}/export`),
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
  dueDate: string;
  workingPaperId?: string;
}

export const findingsApi = {
  /** Fix 2: no GET /audit/findings — use GET /audit/engagements/:id/findings */
  list: (engagementId: string, q?: FindingsListQuery) =>
    api.get<AuditFinding[]>(
      `/audit/engagements/${engagementId}/findings`,
      q as Record<string, string | number | boolean | undefined>,
    ),
  get: (id: string) => api.get<AuditFinding>(`/audit/findings/${id}`),
  listByEngagement: (engagementId: string) =>
    api.get<AuditFinding[]>(`/audit/engagements/${engagementId}/findings`),
  create: (engagementId: string, dto: CreateFindingDto) =>
    api.post<AuditFinding>(`/audit/engagements/${engagementId}/findings`, dto),
  /** Fix 3: PATCH → PUT */
  update: (id: string, dto: Partial<CreateFindingDto>) =>
    api.put<AuditFinding>(`/audit/findings/${id}`, dto),
  updateStatus: (id: string, status: string) =>
    api.patch<AuditFinding>(`/audit/findings/${id}/status`, { status }),
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
};

// ============================================================
// Reports
// ============================================================
export interface ReportsListQuery {
  page?: number;
  pageSize?: number;
  status?: string;
}

export interface CreateReportDto {
  title: string;
  executiveSummary?: string;
  scope?: string;
  methodology?: string;
}

export const reportsApi = {
  /** Fix 5: no GET /audit/reports — stub that throws */
  list: (_q?: ReportsListQuery): Promise<{ items: AuditReport[]; meta: { page: number; pageSize: number; total: number; totalPages: number; hasNext: boolean; hasPrev: boolean } }> => {
    throw new Error('Not supported: no GET /audit/reports route. Use getByEngagement instead.');
  },
  /** Fix 6: no GET /audit/reports/:id — stub that throws */
  get: (_id: string): Promise<AuditReport> => {
    throw new Error('Not supported: no GET /audit/reports/:id route. Use getByEngagement instead.');
  },
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
    dto: { managementResponse: string; remediationEvidenceId?: string },
  ) =>
    api.post<AuditFollowUp>(
      `/audit/findings/${findingId}/followup/response`,
      dto,
    ),
  /** Fix 11: follow-up → followup */
  verify: (
    findingId: string,
    dto: { verificationStatus: 'verified' | 'rejected'; verificationNotes?: string },
  ) =>
    api.post<AuditFollowUp>(
      `/audit/findings/${findingId}/followup/verify`,
      dto,
    ),
};
