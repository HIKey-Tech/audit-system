import {
  SystemAuditExceptionWithRelations,
  SystemAuditRunWithRelations,
} from '../../../../../shared/prisma/prisma.types';
import { AnalysisField, AnalysisRule } from '../../../domain/entity/system-audit.entity';
import { AnalysisSource } from '../../../domain/enum/system-audit.enum';
import { UserRef, parseJson, toUserRef } from '../../../utility/system-audit.utility';

export interface AnalysisTypeResponseDto {
  type: string;
  label: string;
  description: string;
  controls: string[];
  fields: AnalysisField[];
  rules: AnalysisRule[];
  defaultParameters: unknown;
  /** Read-only sources this analysis can run against besides an uploaded export. */
  liveSources: AnalysisSource[];
}

export interface ExtractPreviewResponseDto {
  analysisType: string;
  fileName: string;
  rowCount: number;
  headers: string[];
  sampleRows: Array<Record<string, unknown>>;
  suggestedMapping: Record<string, string | null>;
  missingRequired: Array<{ key: string; label: string }>;
}

export interface SeverityCounts {
  critical: number;
  high: number;
  medium: number;
  low: number;
}

export interface DispositionCounts {
  open: number;
  confirmed: number;
  false_positive: number;
  explained: number;
}

export interface RunResponseDto {
  id: string;
  reference: string;
  title: string;
  analysisType: string;
  analysisLabel: string;
  source: string;
  systemName: string;
  trigger: string;
  engagement: { id: string; referenceNumber: string; title: string } | null;
  securityTest: { id: string; reference: string; title: string } | null;
  fileName: string | null;
  contentSha256: string | null;
  recordCount: number;
  exceptionCount: number;
  severityCounts: SeverityCounts;
  openExceptions: number;
  reviewStatus: string;
  reviewNote: string | null;
  reviewedBy: UserRef | null;
  reviewedAt: string | null;
  isBaseline: boolean;
  baselineRunId: string | null;
  createdBy: UserRef | null;
  createdAt: string;
  summary: Record<string, unknown>;
}

export interface RunDetailResponseDto extends RunResponseDto {
  parameters: Record<string, unknown>;
  controls: string[];
  dispositionCounts: DispositionCounts;
  ruleCounts: Array<{ ruleCode: string; label: string; count: number }>;
  accessReview: { total: number; pending: number; appropriate: number; revoke: number; modify: number } | null;
  hasExtract: boolean;
}

export interface ExceptionResponseDto {
  id: string;
  runId: string;
  ruleCode: string;
  ruleLabel: string;
  severity: string;
  title: string;
  recordRef: string | null;
  details: Record<string, unknown>;
  disposition: string;
  dispositionNote: string | null;
  disposedBy: UserRef | null;
  disposedAt: string | null;
  finding: { id: string; title: string; status: string } | null;
  createdAt: string;
}

export const emptySeverityCounts = (): SeverityCounts => ({ critical: 0, high: 0, medium: 0, low: 0 });

export const mapRunToResponse = (
  run: SystemAuditRunWithRelations,
  analysisLabel: string,
  counts: { severity: SeverityCounts; open: number },
): RunResponseDto => ({
  id: run.id,
  reference: run.reference,
  title: run.title,
  analysisType: run.analysis_type,
  analysisLabel,
  source: run.source,
  systemName: run.system_name,
  trigger: run.trigger,
  engagement: run.engagement
    ? { id: run.engagement.id, referenceNumber: run.engagement.reference_number, title: run.engagement.title }
    : null,
  securityTest: run.security_test
    ? { id: run.security_test.id, reference: run.security_test.reference, title: run.security_test.title }
    : null,
  fileName: run.file_name,
  contentSha256: run.content_sha256,
  recordCount: run.record_count,
  exceptionCount: run.exception_count,
  severityCounts: counts.severity,
  openExceptions: counts.open,
  reviewStatus: run.review_status,
  reviewNote: run.review_note,
  reviewedBy: toUserRef(run.reviewed_by),
  reviewedAt: run.reviewed_at?.toISOString() ?? null,
  isBaseline: run.is_baseline,
  baselineRunId: run.baseline_run_id,
  createdBy: toUserRef(run.created_by),
  createdAt: run.created_at.toISOString(),
  summary: parseJson<Record<string, unknown>>(run.summary, {}),
});

export const mapExceptionToResponse = (
  exception: SystemAuditExceptionWithRelations,
  ruleLabel: string,
): ExceptionResponseDto => ({
  id: exception.id,
  runId: exception.run_id,
  ruleCode: exception.rule_code,
  ruleLabel,
  severity: exception.severity,
  title: exception.title,
  recordRef: exception.record_ref,
  details: parseJson<Record<string, unknown>>(exception.details, {}),
  disposition: exception.disposition,
  dispositionNote: exception.disposition_note,
  disposedBy: toUserRef(exception.disposed_by),
  disposedAt: exception.disposed_at?.toISOString() ?? null,
  finding: exception.finding ? { id: exception.finding.id, title: exception.finding.title, status: exception.finding.status } : null,
  createdAt: exception.created_at.toISOString(),
});
