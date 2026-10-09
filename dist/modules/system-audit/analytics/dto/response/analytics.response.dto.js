"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.mapExceptionToResponse = exports.mapRunToResponse = exports.emptySeverityCounts = void 0;
const system_audit_utility_1 = require("../../../utility/system-audit.utility");
const emptySeverityCounts = () => ({ critical: 0, high: 0, medium: 0, low: 0 });
exports.emptySeverityCounts = emptySeverityCounts;
const mapRunToResponse = (run, analysisLabel, counts) => ({
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
    reviewedBy: (0, system_audit_utility_1.toUserRef)(run.reviewed_by),
    reviewedAt: run.reviewed_at?.toISOString() ?? null,
    isBaseline: run.is_baseline,
    baselineRunId: run.baseline_run_id,
    createdBy: (0, system_audit_utility_1.toUserRef)(run.created_by),
    createdAt: run.created_at.toISOString(),
    summary: (0, system_audit_utility_1.parseJson)(run.summary, {}),
});
exports.mapRunToResponse = mapRunToResponse;
const mapExceptionToResponse = (exception, ruleLabel) => ({
    id: exception.id,
    runId: exception.run_id,
    ruleCode: exception.rule_code,
    ruleLabel,
    severity: exception.severity,
    title: exception.title,
    recordRef: exception.record_ref,
    details: (0, system_audit_utility_1.parseJson)(exception.details, {}),
    disposition: exception.disposition,
    dispositionNote: exception.disposition_note,
    disposedBy: (0, system_audit_utility_1.toUserRef)(exception.disposed_by),
    disposedAt: exception.disposed_at?.toISOString() ?? null,
    finding: exception.finding ? { id: exception.finding.id, title: exception.finding.title, status: exception.finding.status } : null,
    createdAt: exception.created_at.toISOString(),
});
exports.mapExceptionToResponse = mapExceptionToResponse;
//# sourceMappingURL=analytics.response.dto.js.map