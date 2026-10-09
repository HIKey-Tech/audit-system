import { AnalysisField, AnalysisRecord } from '../domain/entity/system-audit.entity';
export declare const MAX_EXTRACT_ROWS = 100000;
export type DateOrder = 'dmy' | 'mdy';
export interface ParsedExtract {
    headers: string[];
    rows: Record<string, unknown>[];
}
/** Field key → the export header it is read from (null = not provided). */
export type ColumnMapping = Record<string, string | null>;
export declare const isSupportedExtract: (fileName: string) => boolean;
/**
 * Reads the first sheet of a CSV/TSV/XLSX export. CSV cells are read as raw
 * text so the library cannot silently reinterpret "03/04/2026" US-style; Excel
 * date cells keep their real date values.
 */
export declare const parseExtract: (buffer: Buffer, fileName: string) => ParsedExtract;
/** Best-effort column mapping from header names; exact synonym matches win over contains-matches. */
export declare const suggestMapping: (headers: string[], fields: AnalysisField[]) => ColumnMapping;
export declare const missingRequiredFields: (fields: AnalysisField[], mapping: ColumnMapping) => AnalysisField[];
export declare const toDate: (value: unknown, order?: DateOrder) => Date | null;
export declare const toNumber: (value: unknown) => number | null;
export declare const toBoolean: (value: unknown) => boolean | null;
export declare const toList: (value: unknown) => string[];
export declare const toText: (value: unknown) => string | null;
/**
 * Applies the column mapping and coerces each field to its kind. Counts values
 * that were present but unreadable so the run summary can report them instead
 * of silently treating bad dates as blanks.
 */
export declare const normaliseRecords: (rows: Record<string, unknown>[], fields: AnalysisField[], mapping: ColumnMapping, order?: DateOrder) => {
    records: AnalysisRecord[];
    unreadableValues: number;
};
/** Free-form rows (data integrity): raw header → text value. */
export declare const rawRecords: (rows: Record<string, unknown>[]) => AnalysisRecord[];
//# sourceMappingURL=extract-parser.utility.d.ts.map