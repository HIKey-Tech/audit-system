"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createSystemAuditModule = exports.continuousMonitoringService = exports.systemAuditAnalyticsService = void 0;
const express_1 = require("express");
const document_service_1 = require("../document/service/implementation/document.service");
const user_service_1 = require("../user/service/implementation/user.service");
const audit_log_service_1 = require("../logging/service/implementation/audit-log.service");
const system_log_service_1 = require("../logging/service/implementation/system-log.service");
const evidence_service_1 = require("../audit/evidence/service/implementation/evidence.service");
const engagement_service_1 = require("../audit/engagement/service/implementation/engagement.service");
const checklist_service_1 = require("../audit/checklists/service/implementation/checklist.service");
const finding_service_1 = require("../audit/findings/service/implementation/finding.service");
const universe_service_1 = require("../audit/universe/service/implementation/universe.service");
const register_service_1 = require("../risk/register/service/implementation/register.service");
const monitoring_service_1 = require("../risk/monitoring/service/implementation/monitoring.service");
const asset_service_1 = require("../asset/service/implementation/asset.service");
const assignment_service_1 = require("../workflow/assignment/service/implementation/assignment.service");
const imoc_ticket_service_1 = require("../integration/imoc/service/implementation/imoc-ticket.service");
const imoc_client_1 = require("../integration/imoc/service/client/imoc.client");
const directory_mapping_service_1 = require("../integration/service/implementation/directory-mapping.service");
const system_config_service_1 = require("../settings/service/implementation/system-config.service");
const notification_queue_service_1 = require("../messaging/service/implementation/notification-queue.service");
const live_source_service_1 = require("./analytics/service/implementation/live-source.service");
const analytics_service_1 = require("./analytics/service/implementation/analytics.service");
const analytics_controller_1 = require("./analytics/controller/analytics.controller");
const access_review_service_1 = require("./access-review/service/implementation/access-review.service");
const access_review_controller_1 = require("./access-review/controller/access-review.controller");
const monitoring_service_2 = require("./monitoring/service/implementation/monitoring.service");
const monitoring_controller_1 = require("./monitoring/controller/monitoring.controller");
const security_test_service_1 = require("./security-testing/service/implementation/security-test.service");
const security_test_controller_1 = require("./security-testing/controller/security-test.controller");
const documentation_service_1 = require("./documentation/service/implementation/documentation.service");
const documentation_controller_1 = require("./documentation/controller/documentation.controller");
// System audit toolkit — read-only analytics over GBB system data, user access
// reviews, continuous monitoring, security-test coordination, and the system
// documentation library. Other modules are reached only through their services.
const documentService = new document_service_1.DocumentService();
const userService = new user_service_1.UserService();
const evidenceService = new evidence_service_1.EvidenceService(documentService);
const engagementService = new engagement_service_1.EngagementService(new checklist_service_1.ChecklistService(), userService, assignment_service_1.workflowAssignmentService);
exports.systemAuditAnalyticsService = new analytics_service_1.SystemAuditAnalyticsService(new live_source_service_1.LiveSourceService(userService, audit_log_service_1.auditLogService, new imoc_ticket_service_1.ImocTicketService((0, imoc_client_1.createImocClient)(), evidenceService), directory_mapping_service_1.directoryMappingService), userService, evidenceService, documentService, engagementService, new finding_service_1.FindingService());
exports.continuousMonitoringService = new monitoring_service_2.ContinuousMonitoringService(exports.systemAuditAnalyticsService, userService, audit_log_service_1.auditLogService, system_log_service_1.systemLogService, new monitoring_service_1.RiskMonitoringService(), system_config_service_1.systemConfigService, notification_queue_service_1.notificationQueueService);
const accessReviewService = new access_review_service_1.AccessReviewService(exports.systemAuditAnalyticsService);
const securityTestService = new security_test_service_1.SecurityTestService(userService, documentService, engagementService, asset_service_1.assetService);
const documentationService = new documentation_service_1.SystemDocumentationService(documentService, userService, new universe_service_1.UniverseService(new register_service_1.RiskRegisterService()), asset_service_1.assetService, engagementService);
const createSystemAuditModule = () => {
    const router = (0, express_1.Router)();
    router.use('/system-audit/analytics', new analytics_controller_1.SystemAuditAnalyticsController(exports.systemAuditAnalyticsService).router);
    router.use('/system-audit/access-reviews', new access_review_controller_1.AccessReviewController(accessReviewService).router);
    router.use('/system-audit/monitoring', new monitoring_controller_1.ContinuousMonitoringController(exports.continuousMonitoringService).router);
    router.use('/system-audit/security-tests', new security_test_controller_1.SecurityTestController(securityTestService).router);
    router.use('/system-audit/documentation', new documentation_controller_1.SystemDocumentationController(documentationService).router);
    return router;
};
exports.createSystemAuditModule = createSystemAuditModule;
//# sourceMappingURL=index.js.map