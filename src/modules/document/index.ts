// src/modules/document/index.ts
import { Router } from 'express';
import { DocumentService } from './service/implementation/document.service';
import { DocumentController } from './controller/document.controller';

// Side-effect imports — register OpenAPI paths with the shared registry.
import './docs/document.docs';

export const createDocumentModule = (): Router => {
  const router = Router();

  // Dependency wiring
  const documentService = new DocumentService();

  // Controllers
  const documentController = new DocumentController(documentService);

  // Mount
  router.use('/documents', documentController.router);

  return router;
};

// Re-export for use in other modules
export { DocumentService } from './service/implementation/document.service';
export type { IDocumentService } from './service/interface/document.service.interface';
