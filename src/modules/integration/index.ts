import { Router } from 'express';
import { DirectoryMappingController } from './controller/directory-mapping.controller';
import { directoryMappingService } from './service/implementation/directory-mapping.service';
import { ImocTicketController } from './imoc/controller/imoc-ticket.controller';
import { ImocTicketService } from './imoc/service/implementation/imoc-ticket.service';
import { createImocClient } from './imoc/service/client/imoc.client';
import { EvidenceService } from '../audit/evidence/service/implementation/evidence.service';
import { EngagementService } from '../audit/engagement/service/implementation/engagement.service';
import { ChecklistService } from '../audit/checklists/service/implementation/checklist.service';
import { DocumentService } from '../document/service/implementation/document.service';
import { UserService } from '../user/service/implementation/user.service';
import { workflowAssignmentService } from '../workflow/assignment/service/implementation/assignment.service';

export const createIntegrationModule = (): Router => {
  const router = Router();
  const controller = new DirectoryMappingController(directoryMappingService);
  const documentService = new DocumentService();
  const evidenceService = new EvidenceService(documentService);
  const engagementService = new EngagementService(
    new ChecklistService(),
    new UserService(),
    workflowAssignmentService,
  );
  const imocController = new ImocTicketController(
    new ImocTicketService(createImocClient(), evidenceService),
    engagementService,
  );
  router.use('/integration/directory', controller.router);
  router.use('/integration/imoc', imocController.router);
  return router;
};

export {
  DirectoryMappingService,
  directoryMappingService,
} from './service/implementation/directory-mapping.service';
export type { IDirectoryMappingService } from './service/interface/directory.service.interface';
export { ImocTicketService } from './imoc/service/implementation/imoc-ticket.service';
export type { IImocTicketService } from './imoc/service/interface/imoc-ticket.service.interface';
