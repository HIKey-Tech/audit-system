import { Router } from 'express';
import { CategoryController } from './categories/controller/category.controller';
import { CategoryService } from './categories/service/implementation/category.service';
import { RegisterController } from './register/controller/register.controller';
import { RiskRegisterService } from './register/service/implementation/register.service';
import { AssessmentController } from './assessments/controller/assessment.controller';
import { RiskAssessmentService } from './assessments/service/implementation/assessment.service';
import { MonitoringController } from './monitoring/controller/monitoring.controller';
import { RiskMonitoringService } from './monitoring/service/implementation/monitoring.service';

export const createRiskModule = (): Router => {
  const router = Router();

  const categoryService = new CategoryService();
  const registerService = new RiskRegisterService();
  const assessmentService = new RiskAssessmentService();
  const monitoringService = new RiskMonitoringService();

  const categoryController = new CategoryController(categoryService);
  const registerController = new RegisterController(registerService);
  const assessmentController = new AssessmentController(assessmentService);
  const monitoringController = new MonitoringController(monitoringService);

  router.use('/risk/categories', categoryController.router);
  router.use('/risk/register', registerController.router);
  router.use('/risk', assessmentController.router);
  router.use('/risk', monitoringController.router);

  return router;
};

export { CategoryService } from './categories/service/implementation/category.service';
export { RiskRegisterService } from './register/service/implementation/register.service';
export { RiskAssessmentService } from './assessments/service/implementation/assessment.service';
export { RiskMonitoringService } from './monitoring/service/implementation/monitoring.service';
export type { ICategoryService } from './categories/service/interface/category.service.interface';
export type { IRegisterService } from './register/service/interface/register.service.interface';
export type { IAssessmentService } from './assessments/service/interface/assessment.service.interface';
export type { IMonitoringService } from './monitoring/service/interface/monitoring.service.interface';
