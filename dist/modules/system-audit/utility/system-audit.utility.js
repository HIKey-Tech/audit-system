"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.toUserRef = exports.nextReference = exports.parseJson = exports.round = exports.daysBetween = exports.hoursBetween = exports.matchesAny = exports.matchesPattern = exports.normaliseKey = exports.maxSeverity = exports.SEVERITY_RANK = void 0;
const system_audit_enum_1 = require("../domain/enum/system-audit.enum");
exports.SEVERITY_RANK = {
    [system_audit_enum_1.ExceptionSeverity.Critical]: 4,
    [system_audit_enum_1.ExceptionSeverity.High]: 3,
    [system_audit_enum_1.ExceptionSeverity.Medium]: 2,
    [system_audit_enum_1.ExceptionSeverity.Low]: 1,
};
const maxSeverity = (a, b) => exports.SEVERITY_RANK[a] >= exports.SEVERITY_RANK[b] ? a : b;
exports.maxSeverity = maxSeverity;
/** Lower-case alphanumerics only — how headers and names are compared. */
const normaliseKey = (value) => value.toLowerCase().replace(/[^a-z0-9]/g, '');
exports.normaliseKey = normaliseKey;
/**
 * Case-insensitive wildcard match (`*` = any run of characters). Used for SoD
 * rules and privileged-entitlement patterns, which GBB edits as plain text.
 */
const matchesPattern = (value, pattern) => {
    const escaped = pattern
        .trim()
        .toLowerCase()
        .replace(/[.+?^${}()|[\]\\]/g, '\\$&')
        .replace(/\*/g, '.*');
    return new RegExp(`^${escaped}$`).test(value.trim().toLowerCase());
};
exports.matchesPattern = matchesPattern;
const matchesAny = (value, patterns) => patterns.some((p) => (0, exports.matchesPattern)(value, p));
exports.matchesAny = matchesAny;
const hoursBetween = (from, to) => (to.getTime() - from.getTime()) / 3_600_000;
exports.hoursBetween = hoursBetween;
const daysBetween = (from, to) => (0, exports.hoursBetween)(from, to) / 24;
exports.daysBetween = daysBetween;
const round = (value, places = 1) => {
    const f = 10 ** places;
    return Math.round(value * f) / f;
};
exports.round = round;
const parseJson = (value, fallback) => {
    if (!value)
        return fallback;
    try {
        return JSON.parse(value);
    }
    catch {
        return fallback;
    }
};
exports.parseJson = parseJson;
/**
 * Next yearly reference for a prefix, e.g. SAR-2026-0007. Callers retry once on
 * a unique-constraint clash (two runs created in the same instant).
 */
const nextReference = (prefix, latest, now = new Date()) => {
    const year = now.getFullYear();
    const match = latest?.match(new RegExp(`^${prefix}-${year}-(\\d+)$`));
    const next = match ? Number(match[1]) + 1 : 1;
    return `${prefix}-${year}-${String(next).padStart(4, '0')}`;
};
exports.nextReference = nextReference;
const toUserRef = (user) => user
    ? { id: user.id, name: user.display_name?.trim() || `${user.first_name} ${user.last_name}`.trim() || user.email }
    : null;
exports.toUserRef = toUserRef;
//# sourceMappingURL=system-audit.utility.js.map