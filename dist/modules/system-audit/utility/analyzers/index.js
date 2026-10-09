"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.IAMS_SOD_RULES = exports.DEFAULT_SOD_RULES = exports.ANALYZERS = void 0;
const system_audit_enum_1 = require("../../domain/enum/system-audit.enum");
const access_listing_analyzer_1 = require("./access-listing.analyzer");
const change_log_analyzer_1 = require("./change-log.analyzer");
const backup_log_analyzer_1 = require("./backup-log.analyzer");
const incident_log_analyzer_1 = require("./incident-log.analyzer");
const security_event_log_analyzer_1 = require("./security-event-log.analyzer");
const configuration_analyzer_1 = require("./configuration.analyzer");
const vulnerability_scan_analyzer_1 = require("./vulnerability-scan.analyzer");
const data_integrity_analyzer_1 = require("./data-integrity.analyzer");
// Each definition is typed with its own parameter shape; the registry erases
// that to `unknown` because parameters are validated by the definition's own
// schema at run time before `analyse` sees them.
exports.ANALYZERS = {
    [system_audit_enum_1.AnalysisType.AccessListing]: access_listing_analyzer_1.accessListingAnalyzer,
    [system_audit_enum_1.AnalysisType.ChangeLog]: change_log_analyzer_1.changeLogAnalyzer,
    [system_audit_enum_1.AnalysisType.BackupLog]: backup_log_analyzer_1.backupLogAnalyzer,
    [system_audit_enum_1.AnalysisType.IncidentLog]: incident_log_analyzer_1.incidentLogAnalyzer,
    [system_audit_enum_1.AnalysisType.SecurityEventLog]: security_event_log_analyzer_1.securityEventLogAnalyzer,
    [system_audit_enum_1.AnalysisType.Configuration]: configuration_analyzer_1.configurationAnalyzer,
    [system_audit_enum_1.AnalysisType.VulnerabilityScan]: vulnerability_scan_analyzer_1.vulnerabilityScanAnalyzer,
    [system_audit_enum_1.AnalysisType.DataIntegrity]: data_integrity_analyzer_1.dataIntegrityAnalyzer,
};
var access_listing_analyzer_2 = require("./access-listing.analyzer");
Object.defineProperty(exports, "DEFAULT_SOD_RULES", { enumerable: true, get: function () { return access_listing_analyzer_2.DEFAULT_SOD_RULES; } });
Object.defineProperty(exports, "IAMS_SOD_RULES", { enumerable: true, get: function () { return access_listing_analyzer_2.IAMS_SOD_RULES; } });
//# sourceMappingURL=index.js.map