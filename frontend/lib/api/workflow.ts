import { api } from '../api-client';
import type {
  WorkflowApproval,
  WorkflowAssignment,
  WorkflowEscalation,
  EscalationPolicy,
  AssignmentCandidateDto,
  WorkflowRequest,
  RequestAttachment,
  RequestCandidate,
  SignatureVerification,
  SignedDocument,
  SignedApprovalDocument,
  RequestStatus,
  ResolvedApprovalChain,
} from '../types/domain';
import type { PaginatedResult } from '../types/api';

type WorkflowAssignmentRole = 'lead_auditor' | 'supporting_auditor';

export const workflowApi = {
  // approvals
  listPending: () => api.get<WorkflowApproval[]>('/workflow/approvals/pending'),
  listHistory: () => api.get<WorkflowApproval[]>('/workflow/approvals/history'),
  getApproval: (id: string) => api.get<WorkflowApproval>(`/workflow/approvals/${id}`),
  getApprovalByEntity: (entityType: string, entityId: string) =>
    api.get<WorkflowApproval>(
      `/workflow/approvals/entity/${entityType}/${entityId}`,
    ),
  getApprovalChain: (entityType: string, entityId: string) =>
    api.get<ResolvedApprovalChain>(
      `/workflow/approvals/chain/${entityType}/${entityId}`,
    ),
  // `edits` is honored server-side only for audit report approvals — lets the
  // approver fix a small issue themselves instead of rejecting and forcing a
  // full resubmission back through level 1.
  approve: (
    id: string,
    comment?: string,
    edits?: { executiveSummary?: string; scope?: string; methodology?: string },
  ) => api.post<WorkflowApproval>(`/workflow/approvals/${id}/approve`, { comment, edits }),
  reject: (id: string, reason: string) =>
    api.post<WorkflowApproval>(`/workflow/approvals/${id}/reject`, { reason }),
  cancel: (id: string) => api.post(`/workflow/approvals/${id}/cancel`),

  // assignments
  createAssignment: (dto: { engagementId: string; userId: string; role: WorkflowAssignmentRole }) =>
    api.post<WorkflowAssignment>('/workflow/assignments', dto),
  listMine: () => api.get<WorkflowAssignment[]>('/workflow/assignments/mine'),
  listByEngagement: (engagementId: string) =>
    api.get<WorkflowAssignment[]>(
      `/workflow/assignments/engagement/${engagementId}`,
    ),
  workload: (userId: string) =>
    api.get<unknown>(`/workflow/assignments/workload/${userId}`),
  removeAssignment: (id: string) => api.delete(`/workflow/assignments/${id}`),
  getCandidates: (engagementId: string) =>
    api.get<AssignmentCandidateDto[]>(
      `/workflow/assignments/candidates/${engagementId}`,
    ),

  // approval signed documents (frozen on completion)
  signedApprovalDocuments: (approvalId: string) =>
    api.get<SignedApprovalDocument[]>(`/workflow/approvals/${approvalId}/signed-documents`),

  // escalations
  listByEntity: (entityType: string, entityId: string) =>
    api.get<WorkflowEscalation[]>(
      `/workflow/escalations/entity/${entityType}/${entityId}`,
    ),
  acknowledge: (id: string) =>
    api.post<WorkflowEscalation>(`/workflow/escalations/${id}/acknowledge`),

  // escalation policies
  listPolicies: () => api.get<EscalationPolicy[]>('/workflow/escalation-policy'),
  upsertPolicy: (dto: {
    auditType: string;
    level1Hours: number;
    level2Hours: number;
    level3Hours: number;
    level4Hours: number;
  }) => api.post<EscalationPolicy>('/workflow/escalation-policy', dto),
};

// ── Ad-hoc requests ──────────────────────────────────────────
export const requestsApi = {
  list: (query?: { status?: RequestStatus; role?: 'initiated' | 'received'; page?: number; pageSize?: number }) =>
    api.getPaginated<WorkflowRequest>('/workflow/requests', query),
  inbox: (query?: { page?: number; pageSize?: number }) =>
    api.getPaginated<WorkflowRequest>('/workflow/requests/inbox', query),
  candidates: () => api.get<RequestCandidate[]>('/workflow/requests/candidates'),
  get: (id: string) => api.get<WorkflowRequest>(`/workflow/requests/${id}`),
  create: (dto: { title: string; description?: string; recipientIds: string[] }) =>
    api.post<WorkflowRequest>('/workflow/requests', dto),
  addAttachment: (id: string, file: File) => {
    const fd = new FormData();
    fd.append('file', file);
    return api.upload<RequestAttachment>(`/workflow/requests/${id}/attachments`, fd);
  },
  approve: (id: string, comment?: string) =>
    api.post<WorkflowRequest>(`/workflow/requests/${id}/approve`, { comment }),
  sign: (id: string, affirmation: string, comment?: string) =>
    api.post<WorkflowRequest>(`/workflow/requests/${id}/sign`, { affirmation, comment }),
  reject: (id: string, reason: string) =>
    api.post<WorkflowRequest>(`/workflow/requests/${id}/reject`, { reason }),
  comment: (id: string, comment: string) =>
    api.post<WorkflowRequest>(`/workflow/requests/${id}/comment`, { comment }),
  cancel: (id: string) => api.post<WorkflowRequest>(`/workflow/requests/${id}/cancel`),
  verifySignatures: (id: string) =>
    api.get<SignatureVerification[]>(`/workflow/requests/${id}/verify-signatures`),
  signedDocuments: (id: string) =>
    api.get<SignedDocument[]>(`/workflow/requests/${id}/signed-documents`),
};

export type RequestListResult = PaginatedResult<WorkflowRequest>;
