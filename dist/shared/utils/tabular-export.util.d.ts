import { z } from 'zod';
/**
 * Register exports (findings, risks, audit logs, analytics exceptions) as CSV
 * or Excel. Every export is capped so one request can never pull an unbounded
 * table into memory; callers pass the same filters their list endpoint uses.
 */
export declare const EXPORT_MAX_ROWS = 10000;
export declare const ExportFormatSchema: z.ZodDefault<z.ZodEnum<["csv", "xlsx"]>>;
export type ExportFormat = z.infer<typeof ExportFormatSchema>;
type CellValue = string | number | boolean | Date | null | undefined;
export interface ExportColumn<T> {
    header: string;
    value: (row: T) => CellValue;
}
export interface TabularExportFile {
    fileName: string;
    mimeType: string;
    buffer: Buffer;
}
export declare const buildTabularExport: <T>(rows: T[], columns: ExportColumn<T>[], options: {
    baseName: string;
    format: ExportFormat;
    sheetName?: string;
}) => TabularExportFile;
export {};
//# sourceMappingURL=tabular-export.util.d.ts.map