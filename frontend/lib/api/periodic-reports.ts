import { api } from '../api-client';

export type PeriodType = 'monthly' | 'quarterly' | 'yearly' | 'custom';

export interface PeriodicReportQuery {
  periodType?: PeriodType;
  year?: number;
  month?: number;
  quarter?: number;
  startDate?: string;
  endDate?: string;
  auditType?: string;
}

export interface PeriodicReportSummary {
  totalProgrammes: number;
  approvedProgrammes: number;
  pendingProgrammes: number;
  rejectedProgrammes: number;
  totalEngagements: number;
  engagementsStartedInPeriod: number;
  engagementsClosedInPeriod: number;
  engagementsOverdue: number;
  engagementsByStatus: {
    planned: number;
    in_progress: number;
    under_review: number;
    reported: number;
    closed: number;
  };
  engagementsByType: Record<string, number>;
  reportsIssuedInPeriod: number;
  reportsPublished: number;
  reportsDraft: number;
  reportsSubmitted: number;
  reportsApproved: number;
  reportsRejected: number;
  approvalsTotalInPeriod: number;
  approvalsPending: number;
  approvalsApproved: number;
  approvalsRejected: number;
  approvalsEscalated: number;
  findingsRaisedInPeriod: number;
  findingsClosedInPeriod: number;
  findingsOpenTotal: number;
  findingsBySeverity: {
    critical: number;
    high: number;
    medium: number;
    low: number;
    informational: number;
  };
}

export interface PeriodicReportProgramme {
  id: string;
  title: string;
  year: number;
  auditType: string;
  status: string;
  itemsCount: number;
  engagementsCreatedCount: number;
  approvedByName: string | null;
  approvedAt: string | null;
  rejectionReason: string | null;
  createdAt: string;
}

export interface PeriodicReportEngagement {
  id: string;
  referenceNumber: string;
  title: string;
  universeName: string;
  auditType: string;
  priority: string;
  status: string;
  leadAuditorName: string;
  auditManagerName: string;
  auditeeName: string;
  teamMembers: string[];
  plannedStartDate: string;
  plannedEndDate: string;
  actualStartDate: string | null;
  actualEndDate: string | null;
  olaDeadline: string;
  isOverdue: boolean;
  findingsCount: number;
  checklistCompletionPct: number;
}

export interface PeriodicReportItem {
  id: string;
  title: string;
  engagementId: string;
  engagementReference: string;
  engagementTitle: string;
  auditType: string;
  status: string;
  versionNumber: number;
  createdByName: string;
  issuedAt: string | null;
  rejectionReason: string | null;
  findingsCount: number;
  createdAt: string;
}

export interface PeriodicReportApproval {
  id: string;
  entityType: string;
  entityId: string;
  entityReference: string;
  status: string;
  submittedByName: string;
  currentLevel: number;
  totalLevels: number;
  lastActedByName: string | null;
  lastComment: string | null;
  createdAt: string;
  completedAt: string | null;
  isEscalated?: boolean;
  escalationLevel?: number;
}

export interface PeriodicReportFinding {
  id: string;
  title: string;
  engagementId: string;
  engagementReference: string;
  engagementTitle: string;
  severity: string;
  category: string;
  status: string;
  auditeeName: string;
  dueDate: string;
  hasManagementResponse: boolean;
  closedAt: string | null;
  createdAt: string;
}

export interface PeriodicReportData {
  periodType: PeriodType;
  periodStart: string;
  periodEnd: string;
  periodLabel: string;
  auditTypeFilter: string | null;
  generatedAt: string;
  generatedBy: string;
  summary: PeriodicReportSummary;
  programmes: PeriodicReportProgramme[];
  engagements: PeriodicReportEngagement[];
  reports: PeriodicReportItem[];
  approvals: PeriodicReportApproval[];
  findings: PeriodicReportFinding[];
}

export const periodicReportsApi = {
  get: (params?: PeriodicReportQuery) =>
    api.get<PeriodicReportData>(
      '/audit/periodic-reports',
      params as Record<string, string | number | boolean | undefined>,
    ),

  exportFile: async (
    params: PeriodicReportQuery,
    format: 'docx' | 'pdf',
  ): Promise<{ blob: Blob; fileName: string }> => {
    const search = new URLSearchParams();
    for (const [k, v] of Object.entries({ ...params, format })) {
      if (v !== undefined && v !== null && v !== '') {
        search.append(k, String(v));
      }
    }
    const res = await fetch(`/api/proxy/audit/periodic-reports/export?${search.toString()}`, {
      credentials: 'include',
    });
    if (!res.ok) {
      let msg = `Export failed (${res.status})`;
      try {
        const body = (await res.json()) as { message?: string };
        if (body.message) msg = body.message;
      } catch {
        // ignore JSON parse failure on binary/error body
      }
      throw new Error(msg);
    }
    const blob = await res.blob();
    const disposition = res.headers.get('content-disposition') ?? '';
    const match = /filename[^;=\n]*=["']?([^"';\n]+)["']?/i.exec(disposition);
    const decoded = match?.[1] ? decodeURIComponent(match[1].trim()) : null;
    const fileName =
      decoded ||
      `GBB-Periodic-Audit-Report-${new Date().toISOString().slice(0, 10)}.${format}`;
    return { blob, fileName };
  },
};
