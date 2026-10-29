import { z } from 'zod';
export declare const PeriodicReportQuerySchema: z.ZodObject<{
    periodType: z.ZodDefault<z.ZodEnum<["monthly", "quarterly", "yearly", "custom"]>>;
    year: z.ZodDefault<z.ZodNumber>;
    month: z.ZodOptional<z.ZodNumber>;
    quarter: z.ZodOptional<z.ZodNumber>;
    startDate: z.ZodOptional<z.ZodString>;
    endDate: z.ZodOptional<z.ZodString>;
    auditType: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    year: number;
    periodType: "custom" | "quarterly" | "monthly" | "yearly";
    auditType?: string | undefined;
    month?: number | undefined;
    quarter?: number | undefined;
    startDate?: string | undefined;
    endDate?: string | undefined;
}, {
    year?: number | undefined;
    auditType?: string | undefined;
    month?: number | undefined;
    periodType?: "custom" | "quarterly" | "monthly" | "yearly" | undefined;
    quarter?: number | undefined;
    startDate?: string | undefined;
    endDate?: string | undefined;
}>;
export declare const ExportPeriodicReportQuerySchema: z.ZodObject<{
    periodType: z.ZodDefault<z.ZodEnum<["monthly", "quarterly", "yearly", "custom"]>>;
    year: z.ZodDefault<z.ZodNumber>;
    month: z.ZodOptional<z.ZodNumber>;
    quarter: z.ZodOptional<z.ZodNumber>;
    startDate: z.ZodOptional<z.ZodString>;
    endDate: z.ZodOptional<z.ZodString>;
    auditType: z.ZodOptional<z.ZodString>;
} & {
    format: z.ZodDefault<z.ZodEnum<["docx", "pdf"]>>;
}, "strip", z.ZodTypeAny, {
    format: "docx" | "pdf";
    year: number;
    periodType: "custom" | "quarterly" | "monthly" | "yearly";
    auditType?: string | undefined;
    month?: number | undefined;
    quarter?: number | undefined;
    startDate?: string | undefined;
    endDate?: string | undefined;
}, {
    format?: "docx" | "pdf" | undefined;
    year?: number | undefined;
    auditType?: string | undefined;
    month?: number | undefined;
    periodType?: "custom" | "quarterly" | "monthly" | "yearly" | undefined;
    quarter?: number | undefined;
    startDate?: string | undefined;
    endDate?: string | undefined;
}>;
export type PeriodicReportQueryDto = z.infer<typeof PeriodicReportQuerySchema>;
export type ExportPeriodicReportQueryDto = z.infer<typeof ExportPeriodicReportQuerySchema>;
export interface PeriodicReportSummaryDto {
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
export interface PeriodicReportProgrammeDto {
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
export interface PeriodicReportEngagementDto {
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
export interface PeriodicReportItemDto {
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
export interface PeriodicReportApprovalDto {
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
export interface PeriodicReportFindingDto {
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
export interface PeriodicReportResponseDto {
    periodType: 'monthly' | 'quarterly' | 'yearly' | 'custom';
    periodStart: string;
    periodEnd: string;
    periodLabel: string;
    auditTypeFilter: string | null;
    generatedAt: string;
    generatedBy: string;
    summary: PeriodicReportSummaryDto;
    programmes: PeriodicReportProgrammeDto[];
    engagements: PeriodicReportEngagementDto[];
    reports: PeriodicReportItemDto[];
    approvals: PeriodicReportApprovalDto[];
    findings: PeriodicReportFindingDto[];
}
//# sourceMappingURL=periodic-report.dto.d.ts.map