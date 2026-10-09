"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.dataIntegrityAnalyzer = void 0;
const zod_1 = require("zod");
const system_audit_enum_1 = require("../../domain/enum/system-audit.enum");
const extract_parser_utility_1 = require("../extract-parser.utility");
const system_audit_utility_1 = require("../system-audit.utility");
const Column = zod_1.z.string().trim().min(1).max(200);
const ParametersSchema = zod_1.z.object({
    /** Columns that together must be unique (e.g. invoice number, or vendor + invoice). */
    keyColumns: zod_1.z.array(Column).max(10).default([]),
    requiredColumns: zod_1.z.array(Column).max(50).default([]),
    /** Numeric document sequence that should have no gaps (e.g. receipt or voucher number). */
    sequenceColumn: Column.nullable().default(null),
    amountColumn: Column.nullable().default(null),
    /** Control total from the source system or ledger, reconciled to the extract. */
    expectedTotal: zod_1.z.number().nullable().default(null),
    expectedCount: zod_1.z.number().int().min(0).nullable().default(null),
    tolerance: zod_1.z.number().min(0).default(0.01),
    dateColumn: Column.nullable().default(null),
    periodStart: zod_1.z.string().nullable().default(null),
    periodEnd: zod_1.z.string().nullable().default(null),
});
const MAX_LISTED = 25;
const MAX_GAP_EXCEPTIONS = 200;
const blank = (v) => v === null || v === undefined || String(v).trim() === '';
const analyse = (records, params, _context) => {
    const columns = Object.keys(records[0]?.values ?? {});
    const referenced = [
        ...params.keyColumns,
        ...params.requiredColumns,
        params.sequenceColumn,
        params.amountColumn,
        params.dateColumn,
    ].filter((c) => Boolean(c));
    const unknown = referenced.filter((c) => !columns.includes(c));
    if (unknown.length > 0) {
        throw new Error(`Column(s) not found in the file: ${unknown.join(', ')}. Available columns: ${columns.join(', ')}`);
    }
    const configured = params.keyColumns.length > 0 ||
        params.requiredColumns.length > 0 ||
        params.sequenceColumn ||
        params.amountColumn ||
        params.expectedCount !== null ||
        params.dateColumn;
    if (!configured) {
        throw new Error('Choose at least one integrity check: key columns, required columns, a sequence, an amount/control total, a record count, or a date period');
    }
    const exceptions = [];
    const summary = { rows: records.length, columns: columns.length };
    let invalid = 0;
    if (params.keyColumns.length > 0) {
        const seen = new Map();
        for (const r of records) {
            const key = params.keyColumns.map((c) => String(r.values[c] ?? '').trim().toLowerCase()).join(' | ');
            if (key.replace(/[\s|]/g, '') === '')
                continue;
            seen.set(key, [...(seen.get(key) ?? []), r.rowNumber]);
        }
        let duplicateRows = 0;
        let duplicateKeys = 0;
        for (const [key, rows] of seen) {
            if (rows.length < 2)
                continue;
            duplicateKeys += 1;
            duplicateRows += rows.length;
            exceptions.push({
                ruleCode: 'DUPLICATE_KEY',
                severity: system_audit_enum_1.ExceptionSeverity.High,
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
        if (rows.length === 0)
            continue;
        missingValues += rows.length;
        exceptions.push({
            ruleCode: 'MISSING_VALUE',
            severity: system_audit_enum_1.ExceptionSeverity.Medium,
            title: `${rows.length} row(s) have no value for required column "${column}"`,
            recordRef: column,
            details: { column, count: rows.length, rows: rows.slice(0, MAX_LISTED) },
        });
    }
    if (params.requiredColumns.length > 0)
        summary.missingValues = missingValues;
    if (params.sequenceColumn) {
        const column = params.sequenceColumn;
        const numbers = [];
        const badRows = [];
        for (const r of records) {
            if (blank(r.values[column]))
                continue;
            // Keep only the numeric part of references like "RCPT-000123".
            const digits = String(r.values[column]).match(/(\d+)(?!.*\d)/);
            const n = digits ? Number(digits[1]) : NaN;
            if (Number.isSafeInteger(n))
                numbers.push(n);
            else
                badRows.push(r.rowNumber);
        }
        const unique = Array.from(new Set(numbers)).sort((a, b) => a - b);
        let missingNumbers = 0;
        let gaps = 0;
        for (let i = 1; i < unique.length; i += 1) {
            const gap = unique[i] - unique[i - 1] - 1;
            if (gap <= 0)
                continue;
            gaps += 1;
            missingNumbers += gap;
            if (gaps <= MAX_GAP_EXCEPTIONS) {
                const from = unique[i - 1] + 1;
                const to = unique[i] - 1;
                exceptions.push({
                    ruleCode: 'SEQUENCE_GAP',
                    severity: system_audit_enum_1.ExceptionSeverity.Medium,
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
                severity: system_audit_enum_1.ExceptionSeverity.Medium,
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
        const badRows = [];
        for (const r of records) {
            if (blank(r.values[column]))
                continue;
            const n = (0, extract_parser_utility_1.toNumber)(r.values[column]);
            if (n === null)
                badRows.push(r.rowNumber);
            else
                total += n;
        }
        summary.controlTotal = (0, system_audit_utility_1.round)(total, 2);
        if (badRows.length > 0) {
            invalid += badRows.length;
            exceptions.push({
                ruleCode: 'INVALID_VALUE',
                severity: system_audit_enum_1.ExceptionSeverity.Medium,
                title: `${badRows.length} row(s) have a non-numeric "${column}"`,
                recordRef: column,
                details: { column, rows: badRows.slice(0, MAX_LISTED) },
            });
        }
        if (params.expectedTotal !== null) {
            const difference = (0, system_audit_utility_1.round)(total - params.expectedTotal, 2);
            summary.expectedTotal = params.expectedTotal;
            summary.totalDifference = difference;
            if (Math.abs(difference) > params.tolerance) {
                exceptions.push({
                    ruleCode: 'CONTROL_TOTAL_MISMATCH',
                    severity: system_audit_enum_1.ExceptionSeverity.High,
                    title: `"${column}" totals ${(0, system_audit_utility_1.round)(total, 2).toLocaleString('en-NG')} against a control total of ${params.expectedTotal.toLocaleString('en-NG')} (difference ${difference.toLocaleString('en-NG')})`,
                    recordRef: column,
                    details: { column, extractTotal: (0, system_audit_utility_1.round)(total, 2), expectedTotal: params.expectedTotal, difference },
                });
            }
        }
    }
    if (params.expectedCount !== null) {
        summary.expectedCount = params.expectedCount;
        if (records.length !== params.expectedCount) {
            exceptions.push({
                ruleCode: 'RECORD_COUNT_MISMATCH',
                severity: system_audit_enum_1.ExceptionSeverity.High,
                title: `The extract has ${records.length} rows but the source reports ${params.expectedCount}`,
                recordRef: 'record count',
                details: { actual: records.length, expected: params.expectedCount, difference: records.length - params.expectedCount },
            });
        }
    }
    if (params.dateColumn) {
        const column = params.dateColumn;
        const start = params.periodStart ? (0, extract_parser_utility_1.toDate)(params.periodStart, 'dmy') : null;
        const end = params.periodEnd ? (0, extract_parser_utility_1.toDate)(params.periodEnd, 'dmy') : null;
        if (end)
            end.setHours(23, 59, 59, 999);
        const outside = [];
        const badRows = [];
        for (const r of records) {
            if (blank(r.values[column]))
                continue;
            const d = (0, extract_parser_utility_1.toDate)(r.values[column], 'dmy');
            if (!d)
                badRows.push(r.rowNumber);
            else if ((start && d < start) || (end && d > end))
                outside.push(r.rowNumber);
        }
        if (outside.length > 0) {
            exceptions.push({
                ruleCode: 'OUT_OF_PERIOD',
                severity: system_audit_enum_1.ExceptionSeverity.Low,
                title: `${outside.length} row(s) have a "${column}" outside the period ${params.periodStart ?? '…'} – ${params.periodEnd ?? '…'}`,
                recordRef: column,
                details: { column, rows: outside.slice(0, MAX_LISTED), count: outside.length },
            });
        }
        if (badRows.length > 0) {
            invalid += badRows.length;
            exceptions.push({
                ruleCode: 'INVALID_VALUE',
                severity: system_audit_enum_1.ExceptionSeverity.Medium,
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
exports.dataIntegrityAnalyzer = {
    type: system_audit_enum_1.AnalysisType.DataIntegrity,
    label: 'Data integrity checks',
    description: 'Validates the completeness and accuracy of any system extract (e.g. from Dynafin): duplicates, missing mandatory values, sequence gaps, control-total and record-count reconciliation, and out-of-period dates.',
    controls: ['SYS-DATA-001', 'SOX-ITGC-PD', 'GDPR-ART5', 'FIN-REC-001'],
    fields: [],
    parametersSchema: ParametersSchema,
    rules: [
        { code: 'DUPLICATE_KEY', label: 'Duplicate key values', severity: system_audit_enum_1.ExceptionSeverity.High },
        { code: 'MISSING_VALUE', label: 'Missing mandatory values', severity: system_audit_enum_1.ExceptionSeverity.Medium },
        { code: 'SEQUENCE_GAP', label: 'Gap in document sequence', severity: system_audit_enum_1.ExceptionSeverity.Medium },
        { code: 'INVALID_VALUE', label: 'Unreadable numbers or dates', severity: system_audit_enum_1.ExceptionSeverity.Medium },
        { code: 'CONTROL_TOTAL_MISMATCH', label: 'Control total does not reconcile', severity: system_audit_enum_1.ExceptionSeverity.High },
        { code: 'RECORD_COUNT_MISMATCH', label: 'Record count does not reconcile', severity: system_audit_enum_1.ExceptionSeverity.High },
        { code: 'OUT_OF_PERIOD', label: 'Dates outside the period', severity: system_audit_enum_1.ExceptionSeverity.Low },
    ],
    analyse,
};
//# sourceMappingURL=data-integrity.analyzer.js.map