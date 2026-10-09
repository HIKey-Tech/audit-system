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
exports.rawRecords = exports.normaliseRecords = exports.toText = exports.toList = exports.toBoolean = exports.toNumber = exports.toDate = exports.missingRequiredFields = exports.suggestMapping = exports.parseExtract = exports.isSupportedExtract = exports.MAX_EXTRACT_ROWS = void 0;
const XLSX = __importStar(require("xlsx"));
const app_error_1 = require("../../../shared/errors/app.error");
const system_audit_utility_1 = require("./system-audit.utility");
exports.MAX_EXTRACT_ROWS = 100_000;
const SUPPORTED_EXTENSIONS = /\.(csv|tsv|txt|xlsx|xls)$/i;
const isSupportedExtract = (fileName) => SUPPORTED_EXTENSIONS.test(fileName);
exports.isSupportedExtract = isSupportedExtract;
/**
 * Reads the first sheet of a CSV/TSV/XLSX export. CSV cells are read as raw
 * text so the library cannot silently reinterpret "03/04/2026" US-style; Excel
 * date cells keep their real date values.
 */
const parseExtract = (buffer, fileName) => {
    if (!(0, exports.isSupportedExtract)(fileName)) {
        throw app_error_1.AppError.badRequest('Unsupported file type — upload a CSV, TSV, or Excel (.xlsx/.xls) export');
    }
    const isText = /\.(csv|tsv|txt)$/i.test(fileName);
    let sheet;
    try {
        const workbook = XLSX.read(buffer, isText ? { type: 'buffer', raw: true } : { type: 'buffer', cellDates: true });
        sheet = workbook.Sheets[workbook.SheetNames[0]];
    }
    catch {
        throw app_error_1.AppError.badRequest('Could not read the file — make sure it is a valid CSV or Excel export');
    }
    if (!sheet)
        throw app_error_1.AppError.badRequest('The file has no worksheet');
    const matrix = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '', raw: true, blankrows: false });
    const [headerRow, ...dataRows] = matrix;
    const headers = (headerRow ?? []).map((h) => String(h ?? '').trim());
    if (headers.length === 0 || headers.every((h) => h === '')) {
        throw app_error_1.AppError.badRequest('The first row must contain column headers');
    }
    if (dataRows.length === 0)
        throw app_error_1.AppError.badRequest('The file has no data rows');
    if (dataRows.length > exports.MAX_EXTRACT_ROWS) {
        throw app_error_1.AppError.badRequest(`The file has ${dataRows.length} rows; the maximum per analysis is ${exports.MAX_EXTRACT_ROWS}`);
    }
    const rows = dataRows.map((cells) => Object.fromEntries(headers.map((h, i) => [h || `Column ${i + 1}`, cells[i] ?? ''])));
    return { headers: headers.map((h, i) => h || `Column ${i + 1}`), rows };
};
exports.parseExtract = parseExtract;
/** Best-effort column mapping from header names; exact synonym matches win over contains-matches. */
const suggestMapping = (headers, fields) => {
    const normalised = headers.map((h) => ({ header: h, key: (0, system_audit_utility_1.normaliseKey)(h) }));
    const used = new Set();
    const mapping = {};
    for (const field of fields) {
        const candidates = [field.key, field.label, ...field.synonyms].map(system_audit_utility_1.normaliseKey);
        const exact = normalised.find((h) => !used.has(h.header) && candidates.includes(h.key));
        const partial = exact
            ? undefined
            : normalised.find((h) => !used.has(h.header) && candidates.some((c) => c.length > 3 && h.key.includes(c)));
        const match = exact ?? partial;
        mapping[field.key] = match?.header ?? null;
        if (match)
            used.add(match.header);
    }
    return mapping;
};
exports.suggestMapping = suggestMapping;
const missingRequiredFields = (fields, mapping) => fields.filter((f) => f.required && !mapping[f.key]);
exports.missingRequiredFields = missingRequiredFields;
// ── Value coercion ─────────────────────────────────────────────
const TRUE_WORDS = new Set(['true', 'yes', 'y', '1', 'enabled', 'active', 'x']);
const FALSE_WORDS = new Set(['false', 'no', 'n', '0', 'disabled', 'inactive']);
const excelSerialToDate = (serial) => new Date(Math.round((serial - 25569) * 86_400_000));
const SLASH_DATE = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})(?:[ T,]+(\d{1,2}):(\d{2})(?::(\d{2}))?\s*([AaPp][Mm])?)?$/;
const toDate = (value, order = 'dmy') => {
    if (value === null || value === undefined || value === '')
        return null;
    if (value instanceof Date)
        return Number.isNaN(value.getTime()) ? null : value;
    if (typeof value === 'number') {
        if (value > 1e11)
            return new Date(value); // epoch milliseconds
        if (value > 1e9)
            return new Date(value * 1000); // epoch seconds
        if (value > 20_000 && value < 80_000)
            return excelSerialToDate(value);
        return null;
    }
    const text = String(value).trim();
    if (!text)
        return null;
    if (/^\d+(\.\d+)?$/.test(text))
        return (0, exports.toDate)(Number(text), order);
    const slash = SLASH_DATE.exec(text);
    if (slash) {
        let [a, b] = [Number(slash[1]), Number(slash[2])];
        // Unambiguous when one part cannot be a month.
        let day = order === 'dmy' ? a : b;
        let month = order === 'dmy' ? b : a;
        if (a > 12 && b <= 12)
            [day, month] = [a, b];
        else if (b > 12 && a <= 12)
            [day, month] = [b, a];
        let year = Number(slash[3]);
        if (year < 100)
            year += 2000;
        let hours = Number(slash[4] ?? 0);
        const meridiem = slash[7]?.toLowerCase();
        if (meridiem === 'pm' && hours < 12)
            hours += 12;
        if (meridiem === 'am' && hours === 12)
            hours = 0;
        const date = new Date(year, month - 1, day, hours, Number(slash[5] ?? 0), Number(slash[6] ?? 0));
        return date.getMonth() === month - 1 ? date : null;
    }
    const parsed = new Date(/^\d{4}-\d{2}-\d{2} \d/.test(text) ? text.replace(' ', 'T') : text);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
};
exports.toDate = toDate;
const toNumber = (value) => {
    if (value === null || value === undefined || value === '')
        return null;
    if (typeof value === 'number')
        return Number.isFinite(value) ? value : null;
    const text = String(value).trim().replace(/[,\s₦$€£]/g, '');
    if (!text)
        return null;
    const negative = /^\(.*\)$/.test(text); // accounting negatives: (1,200.00)
    const n = Number(negative ? text.slice(1, -1) : text);
    if (!Number.isFinite(n))
        return null;
    return negative ? -n : n;
};
exports.toNumber = toNumber;
const toBoolean = (value) => {
    if (typeof value === 'boolean')
        return value;
    const text = String(value ?? '').trim().toLowerCase();
    if (TRUE_WORDS.has(text))
        return true;
    if (FALSE_WORDS.has(text))
        return false;
    return null;
};
exports.toBoolean = toBoolean;
const toList = (value) => {
    if (Array.isArray(value))
        return value.map((v) => String(v).trim()).filter(Boolean);
    return String(value ?? '')
        .split(/[;|\n,]/)
        .map((v) => v.trim())
        .filter(Boolean);
};
exports.toList = toList;
const toText = (value) => {
    if (value === null || value === undefined)
        return null;
    if (value instanceof Date)
        return value.toISOString();
    const text = String(value).trim();
    return text ? text : null;
};
exports.toText = toText;
const coerce = (value, kind, order) => {
    switch (kind) {
        case 'date':
            return (0, exports.toDate)(value, order);
        case 'number':
            return (0, exports.toNumber)(value);
        case 'boolean':
            return (0, exports.toBoolean)(value);
        case 'list':
            return (0, exports.toList)(value);
        default:
            return (0, exports.toText)(value);
    }
};
/**
 * Applies the column mapping and coerces each field to its kind. Counts values
 * that were present but unreadable so the run summary can report them instead
 * of silently treating bad dates as blanks.
 */
const normaliseRecords = (rows, fields, mapping, order = 'dmy') => {
    let unreadableValues = 0;
    const records = rows.map((row, index) => {
        const values = {};
        for (const field of fields) {
            const header = mapping[field.key];
            const raw = header ? row[header] : undefined;
            const value = coerce(raw, field.kind, order);
            const present = raw !== undefined && raw !== null && String(raw).trim() !== '';
            if (present && (value === null || (Array.isArray(value) && value.length === 0)))
                unreadableValues += 1;
            values[field.key] = value;
        }
        return { rowNumber: index + 2, values };
    });
    return { records, unreadableValues };
};
exports.normaliseRecords = normaliseRecords;
/** Free-form rows (data integrity): raw header → text value. */
const rawRecords = (rows) => rows.map((row, index) => ({
    rowNumber: index + 2,
    values: Object.fromEntries(Object.entries(row).map(([k, v]) => [k, v instanceof Date ? v : (0, exports.toText)(v)])),
}));
exports.rawRecords = rawRecords;
//# sourceMappingURL=extract-parser.utility.js.map