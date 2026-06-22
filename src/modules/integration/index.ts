import { Router } from 'express';
import { DirectoryMappingController } from './controller/directory-mapping.controller';
import { directoryMappingService } from './service/implementation/directory-mapping.service';

export const createIntegrationModule = (): Router => {
  const router = Router();
  const controller = new DirectoryMappingController(directoryMappingService);
  router.use('/integration/directory', controller.router);
  return router;
};

export {
  DirectoryMappingService,
  directoryMappingService,
} from './service/implementation/directory-mapping.service';
export type { IDirectoryMappingService } from './service/interface/directory.service.interface';
