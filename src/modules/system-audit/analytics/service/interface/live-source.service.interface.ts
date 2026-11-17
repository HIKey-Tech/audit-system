import { AnalysisRecord, SystemAuditActor } from '../../../domain/entity/system-audit.entity';
import { AnalysisSource, AnalysisType } from '../../../domain/enum/system-audit.enum';

export interface LiveExtract {
  systemName: string;
  records: AnalysisRecord[];
  mappedFields: Set<string>;
  /** Source-appropriate defaults; anything the auditor passes explicitly wins. */
  parameterDefaults: Record<string, unknown>;
}

/**
 * Reads analysis input from sources IAMS can already see — its own users and
 * security events, Entra ID, and IMOC — through each owning module's service.
 * Strictly read-only.
 */
export interface ILiveSourceService {
  /** Analysis type → live sources it supports. */
  supportedSources(): Partial<Record<AnalysisType, AnalysisSource[]>>;
  fetch(
    type: AnalysisType,
    source: AnalysisSource,
    options: { days: number; actor: SystemAuditActor },
  ): Promise<LiveExtract>;
  /**
   * Organisation-configured parameter defaults for an analysis (e.g. the high-value
   * threshold). Applied to uploads as well as live runs so a configured threshold means
   * the same thing whichever way the data arrives. Anything the auditor passes wins.
   */
  parameterDefaultsFor(type: AnalysisType): Promise<Record<string, unknown>>;
}
