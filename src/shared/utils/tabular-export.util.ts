import * as XLSX from 'xlsx';
import { z } from 'zod';

/**
 * Register exports (findings, risks, audit logs, analytics exceptions) as CSV
 * or Excel. Every export is capped so one request can never pull an unbounded
 * table into memory; callers pass the same filters their list endpoint uses.
 */
export const EXPORT_MAX_ROWS = 10_000;

export const ExportFormatSchema = z.enum(['csv', 'xlsx']).default('xlsx');
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

const MIME: Record<ExportFormat, string> = {
  csv: 'text/csv; charset=utf-8',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
};

// A cell starting with one of these is executed as a formula by Excel/Sheets
// (CSV injection). Prefixing a quote keeps the text literal.
const FORMULA_PREFIX = /^[=+\-@\t\r]/;

const toCell = (value: CellValue): string | number | boolean => {
  if (value === null || value === undefined) return '';
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'string' && FORMULA_PREFIX.test(value)) return `'${value}`;
  return value;
};

export const buildTabularExport = <T>(
  rows: T[],
  columns: ExportColumn<T>[],
  options: { baseName: string; format: ExportFormat; sheetName?: string },
): TabularExportFile => {
  const matrix = [
    columns.map((c) => c.header),
    ...rows.map((row) => columns.map((c) => toCell(c.value(row)))),
  ];
  const sheet = XLSX.utils.aoa_to_sheet(matrix);
  const stamp = new Date().toISOString().slice(0, 10);
  const fileName = `${options.baseName}-${stamp}.${options.format}`;

  if (options.format === 'csv') {
    // BOM so Excel opens UTF-8 (names with accents, the ₦ sign) correctly.
    const csv = `﻿${XLSX.utils.sheet_to_csv(sheet)}`;
    return { fileName, mimeType: MIME.csv, buffer: Buffer.from(csv, 'utf8') };
  }

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, (options.sheetName ?? options.baseName).slice(0, 31));
  const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
  return { fileName, mimeType: MIME.xlsx, buffer };
};
