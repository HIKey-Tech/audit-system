import { z } from 'zod';
import { AnalysisType, ExceptionSeverity } from '../../domain/enum/system-audit.enum';
import { AnalysisRecord, AnalyzerContext, AnalyzerDefinition, AnalysisResult, ExceptionDraft } from '../../domain/entity/system-audit.entity';
import { toDate, toNumber } from '../extract-parser.utility';
import { round } from '../system-audit.utility';

const Column = z.string().trim().min(1).max(200);

const ParametersSchema = z.object({
  /** Columns that together must be unique (e.g. invoice number, or vendor + invoice). */
  keyColumns: z.array(Column).max(10).default([]),
  requiredColumns: z.array(Column).max(50).default([]),
  /** Numeric document sequence that should have no gaps (e.g. receipt or voucher number). */
  sequenceColumn: Column.nullable().default(null),
  amountColumn: Column.nullable().default(null),
  /** Control total from the source system or ledger, reconciled to the extract. */
  expectedTotal: z.number().nullable().default(null),
  expectedCount: z.number().int().min(0).nullable().default(null),
  tolerance: z.number().min(0).default(0.01),
  dateColumn: Column.nullable().default(null),
  periodStart: z.string().nullable().default(null),
  periodEnd: z.string().nullable().default(null),
});
export type DataIntegrityParameters = z.infer<typeof ParametersSchema>;

const MAX_LISTED = 25;
const MAX_GAP_EXCEPTIONS = 200;
const blank = (v: unknown): boolean => v === null || v === undefined || String(v).trim() === '';

