import { AnalysisType } from '../../domain/enum/system-audit.enum';
import { AnalyzerDefinition } from '../../domain/entity/system-audit.entity';
import { accessListingAnalyzer } from './access-listing.analyzer';
import { changeLogAnalyzer } from './change-log.analyzer';
import { backupLogAnalyzer } from './backup-log.analyzer';
import { incidentLogAnalyzer } from './incident-log.analyzer';
import { securityEventLogAnalyzer } from './security-event-log.analyzer';
import { configurationAnalyzer } from './configuration.analyzer';
import { vulnerabilityScanAnalyzer } from './vulnerability-scan.analyzer';
import { dataIntegrityAnalyzer } from './data-integrity.analyzer';

// Each definition is typed with its own parameter shape; the registry erases
// that to `unknown` because parameters are validated by the definition's own
// schema at run time before `analyse` sees them.
export const ANALYZERS: Record<AnalysisType, AnalyzerDefinition<unknown>> = {
  [AnalysisType.AccessListing]: accessListingAnalyzer as AnalyzerDefinition<unknown>,
  [AnalysisType.ChangeLog]: changeLogAnalyzer as AnalyzerDefinition<unknown>,
  [AnalysisType.BackupLog]: backupLogAnalyzer as AnalyzerDefinition<unknown>,
  [AnalysisType.IncidentLog]: incidentLogAnalyzer as AnalyzerDefinition<unknown>,
  [AnalysisType.SecurityEventLog]: securityEventLogAnalyzer as AnalyzerDefinition<unknown>,
  [AnalysisType.Configuration]: configurationAnalyzer as AnalyzerDefinition<unknown>,
  [AnalysisType.VulnerabilityScan]: vulnerabilityScanAnalyzer as AnalyzerDefinition<unknown>,
  [AnalysisType.DataIntegrity]: dataIntegrityAnalyzer as AnalyzerDefinition<unknown>,
};

export { DEFAULT_SOD_RULES, IAMS_SOD_RULES } from './access-listing.analyzer';
