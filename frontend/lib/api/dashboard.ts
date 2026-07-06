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
  downloadCommitteePack: async (): Promise<{ blob: Blob; fileName: string }> => {
    const res = await fetch('/api/proxy/dashboard/committee-pack/export', {
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
      (match?.[1] ? decodeURIComponent(match[1].trim()) : null) ?? 'committee-pack.pdf';
    return { blob, fileName };
  },
};
