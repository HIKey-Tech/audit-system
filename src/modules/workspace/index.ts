import { Router } from 'express';
import { WorkspaceController } from './controller/workspace.controller';
import { WorkspaceService } from './service/implementation/workspace.service';

export const createWorkspaceModule = (): Router => {
  const router = Router();
  const controller = new WorkspaceController(new WorkspaceService());
  router.use('/workspace', controller.router);
  return router;
};
