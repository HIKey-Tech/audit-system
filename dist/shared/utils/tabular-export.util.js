"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildTabularExport = exports.ExportFormatSchema = exports.EXPORT_MAX_ROWS = void 0;
const XLSX = __importStar(require("xlsx"));
const zod_1 = require("zod");
/**
 * Register exports (findings, risks, audit logs, analytics exceptions) as CSV
 * or Excel. Every export is capped so one request can never pull an unbounded
 * table into memory; callers pass the same filters their list endpoint uses.
 */
exports.EXPORT_MAX_ROWS = 10_000;
exports.ExportFormatSchema = zod_1.z.enum(['csv', 'xlsx']).default('xlsx');
const MIME = {
    csv: 'text/csv; charset=utf-8',
    xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
};
// A cell starting with one of these is executed as a formula by Excel/Sheets
// (CSV injection). Prefixing a quote keeps the text literal.
const FORMULA_PREFIX = /^[=+\-@\t\r]/;
const toCell = (value) => {
    if (value === null || value === undefined)
        return '';
    if (value instanceof Date)
        return value.toISOString();
    if (typeof value === 'string' && FORMULA_PREFIX.test(value))
        return `'${value}`;
    return value;
};
const buildTabularExport = (rows, columns, options) => {
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
    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
    return { fileName, mimeType: MIME.xlsx, buffer };
};
exports.buildTabularExport = buildTabularExport;
//# sourceMappingURL=tabular-export.util.js.map