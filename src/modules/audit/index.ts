import { Router } from 'express';
import { DocumentService } from '../document';
import { UserService } from '../user';
import { RiskRegisterService } from '../risk/register/service/implementation/register.service';
import { reportTemplateService } from '../settings/service/implementation/report-template.service';
import { workingPaperTemplateService } from '../settings/service/implementation/working-paper-template.service';
import { systemConfigService } from '../settings/service/implementation/system-config.service';
import { workflowApprovalService } from '../workflow/approval/service/implementation/approval.service';
import { workflowAssignmentService } from '../workflow/assignment/service/implementation/assignment.service';
import { UniverseService } from './universe/service/implementation/universe.service';
import { PlanningService } from './planning/service/implementation/planning.service';
import { ChecklistService } from './checklists/service/implementation/checklist.service';
import { EngagementService } from './engagement/service/implementation/engagement.service';
import { WorkingPaperService } from './working-papers/service/implementation/working-paper.service';
import { EvidenceService } from './evidence/service/implementation/evidence.service';
import { FindingService } from './findings/service/implementation/finding.service';
import { FollowUpService } from './follow-up/service/implementation/follow-up.service';
import { ReportService } from './report/service/implementation/report.service';
import { ReportGenerationService } from './report/service/implementation/report-generation.service';
import { RepositoryService } from './repository/service/implementation/repository.service';
import { UniverseController } from './universe/controller/universe.controller';
import { PlanningController } from './planning/controller/planning.controller';
import { EngagementController } from './engagement/controller/engagement.controller';
import { WorkingPaperController } from './working-papers/controller/working-paper.controller';
import { EvidenceController } from './evidence/controller/evidence.controller';
import { FindingController } from './findings/controller/finding.controller';
import { FollowUpController } from './follow-up/controller/follow-up.controller';
import { ReportController } from './report/controller/report.controller';
import { ChecklistController } from './checklists/controller/checklist.controller';
import { RepositoryController } from './repository/controller/repository.controller';
import { ComplianceService } from './compliance/service/implementation/compliance.service';
import { ComplianceController } from './compliance/controller/compliance.controller';

export const createAuditModule = (): Router => {
  const router = Router();

  const documentService = new DocumentService();
  const userService = new UserService();
  const riskRegisterService = new RiskRegisterService();
  const universeService = new UniverseService(riskRegisterService);
  const planningService = new PlanningService();
  const checklistService = new ChecklistService();
  const engagementService = new EngagementService(checklistService, userService, workflowAssignmentService);
  const workingPaperService = new WorkingPaperService(documentService, workingPaperTemplateService);
  const evidenceService = new EvidenceService(documentService);
  const findingService = new FindingService();
  const followUpService = new FollowUpService(documentService);
  const reportGenerationService = new ReportGenerationService(
    reportTemplateService,
    systemConfigService,
    workflowApprovalService,
    documentService,
  );
  const reportService = new ReportService(followUpService, documentService, reportGenerationService, reportTemplateService);
  const repositoryService = new RepositoryService(documentService);

  const universeController = new UniverseController(universeService);
  const planningController = new PlanningController(planningService);
  const engagementController = new EngagementController(engagementService);
  const workingPaperController = new WorkingPaperController(workingPaperService);
  const evidenceController = new EvidenceController(evidenceService);
  const findingController = new FindingController(findingService);
  const followUpController = new FollowUpController(followUpService);
  const reportController = new ReportController(reportService);
  const checklistController = new ChecklistController(checklistService);
  const repositoryController = new RepositoryController(repositoryService);
  const complianceController = new ComplianceController(new ComplianceService());

  router.use('/audit/universe', universeController.router);
  router.use('/audit/plans', planningController.router);
  router.use('/audit/engagements', engagementController.router);
  router.use('/audit', workingPaperController.router);
  router.use('/audit', evidenceController.router);
  router.use('/audit', findingController.router);
  router.use('/audit', reportController.router);
  router.use('/audit', followUpController.router);
  router.use('/audit', checklistController.router);
  router.use('/audit', repositoryController.router);
  router.use('/audit', complianceController.router);

  return router;
};

export { UniverseService } from './universe/service/implementation/universe.service';
export { PlanningService } from './planning/service/implementation/planning.service';
export { EngagementService } from './engagement/service/implementation/engagement.service';
export { WorkingPaperService } from './working-papers/service/implementation/working-paper.service';
export { EvidenceService } from './evidence/service/implementation/evidence.service';
export { FindingService } from './findings/service/implementation/finding.service';
export { ReportService } from './report/service/implementation/report.service';
export { FollowUpService } from './follow-up/service/implementation/follow-up.service';
export { ChecklistService } from './checklists/service/implementation/checklist.service';
