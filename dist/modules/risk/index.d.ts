import { Router } from 'express';
export declare const createRiskModule: () => Router;
export { CategoryService } from './categories/service/implementation/category.service';
export { RiskRegisterService } from './register/service/implementation/register.service';
export { RiskAssessmentService } from './assessments/service/implementation/assessment.service';
export { RiskMonitoringService } from './monitoring/service/implementation/monitoring.service';
export type { ICategoryService } from './categories/service/interface/category.service.interface';
export type { IRegisterService } from './register/service/interface/register.service.interface';
export type { IAssessmentService } from './assessments/service/interface/assessment.service.interface';
export type { IMonitoringService } from './monitoring/service/interface/monitoring.service.interface';
//# sourceMappingURL=index.d.ts.map