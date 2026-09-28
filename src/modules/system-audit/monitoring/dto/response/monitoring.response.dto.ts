import { EmergingRiskResponseDto } from '../../../../risk/monitoring/dto/response/monitoring.response.dto';
import { RunResponseDto, SeverityCounts } from '../../../analytics/dto/response/analytics.response.dto';

export interface MonitoringCheckDto {
  key: string;
  label: string;
  description: string;
  analysisType: string;
  source: string;
  enabled: boolean;
  /** False when the source integration is switched off in this deployment. */
  connected: boolean;
  connectionNote: string | null;
  lastRun: RunResponseDto | null;
}

export interface MonitoringConfigDto {
  enabled: boolean;
  checks: Record<string, boolean>;
  securityEventLookbackDays: number;
  incidentLookbackDays: number;
  /** Scheduled runs notify system-audit administrators at or above this severity. */
  notifyOnSeverity: string;
}

export interface MonitoringDashboardDto {
  generatedAt: string;
  config: MonitoringConfigDto;
  checks: MonitoringCheckDto[];
  /** Open exceptions on the latest run of each monitoring check. */
  openExceptions: SeverityCounts;
  /** New exceptions per day over the last 30 days, across every analysis. */
  exceptionTrend: Array<{ date: string; criticalHigh: number; mediumLow: number }>;
  /** Latest analysis of each type — backup, incident, vulnerability, change posture. */
  latestByType: Record<string, RunResponseDto | null>;
  security: {
    windowDays: number;
    loginSucceeded: number;
    loginFailed: number;
    mfaFailed: number;
    accessDenied: number;
    tokenReuseDetected: number;
  } | null;
  systemExceptions: { windowDays: number; total: number; bySource: Record<string, number> } | null;
  emergingRisks: EmergingRiskResponseDto[];
}

export interface MonitoringRunResultDto {
  ran: Array<{ check: string; runId: string; reference: string; exceptions: number }>;
  skipped: Array<{ check: string; reason: string }>;
  failed: Array<{ check: string; error: string }>;
}
