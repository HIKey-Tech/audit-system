import * as XLSX from 'xlsx';
import { AppError } from '../../../shared/errors/app.error';
import { AnalysisField, AnalysisRecord, FieldKind, FieldValue } from '../domain/entity/system-audit.entity';
import { normaliseKey } from './system-audit.utility';

export const MAX_EXTRACT_ROWS = 100_000;
const SUPPORTED_EXTENSIONS = /\.(csv|tsv|txt|xlsx|xls)$/i;

export type DateOrder = 'dmy' | 'mdy';

export interface ParsedExtract {
  headers: string[];
  rows: Record<string, unknown>[];
}

/** Field key → the export header it is read from (null = not provided). */
export type ColumnMapping = Record<string, string | null>;

export const isSupportedExtract = (fileName: string): boolean => SUPPORTED_EXTENSIONS.test(fileName);

/**
 * Reads the first sheet of a CSV/TSV/XLSX export. CSV cells are read as raw
 * text so the library cannot silently reinterpret "03/04/2026" US-style; Excel
 * date cells keep their real date values.
 */
export const parseExtract = (buffer: Buffer, fileName: string): ParsedExtract => {
  if (!isSupportedExtract(fileName)) {
    throw AppError.badRequest('Unsupported file type — upload a CSV, TSV, or Excel (.xlsx/.xls) export');
  }
  const isText = /\.(csv|tsv|txt)$/i.test(fileName);

  let sheet: XLSX.WorkSheet;
  try {
    const workbook = XLSX.read(buffer, isText ? { type: 'buffer', raw: true } : { type: 'buffer', cellDates: true });
    sheet = workbook.Sheets[workbook.SheetNames[0]];
  } catch {
    throw AppError.badRequest('Could not read the file — make sure it is a valid CSV or Excel export');
  }
  if (!sheet) throw AppError.badRequest('The file has no worksheet');

  const matrix = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: '', raw: true, blankrows: false });
  const [headerRow, ...dataRows] = matrix;
  const headers = (headerRow ?? []).map((h) => String(h ?? '').trim());
  if (headers.length === 0 || headers.every((h) => h === '')) {
    throw AppError.badRequest('The first row must contain column headers');
  }
  if (dataRows.length === 0) throw AppError.badRequest('The file has no data rows');
  if (dataRows.length > MAX_EXTRACT_ROWS) {
    throw AppError.badRequest(`The file has ${dataRows.length} rows; the maximum per analysis is ${MAX_EXTRACT_ROWS}`);
  }

  const rows = dataRows.map((cells) =>
    Object.fromEntries(headers.map((h, i) => [h || `Column ${i + 1}`, cells[i] ?? ''])),
  );
  return { headers: headers.map((h, i) => h || `Column ${i + 1}`), rows };
};

/** Best-effort column mapping from header names; exact synonym matches win over contains-matches. */
export const suggestMapping = (headers: string[], fields: AnalysisField[]): ColumnMapping => {
  const normalised = headers.map((h) => ({ header: h, key: normaliseKey(h) }));
  const used = new Set<string>();
  const mapping: ColumnMapping = {};

  for (const field of fields) {
    const candidates = [field.key, field.label, ...field.synonyms].map(normaliseKey);
    const exact = normalised.find((h) => !used.has(h.header) && candidates.includes(h.key));
    const partial = exact
      ? undefined
      : normalised.find((h) => !used.has(h.header) && candidates.some((c) => c.length > 3 && h.key.includes(c)));
    const match = exact ?? partial;
    mapping[field.key] = match?.header ?? null;
    if (match) used.add(match.header);
  }
  return mapping;
};

export const missingRequiredFields = (fields: AnalysisField[], mapping: ColumnMapping): AnalysisField[] =>
  fields.filter((f) => f.required && !mapping[f.key]);

// ── Value coercion ─────────────────────────────────────────────

const TRUE_WORDS = new Set(['true', 'yes', 'y', '1', 'enabled', 'active', 'x']);
const FALSE_WORDS = new Set(['false', 'no', 'n', '0', 'disabled', 'inactive']);

const excelSerialToDate = (serial: number): Date => new Date(Math.round((serial - 25569) * 86_400_000));

const SLASH_DATE = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})(?:[ T,]+(\d{1,2}):(\d{2})(?::(\d{2}))?\s*([AaPp][Mm])?)?$/;

