"use strict";
// SQL Server has no native enums; these mirror the string columns documented
// in the SYSTEM AUDIT TOOLKIT block of prisma/schema.prisma.
Object.defineProperty(exports, "__esModule", { value: true });
exports.SystemDocumentStatus = exports.SystemDocumentType = exports.SecurityTestProviderType = exports.SecurityTestStatus = exports.SecurityTestType = exports.AccessDecision = exports.ExceptionDisposition = exports.ExceptionSeverity = exports.RunReviewStatus = exports.RunTrigger = exports.AnalysisSource = exports.AnalysisType = void 0;
var AnalysisType;
(function (AnalysisType) {
    AnalysisType["AccessListing"] = "access_listing";
    AnalysisType["ChangeLog"] = "change_log";
    AnalysisType["BackupLog"] = "backup_log";
    AnalysisType["IncidentLog"] = "incident_log";
    AnalysisType["SecurityEventLog"] = "security_event_log";
    AnalysisType["Configuration"] = "configuration";
    AnalysisType["VulnerabilityScan"] = "vulnerability_scan";
    AnalysisType["DataIntegrity"] = "data_integrity";
})(AnalysisType || (exports.AnalysisType = AnalysisType = {}));
/** Where a run's records came from. Every source is read-only. */
var AnalysisSource;
(function (AnalysisSource) {
    AnalysisSource["Upload"] = "upload";
    AnalysisSource["Iams"] = "iams";
    AnalysisSource["EntraId"] = "entra_id";
    AnalysisSource["Imoc"] = "imoc";
})(AnalysisSource || (exports.AnalysisSource = AnalysisSource = {}));
var RunTrigger;
(function (RunTrigger) {
    RunTrigger["Manual"] = "manual";
    RunTrigger["Scheduled"] = "scheduled";
})(RunTrigger || (exports.RunTrigger = RunTrigger = {}));
var RunReviewStatus;
(function (RunReviewStatus) {
    RunReviewStatus["Open"] = "open";
    RunReviewStatus["Completed"] = "completed";
})(RunReviewStatus || (exports.RunReviewStatus = RunReviewStatus = {}));
var ExceptionSeverity;
(function (ExceptionSeverity) {
    ExceptionSeverity["Critical"] = "critical";
    ExceptionSeverity["High"] = "high";
    ExceptionSeverity["Medium"] = "medium";
    ExceptionSeverity["Low"] = "low";
})(ExceptionSeverity || (exports.ExceptionSeverity = ExceptionSeverity = {}));
var ExceptionDisposition;
(function (ExceptionDisposition) {
    ExceptionDisposition["Open"] = "open";
    ExceptionDisposition["Confirmed"] = "confirmed";
    ExceptionDisposition["FalsePositive"] = "false_positive";
    ExceptionDisposition["Explained"] = "explained";
})(ExceptionDisposition || (exports.ExceptionDisposition = ExceptionDisposition = {}));
var AccessDecision;
(function (AccessDecision) {
    AccessDecision["Pending"] = "pending";
    AccessDecision["Appropriate"] = "appropriate";
    AccessDecision["Revoke"] = "revoke";
    AccessDecision["Modify"] = "modify";
})(AccessDecision || (exports.AccessDecision = AccessDecision = {}));
var SecurityTestType;
(function (SecurityTestType) {
    SecurityTestType["VulnerabilityScan"] = "vulnerability_scan";
    SecurityTestType["PenetrationTest"] = "penetration_test";
    SecurityTestType["WebApplicationTest"] = "web_application_test";
    SecurityTestType["RedTeam"] = "red_team";
    SecurityTestType["SocialEngineering"] = "social_engineering";
})(SecurityTestType || (exports.SecurityTestType = SecurityTestType = {}));
var SecurityTestStatus;
(function (SecurityTestStatus) {
    SecurityTestStatus["Planned"] = "planned";
    SecurityTestStatus["Authorised"] = "authorised";
    SecurityTestStatus["InProgress"] = "in_progress";
    SecurityTestStatus["Reporting"] = "reporting";
    SecurityTestStatus["Remediation"] = "remediation";
    SecurityTestStatus["Closed"] = "closed";
    SecurityTestStatus["Cancelled"] = "cancelled";
})(SecurityTestStatus || (exports.SecurityTestStatus = SecurityTestStatus = {}));
var SecurityTestProviderType;
(function (SecurityTestProviderType) {
    SecurityTestProviderType["Internal"] = "internal";
    SecurityTestProviderType["External"] = "external";
})(SecurityTestProviderType || (exports.SecurityTestProviderType = SecurityTestProviderType = {}));
var SystemDocumentType;
(function (SystemDocumentType) {
    SystemDocumentType["Policy"] = "policy";
    SystemDocumentType["Procedure"] = "procedure";
    SystemDocumentType["Standard"] = "standard";
    SystemDocumentType["ArchitectureDiagram"] = "architecture_diagram";
    SystemDocumentType["NetworkDiagram"] = "network_diagram";
    SystemDocumentType["ProcessManual"] = "process_manual";
    SystemDocumentType["BusinessContinuityPlan"] = "bcp";
    SystemDocumentType["DisasterRecoveryPlan"] = "drp";
    SystemDocumentType["IncidentResponsePlan"] = "incident_response_plan";
    SystemDocumentType["Contract"] = "contract";
    SystemDocumentType["ServiceLevelAgreement"] = "sla";
    SystemDocumentType["Other"] = "other";
})(SystemDocumentType || (exports.SystemDocumentType = SystemDocumentType = {}));
var SystemDocumentStatus;
(function (SystemDocumentStatus) {
    SystemDocumentStatus["Active"] = "active";
    SystemDocumentStatus["Archived"] = "archived";
})(SystemDocumentStatus || (exports.SystemDocumentStatus = SystemDocumentStatus = {}));
//# sourceMappingURL=system-audit.enum.js.map