const analyse = (records: AnalysisRecord[], params: DataIntegrityParameters, _context: AnalyzerContext): AnalysisResult => {
  const columns = Object.keys(records[0]?.values ?? {});
  const referenced = [
    ...params.keyColumns,
    ...params.requiredColumns,
    params.sequenceColumn,
    params.amountColumn,
    params.dateColumn,
  ].filter((c): c is string => Boolean(c));
  const unknown = referenced.filter((c) => !columns.includes(c));
  if (unknown.length > 0) {
    throw new Error(`Column(s) not found in the file: ${unknown.join(', ')}. Available columns: ${columns.join(', ')}`);
  }
  const configured =
    params.keyColumns.length > 0 ||
    params.requiredColumns.length > 0 ||
    params.sequenceColumn ||
    params.amountColumn ||
    params.expectedCount !== null ||
    params.dateColumn;
  if (!configured) {
    throw new Error('Choose at least one integrity check: key columns, required columns, a sequence, an amount/control total, a record count, or a date period');
  }

  const exceptions: ExceptionDraft[] = [];
  const summary: AnalysisResult['summary'] = { rows: records.length, columns: columns.length };
  let invalid = 0;

  if (params.keyColumns.length > 0) {
    const seen = new Map<string, number[]>();
    for (const r of records) {
      const key = params.keyColumns.map((c) => String(r.values[c] ?? '').trim().toLowerCase()).join(' | ');
      if (key.replace(/[\s|]/g, '') === '') continue;
      seen.set(key, [...(seen.get(key) ?? []), r.rowNumber]);
    }
    let duplicateRows = 0;
    let duplicateKeys = 0;
    for (const [key, rows] of seen) {
      if (rows.length < 2) continue;
      duplicateKeys += 1;
      duplicateRows += rows.length;
      exceptions.push({
        ruleCode: 'DUPLICATE_KEY',
        severity: ExceptionSeverity.High,
        title: `${params.keyColumns.join(' + ')} "${key}" appears ${rows.length} times`,
        recordRef: key.slice(0, 500),
        details: { columns: params.keyColumns, rows: rows.slice(0, MAX_LISTED) },
      });
    }
    summary.duplicateKeys = duplicateKeys;
    summary.duplicateRows = duplicateRows;
  }

  let missingValues = 0;
  for (const column of params.requiredColumns) {
    const rows = records.filter((r) => blank(r.values[column])).map((r) => r.rowNumber);
    if (rows.length === 0) continue;
    missingValues += rows.length;
    exceptions.push({
      ruleCode: 'MISSING_VALUE',
      severity: ExceptionSeverity.Medium,
      title: `${rows.length} row(s) have no value for required column "${column}"`,
      recordRef: column,
      details: { column, count: rows.length, rows: rows.slice(0, MAX_LISTED) },
    });
  }
  if (params.requiredColumns.length > 0) summary.missingValues = missingValues;

  if (params.sequenceColumn) {
    const column = params.sequenceColumn;
    const numbers: number[] = [];
    const badRows: number[] = [];
    for (const r of records) {
      if (blank(r.values[column])) continue;
      // Keep only the numeric part of references like "RCPT-000123".
      const digits = String(r.values[column]).match(/(\d+)(?!.*\d)/);
      const n = digits ? Number(digits[1]) : NaN;
      if (Number.isSafeInteger(n)) numbers.push(n);
      else badRows.push(r.rowNumber);
    }
    const unique = Array.from(new Set(numbers)).sort((a, b) => a - b);
    let missingNumbers = 0;
    let gaps = 0;
    for (let i = 1; i < unique.length; i += 1) {
      const gap = unique[i] - unique[i - 1] - 1;
      if (gap <= 0) continue;
      gaps += 1;
      missingNumbers += gap;
      if (gaps <= MAX_GAP_EXCEPTIONS) {
        const from = unique[i - 1] + 1;
        const to = unique[i] - 1;
        exceptions.push({
          ruleCode: 'SEQUENCE_GAP',
          severity: ExceptionSeverity.Medium,
          title: from === to ? `${column} ${from} is missing from the sequence` : `${column} ${from}–${to} (${gap} numbers) are missing from the sequence`,
          recordRef: `${from}-${to}`,
          details: { column, from, to, missing: gap },
        });
      }
    }
    if (badRows.length > 0) {
      invalid += badRows.length;
      exceptions.push({
        ruleCode: 'INVALID_VALUE',
        severity: ExceptionSeverity.Medium,
        title: `${badRows.length} row(s) have a non-numeric "${column}"`,
        recordRef: column,
        details: { column, rows: badRows.slice(0, MAX_LISTED) },
      });
    }
    summary.sequenceStart = unique[0] ?? null;
    summary.sequenceEnd = unique[unique.length - 1] ?? null;
    summary.sequenceGaps = gaps;
    summary.missingSequenceNumbers = missingNumbers;
    summary.duplicateSequenceNumbers = numbers.length - unique.length;
  }

  if (params.amountColumn) {
    const column = params.amountColumn;
    let total = 0;
    const badRows: number[] = [];
    for (const r of records) {
      if (blank(r.values[column])) continue;
      const n = toNumber(r.values[column]);
      if (n === null) badRows.push(r.rowNumber);
      else total += n;
    }
    summary.controlTotal = round(total, 2);
    if (badRows.length > 0) {
      invalid += badRows.length;
      exceptions.push({
        ruleCode: 'INVALID_VALUE',
        severity: ExceptionSeverity.Medium,
        title: `${badRows.length} row(s) have a non-numeric "${column}"`,
        recordRef: column,
        details: { column, rows: badRows.slice(0, MAX_LISTED) },
      });
    }
    if (params.expectedTotal !== null) {
      const difference = round(total - params.expectedTotal, 2);
      summary.expectedTotal = params.expectedTotal;
      summary.totalDifference = difference;
      if (Math.abs(difference) > params.tolerance) {
        exceptions.push({
          ruleCode: 'CONTROL_TOTAL_MISMATCH',
          severity: ExceptionSeverity.High,
          title: `"${column}" totals ${round(total, 2).toLocaleString('en-NG')} against a control total of ${params.expectedTotal.toLocaleString('en-NG')} (difference ${difference.toLocaleString('en-NG')})`,
          recordRef: column,
          details: { column, extractTotal: round(total, 2), expectedTotal: params.expectedTotal, difference },
        });
      }
    }
  }

  if (params.expectedCount !== null) {
    summary.expectedCount = params.expectedCount;
    if (records.length !== params.expectedCount) {
      exceptions.push({
        ruleCode: 'RECORD_COUNT_MISMATCH',
        severity: ExceptionSeverity.High,
        title: `The extract has ${records.length} rows but the source reports ${params.expectedCount}`,
        recordRef: 'record count',
        details: { actual: records.length, expected: params.expectedCount, difference: records.length - params.expectedCount },
      });
    }
  }

  if (params.dateColumn) {
    const column = params.dateColumn;
    const start = params.periodStart ? toDate(params.periodStart, 'dmy') : null;
    const end = params.periodEnd ? toDate(params.periodEnd, 'dmy') : null;
    if (end) end.setHours(23, 59, 59, 999);
    const outside: number[] = [];
    const badRows: number[] = [];
    for (const r of records) {
      if (blank(r.values[column])) continue;
      const d = toDate(r.values[column], 'dmy');
      if (!d) badRows.push(r.rowNumber);
      else if ((start && d < start) || (end && d > end)) outside.push(r.rowNumber);
    }
    if (outside.length > 0) {
      exceptions.push({
        ruleCode: 'OUT_OF_PERIOD',
        severity: ExceptionSeverity.Low,
        title: `${outside.length} row(s) have a "${column}" outside the period ${params.periodStart ?? '…'} – ${params.periodEnd ?? '…'}`,
        recordRef: column,
        details: { column, rows: outside.slice(0, MAX_LISTED), count: outside.length },
      });
    }
    if (badRows.length > 0) {
      invalid += badRows.length;
      exceptions.push({
        ruleCode: 'INVALID_VALUE',
        severity: ExceptionSeverity.Medium,
        title: `${badRows.length} row(s) have an unreadable date in "${column}"`,
        recordRef: column,
        details: { column, rows: badRows.slice(0, MAX_LISTED) },
      });
    }
    summary.outOfPeriod = outside.length;
  }

  summary.invalidValues = invalid;
  return { summary, exceptions };
};

export const dataIntegrityAnalyzer: AnalyzerDefinition<DataIntegrityParameters> = {
  type: AnalysisType.DataIntegrity,
  label: 'Data integrity checks',
  description:
    'Validates the completeness and accuracy of any system extract (e.g. from Dynafin): duplicates, missing mandatory values, sequence gaps, control-total and record-count reconciliation, and out-of-period dates.',
  controls: ['SYS-DATA-001', 'SOX-ITGC-PD', 'GDPR-ART5', 'FIN-REC-001'],
  fields: [],
  parametersSchema: ParametersSchema,
  rules: [
    { code: 'DUPLICATE_KEY', label: 'Duplicate key values', severity: ExceptionSeverity.High },
    { code: 'MISSING_VALUE', label: 'Missing mandatory values', severity: ExceptionSeverity.Medium },
    { code: 'SEQUENCE_GAP', label: 'Gap in document sequence', severity: ExceptionSeverity.Medium },
    { code: 'INVALID_VALUE', label: 'Unreadable numbers or dates', severity: ExceptionSeverity.Medium },
    { code: 'CONTROL_TOTAL_MISMATCH', label: 'Control total does not reconcile', severity: ExceptionSeverity.High },
    { code: 'RECORD_COUNT_MISMATCH', label: 'Record count does not reconcile', severity: ExceptionSeverity.High },
    { code: 'OUT_OF_PERIOD', label: 'Dates outside the period', severity: ExceptionSeverity.Low },
  ],
  analyse,
};
