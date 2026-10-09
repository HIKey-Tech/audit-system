import { Router } from 'express';
import { SystemAuditAnalyticsService } from './analytics/service/implementation/analytics.service';
import { ContinuousMonitoringService } from './monitoring/service/implementation/monitoring.service';
export declare const systemAuditAnalyticsService: SystemAuditAnalyticsService;
export declare const continuousMonitoringService: ContinuousMonitoringService;
export declare const createSystemAuditModule: () => Router;
export type { ISystemAuditAnalyticsService } from './analytics/service/interface/analytics.service.interface';
export type { IContinuousMonitoringService } from './monitoring/service/interface/monitoring.service.interface';
//# sourceMappingURL=index.d.ts.map