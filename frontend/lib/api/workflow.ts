import { api } from '../api-client';
import type {
  WorkflowApproval,
  WorkflowAssignment,
  WorkflowEscalation,
  EscalationPolicy,
  AssignmentCandidateDto,
} from '../types/domain';

type WorkflowAssignmentRole = 'lead_auditor' | 'supporting_auditor';

export const workflowApi = {
  // approvals
  listPending: () => api.get<WorkflowApproval[]>('/workflow/approvals/pending'),
  getApproval: (id: string) => api.get<WorkflowApproval>(`/workflow/approvals/${id}`),
  getApprovalByEntity: (entityType: string, entityId: string) =>
    api.get<WorkflowApproval>(
      `/workflow/approvals/entity/${entityType}/${entityId}`,
    ),
  approve: (id: string, comment?: string) =>
    api.post<WorkflowApproval>(`/workflow/approvals/${id}/approve`, { comment }),
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
