import { SystemAuditActor } from '../../../domain/entity/system-audit.entity';
import { MonitoringDashboardDto, MonitoringRunResultDto } from '../../dto/response/monitoring.response.dto';
/**
 * Continuous monitoring: automated, read-only re-runs of the live analyses
 * (IAMS access and security events, Entra ID, IMOC) plus one dashboard over
 * every analysis, security events, system exceptions, and emerging risks.
 */
export interface IContinuousMonitoringService {
    /** Scheduled daily run. Idempotent — a check already run today is skipped. */
    runScheduledChecks(): Promise<MonitoringRunResultDto>;
    /** On-demand run of every enabled, connected check, recorded against the caller. */
    runChecksNow(actor: SystemAuditActor): Promise<MonitoringRunResultDto>;
    getDashboard(actor: SystemAuditActor): Promise<MonitoringDashboardDto>;
}
//# sourceMappingURL=monitoring.service.interface.d.ts.map