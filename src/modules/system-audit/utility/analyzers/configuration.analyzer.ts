import { z } from 'zod';
import { AnalysisType, ExceptionSeverity } from '../../domain/enum/system-audit.enum';
import {
  AnalysisRecord,
  AnalyzerContext,
  AnalyzerDefinition,
  AnalysisResult,
  ConfigurationSnapshot,
  ExceptionDraft,
} from '../../domain/entity/system-audit.entity';
import { matchesAny } from '../system-audit.utility';

const ParametersSchema = z.object({
  /** Settings whose drift is security-relevant (raised as high). */
  securitySensitivePatterns: z
    .array(z.string().trim().min(1))
    .max(200)
    .default([
      '*password*', '*passwd*', '*encrypt*', '*tls*', '*ssl*', '*cipher*', '*audit*', '*log*', '*firewall*', '*port*',
      '*admin*', '*auth*', '*mfa*', '*lockout*', '*root*', '*remote*', '*telnet*', '*ssh*', '*snmp*', '*session*',
      '*timeout*', '*guest*', '*anonymous*', '*smb*', '*rdp*',
    ]),
  insecureValuePatterns: z
    .array(z.string().trim().min(1))
    .max(200)
    .default(['*sslv2*', '*sslv3*', '*tlsv1.0*', '*tls1.0*', '*tls 1.0*', '*tlsv1.1*', '*telnet*', '*rc4*', '*3des*', '*md5*', '*permit any any*', '*any any*']),
  /** Volatile settings that change on their own and would only add noise. */
  ignoreSettings: z
    .array(z.string().trim().min(1))
    .max(200)
    .default(['*uptime*', '*last*boot*', '*timestamp*', '*last*modified*', '*serial*number*']),
});
export type ConfigurationParameters = z.infer<typeof ParametersSchema>;

const DEFAULT_SYSTEM = '(all)';
const text = (v: unknown): string | null => (v === null || v === undefined || String(v).trim() === '' ? null : String(v).trim());
const same = (a: string, b: string): boolean => a.replace(/\s+/g, ' ').toLowerCase() === b.replace(/\s+/g, ' ').toLowerCase();

