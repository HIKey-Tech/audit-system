import { api } from '../api-client';
import type {
  AuditSummary,
  FindingsSummary,
  RiskOverview,
  RecentActivityItem,
  EscalationOverview,
  MyWork,
  ApprovalInboxSummary,
  AuditAnalytics,
  RiskMatrix,
} from '../types/domain';

export const dashboardApi = {
  getSummary: () => api.get<AuditSummary>('/dashboard/summary'),
  getFindings: () => api.get<FindingsSummary>('/dashboard/findings'),
  getRisks: () => api.get<RiskOverview>('/dashboard/risks'),
  getRiskMatrix: () => api.get<RiskMatrix>('/dashboard/risk-matrix'),
  getActivity: (limit = 20) =>
    api.get<RecentActivityItem[]>('/dashboard/activity', { limit }),
  getEscalations: () => api.get<EscalationOverview>('/dashboard/escalations'),
  getMyWork: () => api.get<MyWork>('/dashboard/my-work'),
  getApprovalInbox: () => api.get<ApprovalInboxSummary>('/dashboard/approval-inbox'),
  getAnalytics: () => api.get<AuditAnalytics>('/dashboard/analytics'),
};
