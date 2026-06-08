import { FindingResponseDto, mapFindingToResponse } from '../../../findings/dto/response/finding.response.dto';

export interface ReportResponseDto {
  id: string;
  engagementId: string;
  engagementReference?: string;
  title: string;
  executiveSummary: string;
  scope: string;
  methodology: string;
  status: string;
  version: number;
  versionNumber: number;
  documentId: string | null;
  templateId: string | null;
  issuedAt: string | null;
  rejectionReason: string | null;
  createdById: string;
  createdAt: string;
  updatedAt: string;
  findings?: FindingResponseDto[];
}

export const mapReportToResponse = (
  report: {
    id: string;
    engagement_id: string;
    engagement?: {
      reference_number?: string;
      findings: Array<Parameters<typeof mapFindingToResponse>[0]>;
    };
    title: string;
    executive_summary: string;
    scope: string;
    methodology: string;
    status: string;
    version_number: number;
    document_id: string | null;
    template_id: string | null;
    issued_at: Date | null;
    rejection_reason: string | null;
    created_by_id: string;
    created_at: Date;
    updated_at: Date;
  },
): ReportResponseDto => ({
  id: report.id,
  engagementId: report.engagement_id,
  engagementReference: report.engagement?.reference_number,
  title: report.title,
  executiveSummary: report.executive_summary,
  scope: report.scope,
  methodology: report.methodology,
  status: report.status,
  version: report.version_number,
  versionNumber: report.version_number,
  documentId: report.document_id,
  templateId: report.template_id ?? null,
  issuedAt: report.issued_at?.toISOString() ?? null,
  rejectionReason: report.rejection_reason,
  createdById: report.created_by_id,
  createdAt: report.created_at.toISOString(),
  updatedAt: report.updated_at.toISOString(),
  findings: report.engagement?.findings.map(mapFindingToResponse),
});
