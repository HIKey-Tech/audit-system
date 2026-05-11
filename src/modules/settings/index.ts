import { Router } from 'express';
import { UserService } from '../user/service/implementation/user.service';
import { SettingsController as RoleSettingsController } from '../user/controller/settings.controller';
import { WorkingPaperTemplateController } from './controller/working-paper-template.controller';
import { ReportTemplateController } from './controller/report-template.controller';
import { SystemConfigController } from './controller/system-config.controller';
import { workingPaperTemplateService } from './service/implementation/working-paper-template.service';
import { reportTemplateService } from './service/implementation/report-template.service';
import { systemConfigService } from './service/implementation/system-config.service';

export const createSettingsModule = (): Router => {
  const router = Router();

  // Dependency wiring
  const userService = new UserService();

  // Controllers
  const roleSettingsController = new RoleSettingsController(userService);
  const workingPaperTemplateController = new WorkingPaperTemplateController(
    workingPaperTemplateService,
  );
  const reportTemplateController = new ReportTemplateController(reportTemplateService);
  const systemConfigController = new SystemConfigController(systemConfigService);

  // Mount
  router.use('/settings/working-paper-templates', workingPaperTemplateController.router);
  router.use('/settings/report-templates', reportTemplateController.router);
  router.use('/settings/config', systemConfigController.router);
  router.use('/settings', roleSettingsController.router);

  return router;
};

export {
  WorkingPaperTemplateService,
  workingPaperTemplateService,
} from './service/implementation/working-paper-template.service';
export {
  ReportTemplateService,
  reportTemplateService,
} from './service/implementation/report-template.service';
export {
  SystemConfigService,
  systemConfigService,
} from './service/implementation/system-config.service';
export type { IWorkingPaperTemplateService } from './service/interface/working-paper-template.service.interface';
export type { IReportTemplateService } from './service/interface/report-template.service.interface';
export type { ISystemConfigService } from './service/interface/system-config.service.interface';
