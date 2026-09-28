import { z } from 'zod';
import { AnalysisType, ExceptionSeverity } from '../enum/system-audit.enum';

export type FieldKind = 'text' | 'date' | 'number' | 'boolean' | 'list';

export type FieldValue = string | number | boolean | Date | string[] | null;

/** A column an analysis understands, and how to recognise it in an export. */
export interface AnalysisField {
  key: string;
  label: string;
  kind: FieldKind;
  required: boolean;
  /** Header spellings recognised by auto-mapping (compared after normalisation). */
  synonyms: string[];
  description?: string;
}

/** One normalised input row. `rowNumber` is the spreadsheet row (header = 1). */
export interface AnalysisRecord {
  rowNumber: number;
  values: Record<string, FieldValue>;
}

export interface ExceptionDraft {
  ruleCode: string;
  severity: ExceptionSeverity;
  title: string;
  /** Key of the offending record — account, change id, host, setting. */
  recordRef?: string;
  details?: Record<string, unknown>;
}

export interface AccessItemDraft {
  accountId: string;
  displayName: string | null;
  email: string | null;
  department: string | null;
  accountStatus: string | null;
  isPrivileged: boolean;
  lastLoginAt: Date | null;
  entitlements: string[];
  flags: string[];
}

/** Settings per system: system name → setting → value. */
export type ConfigurationSnapshot = Record<string, Record<string, string>>;

export interface AnalysisResult {
  summary: Record<string, number | string | boolean | null>;
  exceptions: ExceptionDraft[];
  accessItems?: AccessItemDraft[];
  /** Normalised state kept for later comparison (configuration baselines). */
  snapshot?: ConfigurationSnapshot;
}

/** Staff directory entry used to spot leavers who still hold access. */
export interface DirectoryEntry {
  email: string;
  displayName: string | null;
  isActive: boolean;
}

export interface AnalyzerContext {
  now: Date;
  /** Field keys the export actually supplied — rules on optional columns only fire when present. */
  mappedFields: Set<string>;
  directory?: DirectoryEntry[];
  baseline?: ConfigurationSnapshot;
}

export interface AnalysisRule {
  code: string;
  label: string;
  severity: ExceptionSeverity | 'varies';
}

export interface AnalyzerDefinition<P = unknown> {
  type: AnalysisType;
  label: string;
  description: string;
  /** Control references the analysis produces evidence for. */
  controls: string[];
  /** Empty for free-form analyses (data integrity), which work on raw columns. */
  fields: AnalysisField[];
  parametersSchema: z.ZodType<P, z.ZodTypeDef, unknown>;
  rules: AnalysisRule[];
  analyse(records: AnalysisRecord[], params: P, context: AnalyzerContext): AnalysisResult;
}

/** The authenticated caller (`req.user`), or the scheduler acting on its own. */
export interface SystemAuditActor {
  id: string;
  roles: string[];
  permissions: string[];
  isSuperAdmin?: boolean;
}
