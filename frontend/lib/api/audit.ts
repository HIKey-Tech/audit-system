import { api } from '../api-client';
import type {
  AuditUniverseEntity,
  AuditUniverseDetail,
  AuditPlan,
  AuditPlanItem,
  AuditEngagement,
  AuditEngagementDetail,
  AuditWorkingPaper,
  AuditEvidence,
  AuditFinding,
  AuditChecklistItem,
  AuditReport,
  AuditFollowUp,
  AuditAssignment,
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
  status?: string;
}

export interface UpdateUniverseEntityDto extends Partial<CreateUniverseEntityDto> {}

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
  description?: string;
}

export interface AddPlanItemDto {
  universeId: string;
  auditType: string;
  priority: string;
  plannedStartDate: string;
  plannedEndDate: string;
  notes?: string;
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
  createEngagement: (planId: string, itemId: string, dto: CreateEngagementDto) =>
    api.post<AuditEngagement>(`/audit/plans/${planId}/items/${itemId}/engagement`, dto),
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

export interface CreateEngagementDto {
  title: string;
  description?: string;
  auditType?: string;
  priority?: string;
  leadAuditorId: string;
  auditManagerId?: string;
  auditeeId: string;
  startDate: string;
  endDate: string;
  slaDeadline: string;
  isAdHoc?: boolean;
  adHocReason?: string;
  universeId?: string;
  planItemId?: string;
}

export const engagementsApi = {
  list: (q?: EngagementsListQuery) =>
    api.getPaginated<AuditEngagement>('/audit/engagements', q as Record<string, string | number | boolean | undefined>),
  get: (id: string) => api.get<AuditEngagementDetail>(`/audit/engagements/${id}`),
  create: (dto: CreateEngagementDto) =>
    api.post<AuditEngagement>('/audit/engagements', dto),
  update: (id: string, dto: Partial<CreateEngagementDto>) =>
    api.patch<AuditEngagement>(`/audit/engagements/${id}`, dto),
  updateStatus: (id: string, status: string) =>
    api.patch<AuditEngagement>(`/audit/engagements/${id}/status`, { status }),
  remove: (id: string) => api.delete(`/audit/engagements/${id}`),
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
    dto: { title: string; content?: string },
  ) =>
    api.post<AuditWorkingPaper>(
      `/audit/engagements/${engagementId}/working-papers`,
      dto,
    ),
  update: (id: string, dto: { title?: string; content?: string }) =>
    api.patch<AuditWorkingPaper>(`/audit/working-papers/${id}`, dto),
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
  engagementId?: string;
  search?: string;
}

export interface CreateFindingDto {
  title: string;
  description: string;
  category: string;
  severity: string;
  rootCause?: string;
  riskImplication?: string;
  recommendation?: string;
  auditeeId: string;
  dueDate: string;
}

export const findingsApi = {
  list: (q?: FindingsListQuery) =>
    api.getPaginated<AuditFinding>('/audit/findings', q as Record<string, string | number | boolean | undefined>),
  get: (id: string) => api.get<AuditFinding>(`/audit/findings/${id}`),
  listByEngagement: (engagementId: string) =>
    api.get<AuditFinding[]>(`/audit/engagements/${engagementId}/findings`),
  create: (engagementId: string, dto: CreateFindingDto) =>
    api.post<AuditFinding>(`/audit/engagements/${engagementId}/findings`, dto),
  update: (id: string, dto: Partial<CreateFindingDto>) =>
    api.patch<AuditFinding>(`/audit/findings/${id}`, dto),
  updateStatus: (id: string, status: string) =>
    api.patch<AuditFinding>(`/audit/findings/${id}/status`, { status }),
  remove: (id: string) => api.delete(`/audit/findings/${id}`),
};

// ============================================================
// Checklists
// ============================================================
export const checklistsApi = {
  listByEngagement: (engagementId: string) =>
    api.get<AuditChecklistItem[]>(`/audit/engagements/${engagementId}/checklists`),
  update: (id: string, dto: { result?: string; notes?: string; evidenceId?: string }) =>
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
  list: (q?: ReportsListQuery) =>
    api.getPaginated<AuditReport>('/audit/reports', q as Record<string, string | number | boolean | undefined>),
  get: (id: string) => api.get<AuditReport>(`/audit/reports/${id}`),
  getByEngagement: (engagementId: string) =>
    api.get<AuditReport>(`/audit/engagements/${engagementId}/report`),
  generate: (engagementId: string, dto: CreateReportDto) =>
    api.post<AuditReport>(`/audit/engagements/${engagementId}/report`, dto),
  update: (id: string, dto: Partial<CreateReportDto>) =>
    api.patch<AuditReport>(`/audit/reports/${id}`, dto),
  submit: (id: string) => api.post<AuditReport>(`/audit/reports/${id}/submit`),
  approve: (id: string, comment?: string) =>
    api.post<AuditReport>(`/audit/reports/${id}/approve`, { comment }),
  reject: (id: string, reason: string) =>
    api.post<AuditReport>(`/audit/reports/${id}/reject`, { reason }),
  issue: (id: string) => api.post<AuditReport>(`/audit/reports/${id}/issue`),
  exportDocx: (id: string) =>
    api.get<{ buffer: string; fileName: string }>(`/audit/reports/${id}/export`),
};

// ============================================================
// Follow-up
// ============================================================
export const followUpApi = {
  getByFinding: (findingId: string) =>
    api.get<AuditFollowUp>(`/audit/findings/${findingId}/follow-up`),
  submitResponse: (
    findingId: string,
    dto: { managementResponse: string; remediationEvidenceId?: string },
  ) =>
    api.post<AuditFollowUp>(
      `/audit/findings/${findingId}/follow-up/response`,
      dto,
    ),
  verify: (
    findingId: string,
    dto: { verificationStatus: 'verified' | 'rejected'; verificationNotes?: string },
  ) =>
    api.post<AuditFollowUp>(
      `/audit/findings/${findingId}/follow-up/verify`,
      dto,
    ),
};

export const auditAssignmentsApi = {
  listByEngagement: (engagementId: string) =>
    api.get<AuditAssignment[]>(`/audit/engagements/${engagementId}/assignments`),
};