const analyse = (records: AnalysisRecord[], params: ConfigurationParameters, context: AnalyzerContext): AnalysisResult => {
  const exceptions: ExceptionDraft[] = [];
  const snapshot: ConfigurationSnapshot = {};
  const expectedBySetting: Array<{ system: string; setting: string; value: string; expected: string; row: number }> = [];
  let duplicates = 0;
  let insecure = 0;
  let ignored = 0;
  const hasExpected = context.mappedFields.has('expected');
  const severityFor = (setting: string): ExceptionSeverity =>
    matchesAny(setting, params.securitySensitivePatterns) ? ExceptionSeverity.High : ExceptionSeverity.Medium;

  for (const r of records) {
    const setting = text(r.values.setting);
    if (!setting) continue;
    if (matchesAny(setting, params.ignoreSettings)) {
      ignored += 1;
      continue;
    }
    const system = text(r.values.system) ?? DEFAULT_SYSTEM;
    const value = text(r.values.value) ?? '';
    snapshot[system] ??= {};
    if (setting in snapshot[system]) duplicates += 1;
    snapshot[system][setting] = value;

    if (value && matchesAny(value, params.insecureValuePatterns)) {
      insecure += 1;
      exceptions.push({
        ruleCode: 'INSECURE_VALUE',
        severity: ExceptionSeverity.High,
        title: `${system === DEFAULT_SYSTEM ? '' : `${system}: `}${setting} is set to an insecure value "${value}"`,
        recordRef: `${system}/${setting}`,
        details: { system, setting, value, row: r.rowNumber },
      });
    }

    const expected = text(r.values.expected);
    if (hasExpected && expected !== null) expectedBySetting.push({ system, setting, value, expected, row: r.rowNumber });
  }

  let comparison: 'expected_column' | 'baseline' | 'none' = 'none';
  let drifted = 0;
  let missing = 0;
  let added = 0;

  if (hasExpected) {
    comparison = 'expected_column';
    for (const item of expectedBySetting) {
      if (!same(item.value, item.expected)) {
        drifted += 1;
        exceptions.push({
          ruleCode: 'CONFIG_DRIFT',
          severity: severityFor(item.setting),
          title: `${item.system === DEFAULT_SYSTEM ? '' : `${item.system}: `}${item.setting} is "${item.value}" but the standard requires "${item.expected}"`,
          recordRef: `${item.system}/${item.setting}`,
          details: { system: item.system, setting: item.setting, actual: item.value, expected: item.expected, row: item.row },
        });
      }
    }
  } else if (context.baseline) {
    comparison = 'baseline';
    const baseline = context.baseline;
    for (const [system, settings] of Object.entries(snapshot)) {
      const base = baseline[system] ?? (Object.keys(baseline).length === 1 ? Object.values(baseline)[0] : undefined);
      if (!base) continue;
      for (const [setting, value] of Object.entries(settings)) {
        if (!(setting in base)) {
          added += 1;
          exceptions.push({
            ruleCode: 'SETTING_ADDED',
            severity: ExceptionSeverity.Low,
            title: `${system === DEFAULT_SYSTEM ? '' : `${system}: `}${setting} is not in the approved baseline`,
            recordRef: `${system}/${setting}`,
            details: { system, setting, value },
          });
        } else if (!same(value, base[setting])) {
          drifted += 1;
          exceptions.push({
            ruleCode: 'CONFIG_DRIFT',
            severity: severityFor(setting),
            title: `${system === DEFAULT_SYSTEM ? '' : `${system}: `}${setting} changed from "${base[setting]}" to "${value}" since the approved baseline`,
            recordRef: `${system}/${setting}`,
            details: { system, setting, actual: value, baseline: base[setting] },
          });
        }
      }
      for (const setting of Object.keys(base)) {
        if (!(setting in settings) && !matchesAny(setting, params.ignoreSettings)) {
          missing += 1;
          exceptions.push({
            ruleCode: 'SETTING_MISSING',
            severity: severityFor(setting),
            title: `${system === DEFAULT_SYSTEM ? '' : `${system}: `}${setting} from the approved baseline is missing`,
            recordRef: `${system}/${setting}`,
            details: { system, setting, baseline: base[setting] },
          });
        }
      }
    }
  }

  return {
    summary: {
      systems: Object.keys(snapshot).length,
      settings: Object.values(snapshot).reduce((n, s) => n + Object.keys(s).length, 0),
      comparison,
      driftedSettings: drifted,
      missingSettings: missing,
      addedSettings: added,
      insecureValues: insecure,
      duplicateSettings: duplicates,
      ignoredSettings: ignored,
    },
    exceptions,
    snapshot,
  };
};

export const configurationAnalyzer: AnalyzerDefinition<ConfigurationParameters> = {
  type: AnalysisType.Configuration,
  label: 'Configuration baseline review',
  description:
    'Reviews a configuration export (server, database, firewall, application settings) against the approved baseline or the standard values in the file — drift, missing and unexpected settings, and insecure values. Mark a reviewed export as the baseline for future comparisons.',
  controls: ['ISO27001-A.8.9', 'SYS-INF-001', 'ISO27001-A.8.20', 'COBIT-BAI06'],
  fields: [
    { key: 'setting', label: 'Setting', kind: 'text', required: true, synonyms: ['parameter', 'key', 'name', 'configuration item', 'config item', 'control', 'policy', 'option', 'property', 'setting name'] },
    { key: 'value', label: 'Current value', kind: 'text', required: true, synonyms: ['current value', 'actual', 'actual value', 'configured value', 'setting value', 'current'] },
    { key: 'system', label: 'System / host', kind: 'text', required: false, synonyms: ['host', 'hostname', 'device', 'server', 'asset', 'node'] },
    { key: 'expected', label: 'Expected value', kind: 'text', required: false, synonyms: ['expected value', 'baseline', 'baseline value', 'required value', 'recommended', 'recommended value', 'standard', 'target'] },
  ],
  parametersSchema: ParametersSchema,
  rules: [
    { code: 'CONFIG_DRIFT', label: 'Setting differs from baseline / standard', severity: 'varies' },
    { code: 'SETTING_MISSING', label: 'Baseline setting missing', severity: 'varies' },
    { code: 'SETTING_ADDED', label: 'Setting not in baseline', severity: ExceptionSeverity.Low },
    { code: 'INSECURE_VALUE', label: 'Insecure value', severity: ExceptionSeverity.High },
  ],
  analyse,
};
