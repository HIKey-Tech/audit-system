import { IAuditLogService, ISystemLogService } from '../../../../logging/service/interface/audit-log.service.interface';
import { IUserService } from '../../../../user/service/interface/user.service.interface';
import { IMonitoringService as IRiskMonitoringService } from '../../../../risk/monitoring/service/interface/monitoring.service.interface';
import { ISystemConfigService } from '../../../../settings/service/interface/system-config.service.interface';
import { INotificationQueueService } from '../../../../messaging/service/interface/notification-queue.service.interface';
import { SystemAuditActor } from '../../../domain/entity/system-audit.entity';
import { AnalysisSource, AnalysisType } from '../../../domain/enum/system-audit.enum';
import { ISystemAuditAnalyticsService } from '../../../analytics/service/interface/analytics.service.interface';
import { MonitoringDashboardDto, MonitoringRunResultDto } from '../../dto/response/monitoring.response.dto';
import { IContinuousMonitoringService } from '../interface/monitoring.service.interface';
export declare const MONITORING_CONFIG_KEY = "continuous_monitoring";
interface CheckDefinition {
    key: string;
    label: string;
    description: string;
    analysisType: AnalysisType;
    source: AnalysisSource;
    lookback?: 'securityEventLookbackDays' | 'incidentLookbackDays';
    connection: () => {
        connected: boolean;
        note: string | null;
    };
}
export declare const MONITORING_CHECKS: CheckDefinition[];
export declare class ContinuousMonitoringService implements IContinuousMonitoringService {
    private readonly analyticsService;
    private readonly userService;
    private readonly auditLogService;
    private readonly systemLogService;
    private readonly riskMonitoringService;
    private readonly systemConfigService;
    private readonly notificationQueue;
    constructor(analyticsService: ISystemAuditAnalyticsService, userService: IUserService, auditLogService: IAuditLogService, systemLogService: ISystemLogService, riskMonitoringService: IRiskMonitoringService, systemConfigService: ISystemConfigService, notificationQueue: INotificationQueueService);
    runScheduledChecks(): Promise<MonitoringRunResultDto>;
    runChecksNow(actor: SystemAuditActor): Promise<MonitoringRunResultDto>;
    getDashboard(actor: SystemAuditActor): Promise<MonitoringDashboardDto>;
    private _runCheck;
    /** Tell system-audit administrators about serious new exceptions from a scheduled run. */
    private _notify;
    private _config;
    private _exceptionTrend;
    private _emergingRisks;
}
export {};
//# sourceMappingURL=monitoring.service.d.ts.map