export const toDate = (value: unknown, order: DateOrder = 'dmy'): Date | null => {
  if (value === null || value === undefined || value === '') return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (typeof value === 'number') {
    if (value > 1e11) return new Date(value); // epoch milliseconds
    if (value > 1e9) return new Date(value * 1000); // epoch seconds
    if (value > 20_000 && value < 80_000) return excelSerialToDate(value);
    return null;
  }

  const text = String(value).trim();
  if (!text) return null;
  if (/^\d+(\.\d+)?$/.test(text)) return toDate(Number(text), order);

  const slash = SLASH_DATE.exec(text);
  if (slash) {
    let [a, b] = [Number(slash[1]), Number(slash[2])];
    // Unambiguous when one part cannot be a month.
    let day = order === 'dmy' ? a : b;
    let month = order === 'dmy' ? b : a;
    if (a > 12 && b <= 12) [day, month] = [a, b];
    else if (b > 12 && a <= 12) [day, month] = [b, a];
    let year = Number(slash[3]);
    if (year < 100) year += 2000;
    let hours = Number(slash[4] ?? 0);
    const meridiem = slash[7]?.toLowerCase();
    if (meridiem === 'pm' && hours < 12) hours += 12;
    if (meridiem === 'am' && hours === 12) hours = 0;
    const date = new Date(year, month - 1, day, hours, Number(slash[5] ?? 0), Number(slash[6] ?? 0));
    return date.getMonth() === month - 1 ? date : null;
  }

  const parsed = new Date(/^\d{4}-\d{2}-\d{2} \d/.test(text) ? text.replace(' ', 'T') : text);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

export const toNumber = (value: unknown): number | null => {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  const text = String(value).trim().replace(/[,\s₦$€£]/g, '');
  if (!text) return null;
  const negative = /^\(.*\)$/.test(text); // accounting negatives: (1,200.00)
  const n = Number(negative ? text.slice(1, -1) : text);
  if (!Number.isFinite(n)) return null;
  return negative ? -n : n;
};

export const toBoolean = (value: unknown): boolean | null => {
  if (typeof value === 'boolean') return value;
  const text = String(value ?? '').trim().toLowerCase();
  if (TRUE_WORDS.has(text)) return true;
  if (FALSE_WORDS.has(text)) return false;
  return null;
};

export const toList = (value: unknown): string[] => {
  if (Array.isArray(value)) return value.map((v) => String(v).trim()).filter(Boolean);
  return String(value ?? '')
    .split(/[;|\n,]/)
    .map((v) => v.trim())
    .filter(Boolean);
};

export const toText = (value: unknown): string | null => {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) return value.toISOString();
  const text = String(value).trim();
  return text ? text : null;
};

const coerce = (value: unknown, kind: FieldKind, order: DateOrder): FieldValue => {
  switch (kind) {
    case 'date':
      return toDate(value, order);
    case 'number':
      return toNumber(value);
    case 'boolean':
      return toBoolean(value);
    case 'list':
      return toList(value);
    default:
      return toText(value);
  }
};

/**
 * Applies the column mapping and coerces each field to its kind. Counts values
 * that were present but unreadable so the run summary can report them instead
 * of silently treating bad dates as blanks.
 */
export const normaliseRecords = (
  rows: Record<string, unknown>[],
  fields: AnalysisField[],
  mapping: ColumnMapping,
  order: DateOrder = 'dmy',
): { records: AnalysisRecord[]; unreadableValues: number } => {
  let unreadableValues = 0;
  const records = rows.map((row, index) => {
    const values: Record<string, FieldValue> = {};
    for (const field of fields) {
      const header = mapping[field.key];
      const raw = header ? row[header] : undefined;
      const value = coerce(raw, field.kind, order);
      const present = raw !== undefined && raw !== null && String(raw).trim() !== '';
      if (present && (value === null || (Array.isArray(value) && value.length === 0))) unreadableValues += 1;
      values[field.key] = value;
    }
    return { rowNumber: index + 2, values };
  });
  return { records, unreadableValues };
};

/** Free-form rows (data integrity): raw header → text value. */
export const rawRecords = (rows: Record<string, unknown>[]): AnalysisRecord[] =>
  rows.map((row, index) => ({
    rowNumber: index + 2,
    values: Object.fromEntries(Object.entries(row).map(([k, v]) => [k, v instanceof Date ? v : toText(v)])),
  }));
