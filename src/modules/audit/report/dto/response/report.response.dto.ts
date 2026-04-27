import { FindingResponseDto, mapFindingToResponse } from '../../../findings/dto/response/finding.response.dto';

export interface ReportResponseDto {
  id: string;
  engagementId: string;
  title: string;
  executiveSummary: string;
  scope: string;
  methodology: string;
  status: string;
  versionNumber: number;
  documentId: string | null;
  issuedAt: string | null;
  createdById: string;
  createdAt: string;
  updatedAt: string;
  findings?: FindingResponseDto[];
}

export const mapReportToResponse = (
  report: {
    id: string;
    engagement_id: string;
    title: string;
    executive_summary: string;
    scope: string;
    methodology: string;
    status: string;
    version_number: number;
    document_id: string | null;
    issued_at: Date | null;
    created_by_id: string;
    created_at: Date;
    updated_at: Date;
    engagement?: {
      findings: Array<Parameters<typeof mapFindingToResponse>[0]>;
    };
  },
): ReportResponseDto => ({
  id: report.id,
  engagementId: report.engagement_id,
  title: report.title,
  executiveSummary: report.executive_summary,
  scope: report.scope,
  methodology: report.methodology,
  status: report.status,
  versionNumber: report.version_number,
  documentId: report.document_id,
  issuedAt: report.issued_at?.toISOString() ?? null,
  createdById: report.created_by_id,
  createdAt: report.created_at.toISOString(),
  updatedAt: report.updated_at.toISOString(),
  findings: report.engagement?.findings.map(mapFindingToResponse),
});
