import { SecurityTestWithRelations } from '../../../../../shared/prisma/prisma.types';
import { SeverityCounts } from '../../../analytics/dto/response/analytics.response.dto';
import { UserRef, toUserRef } from '../../../utility/system-audit.utility';

export interface SecurityTestResultsDto {
  scanRuns: number;
  /** Vulnerabilities by severity from the most recent linked scan import. */
  latestScan: SeverityCounts | null;
  openExceptions: number;
  findingsRaised: number;
}

export interface SecurityTestResponseDto {
  id: string;
  reference: string;
  title: string;
  testType: string;
  status: string;
  engagement: { id: string; referenceNumber: string; title: string } | null;
  provider: string;
  providerType: string;
  scope: string;
  rulesOfEngagement: string | null;
  plannedStart: string;
  plannedEnd: string;
  actualStart: string | null;
  actualEnd: string | null;
  coordinator: UserRef | null;
  authorisedBy: UserRef | null;
  authorisedAt: string | null;
  report: { documentId: string; fileName: string; fileSize: number; uploadedAt: string } | null;
  notes: string | null;
  assets: Array<{ id: string; assetTag: string; name: string; assetType: string; criticality: string }>;
  createdBy: UserRef | null;
  createdAt: string;
  updatedAt: string;
  /** Status moves the current state allows (authorisation is its own action). */
  allowedTransitions: string[];
  results: SecurityTestResultsDto;
}

export interface SecurityTestDetailResponseDto extends SecurityTestResponseDto {
  scanRuns: Array<{
    id: string;
    reference: string;
    title: string;
    createdAt: string;
    exceptionCount: number;
    summary: Record<string, unknown>;
  }>;
}

export const mapSecurityTestToResponse = (
  test: SecurityTestWithRelations,
  allowedTransitions: string[],
  results: SecurityTestResultsDto,
): SecurityTestResponseDto => ({
  id: test.id,
  reference: test.reference,
  title: test.title,
  testType: test.test_type,
  status: test.status,
  engagement: test.engagement
    ? { id: test.engagement.id, referenceNumber: test.engagement.reference_number, title: test.engagement.title }
    : null,
  provider: test.provider,
  providerType: test.provider_type,
  scope: test.scope,
  rulesOfEngagement: test.rules_of_engagement,
  plannedStart: test.planned_start.toISOString(),
  plannedEnd: test.planned_end.toISOString(),
  actualStart: test.actual_start?.toISOString() ?? null,
  actualEnd: test.actual_end?.toISOString() ?? null,
  coordinator: toUserRef(test.coordinator),
  authorisedBy: toUserRef(test.authorised_by),
  authorisedAt: test.authorised_at?.toISOString() ?? null,
  report: test.report_document
    ? {
        documentId: test.report_document.id,
        fileName: test.report_document.original_name,
        fileSize: test.report_document.file_size,
        uploadedAt: test.report_document.created_at.toISOString(),
      }
    : null,
  notes: test.notes,
  assets: test.assets.map((a) => ({
    id: a.asset.id,
    assetTag: a.asset.asset_tag,
    name: a.asset.name,
    assetType: a.asset.asset_type,
    criticality: a.asset.criticality,
  })),
  createdBy: toUserRef(test.created_by),
  createdAt: test.created_at.toISOString(),
  updatedAt: test.updated_at.toISOString(),
  allowedTransitions,
  results,
});
