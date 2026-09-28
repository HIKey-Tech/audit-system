"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ChecklistResult = exports.VerificationStatus = exports.ReportStatus = exports.FindingStatus = exports.FindingSeverity = exports.SELECTABLE_FINDING_CATEGORIES = exports.FindingCategory = exports.WorkingPaperStatus = exports.EngagementStatus = exports.PlanStatus = exports.UniverseStatus = exports.UniverseCategory = exports.AuditFrequency = exports.AuditPriority = exports.SELECTABLE_AUDIT_TYPES = exports.AuditType = void 0;
var AuditType;
(function (AuditType) {
    AuditType["It"] = "it";
    AuditType["Financial"] = "financial";
    AuditType["Compliance"] = "compliance";
    /** @deprecated Merged into `It` as the System/IT domain. Kept so records
     *  created before the merge still resolve; never offer it as a choice. */
    AuditType["Systems"] = "systems";
})(AuditType || (exports.AuditType = AuditType = {}));
/** The audit types a user may actually pick. Request DTOs validate against this
 *  rather than the enum, so the retired `systems` value can never enter on a
 *  new record while existing rows still read correctly. */
exports.SELECTABLE_AUDIT_TYPES = [
    AuditType.It,
    AuditType.Financial,
    AuditType.Compliance,
];
var AuditPriority;
(function (AuditPriority) {
    AuditPriority["Critical"] = "critical";
    AuditPriority["High"] = "high";
    AuditPriority["Medium"] = "medium";
    AuditPriority["Low"] = "low";
})(AuditPriority || (exports.AuditPriority = AuditPriority = {}));
var AuditFrequency;
(function (AuditFrequency) {
    AuditFrequency["Annual"] = "annual";
    AuditFrequency["Biannual"] = "biannual";
    AuditFrequency["Quarterly"] = "quarterly";
    AuditFrequency["Monthly"] = "monthly";
})(AuditFrequency || (exports.AuditFrequency = AuditFrequency = {}));
var UniverseCategory;
(function (UniverseCategory) {
    UniverseCategory["Department"] = "department";
    UniverseCategory["System"] = "system";
    UniverseCategory["Process"] = "process";
    UniverseCategory["Asset"] = "asset";
    UniverseCategory["Project"] = "project";
})(UniverseCategory || (exports.UniverseCategory = UniverseCategory = {}));
var UniverseStatus;
(function (UniverseStatus) {
    UniverseStatus["Active"] = "active";
    UniverseStatus["Inactive"] = "inactive";
})(UniverseStatus || (exports.UniverseStatus = UniverseStatus = {}));
var PlanStatus;
(function (PlanStatus) {
    PlanStatus["Draft"] = "draft";
    PlanStatus["Submitted"] = "submitted";
    PlanStatus["Approved"] = "approved";
    PlanStatus["Rejected"] = "rejected";
})(PlanStatus || (exports.PlanStatus = PlanStatus = {}));
var EngagementStatus;
(function (EngagementStatus) {
    EngagementStatus["Planned"] = "planned";
    EngagementStatus["InProgress"] = "in_progress";
    EngagementStatus["UnderReview"] = "under_review";
    EngagementStatus["Reported"] = "reported";
    EngagementStatus["Closed"] = "closed";
})(EngagementStatus || (exports.EngagementStatus = EngagementStatus = {}));
var WorkingPaperStatus;
(function (WorkingPaperStatus) {
    WorkingPaperStatus["Draft"] = "draft";
    WorkingPaperStatus["Submitted"] = "submitted";
    WorkingPaperStatus["Approved"] = "approved";
    WorkingPaperStatus["Rejected"] = "rejected";
})(WorkingPaperStatus || (exports.WorkingPaperStatus = WorkingPaperStatus = {}));
var FindingCategory;
(function (FindingCategory) {
    FindingCategory["It"] = "it";
    FindingCategory["Financial"] = "financial";
    FindingCategory["Compliance"] = "compliance";
    /** @deprecated Merged into `It`. See AuditType.Systems. */
    FindingCategory["Systems"] = "systems";
    FindingCategory["Operational"] = "operational";
})(FindingCategory || (exports.FindingCategory = FindingCategory = {}));
/** Finding categories a user may pick — `systems` is retired, see AuditType. */
exports.SELECTABLE_FINDING_CATEGORIES = [
    FindingCategory.It,
    FindingCategory.Financial,
    FindingCategory.Compliance,
    FindingCategory.Operational,
];
var FindingSeverity;
(function (FindingSeverity) {
    FindingSeverity["Critical"] = "critical";
    FindingSeverity["High"] = "high";
    FindingSeverity["Medium"] = "medium";
    FindingSeverity["Low"] = "low";
    FindingSeverity["Informational"] = "informational";
})(FindingSeverity || (exports.FindingSeverity = FindingSeverity = {}));
var FindingStatus;
(function (FindingStatus) {
    FindingStatus["Open"] = "open";
    FindingStatus["ManagementResponseReceived"] = "management_response_received";
    FindingStatus["InRemediation"] = "in_remediation";
    FindingStatus["Verified"] = "verified";
    FindingStatus["PendingClosure"] = "pending_closure";
    FindingStatus["Closed"] = "closed";
})(FindingStatus || (exports.FindingStatus = FindingStatus = {}));
var ReportStatus;
(function (ReportStatus) {
    ReportStatus["Draft"] = "draft";
    ReportStatus["Submitted"] = "submitted";
    ReportStatus["Approved"] = "approved";
    ReportStatus["Rejected"] = "rejected";
    ReportStatus["Issued"] = "issued";
})(ReportStatus || (exports.ReportStatus = ReportStatus = {}));
var VerificationStatus;
(function (VerificationStatus) {
    VerificationStatus["Pending"] = "pending";
    VerificationStatus["Verified"] = "verified";
    VerificationStatus["Rejected"] = "rejected";
})(VerificationStatus || (exports.VerificationStatus = VerificationStatus = {}));
var ChecklistResult;
(function (ChecklistResult) {
    ChecklistResult["Passed"] = "passed";
    ChecklistResult["Failed"] = "failed";
    ChecklistResult["NotApplicable"] = "not_applicable";
    ChecklistResult["NotTested"] = "not_tested";
})(ChecklistResult || (exports.ChecklistResult = ChecklistResult = {}));
//# sourceMappingURL=audit.enum.js.map