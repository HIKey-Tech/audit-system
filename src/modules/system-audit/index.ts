import { Router } from 'express';
import { DocumentService } from '../document/service/implementation/document.service';
import { UserService } from '../user/service/implementation/user.service';
import { auditLogService } from '../logging/service/implementation/audit-log.service';
import { systemLogService } from '../logging/service/implementation/system-log.service';
import { EvidenceService } from '../audit/evidence/service/implementation/evidence.service';
import { EngagementService } from '../audit/engagement/service/implementation/engagement.service';
import { ChecklistService } from '../audit/checklists/service/implementation/checklist.service';
import { FindingService } from '../audit/findings/service/implementation/finding.service';
import { UniverseService } from '../audit/universe/service/implementation/universe.service';
import { RiskRegisterService } from '../risk/register/service/implementation/register.service';
import { RiskMonitoringService } from '../risk/monitoring/service/implementation/monitoring.service';
import { assetService } from '../asset/service/implementation/asset.service';
import { workflowAssignmentService } from '../workflow/assignment/service/implementation/assignment.service';
import { ImocTicketService } from '../integration/imoc/service/implementation/imoc-ticket.service';
import { createImocClient } from '../integration/imoc/service/client/imoc.client';
import { directoryMappingService } from '../integration/service/implementation/directory-mapping.service';
import { systemConfigService } from '../settings/service/implementation/system-config.service';
import { notificationQueueService } from '../messaging/service/implementation/notification-queue.service';
import { LiveSourceService } from './analytics/service/implementation/live-source.service';
import { SystemAuditAnalyticsService } from './analytics/service/implementation/analytics.service';
import { SystemAuditAnalyticsController } from './analytics/controller/analytics.controller';
import { AccessReviewService } from './access-review/service/implementation/access-review.service';
import { AccessReviewController } from './access-review/controller/access-review.controller';
import { ContinuousMonitoringService } from './monitoring/service/implementation/monitoring.service';
import { ContinuousMonitoringController } from './monitoring/controller/monitoring.controller';
import { SecurityTestService } from './security-testing/service/implementation/security-test.service';
import { SecurityTestController } from './security-testing/controller/security-test.controller';
import { SystemDocumentationService } from './documentation/service/implementation/documentation.service';
import { SystemDocumentationController } from './documentation/controller/documentation.controller';

// System audit toolkit — read-only analytics over GBB system data, user access
// reviews, continuous monitoring, security-test coordination, and the system
// documentation library. Other modules are reached only through their services.
const documentService = new DocumentService();
const userService = new UserService();
const evidenceService = new EvidenceService(documentService);
const engagementService = new EngagementService(new ChecklistService(), userService, workflowAssignmentService);

export const systemAuditAnalyticsService = new SystemAuditAnalyticsService(
  new LiveSourceService(
    userService,
    auditLogService,
    new ImocTicketService(createImocClient(), evidenceService),
    directoryMappingService,
  ),
  userService,
  evidenceService,
  documentService,
  engagementService,
  new FindingService(),
);

export const continuousMonitoringService = new ContinuousMonitoringService(
  systemAuditAnalyticsService,
  userService,
  auditLogService,
  systemLogService,
  new RiskMonitoringService(),
  systemConfigService,
  notificationQueueService,
);

const accessReviewService = new AccessReviewService(systemAuditAnalyticsService);
const securityTestService = new SecurityTestService(userService, documentService, engagementService, assetService);
const documentationService = new SystemDocumentationService(
  documentService,
  userService,
  new UniverseService(new RiskRegisterService()),
  assetService,
  engagementService,
);

export const createSystemAuditModule = (): Router => {
  const router = Router();
  router.use('/system-audit/analytics', new SystemAuditAnalyticsController(systemAuditAnalyticsService).router);
  router.use('/system-audit/access-reviews', new AccessReviewController(accessReviewService).router);
  router.use('/system-audit/monitoring', new ContinuousMonitoringController(continuousMonitoringService).router);
  router.use('/system-audit/security-tests', new SecurityTestController(securityTestService).router);
  router.use('/system-audit/documentation', new SystemDocumentationController(documentationService).router);
  return router;
};

export type { ISystemAuditAnalyticsService } from './analytics/service/interface/analytics.service.interface';
export type { IContinuousMonitoringService } from './monitoring/service/interface/monitoring.service.interface';
