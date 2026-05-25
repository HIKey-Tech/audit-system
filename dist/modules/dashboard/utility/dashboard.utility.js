"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.daysBetween = exports.daysFromNow = exports.startOfNextMonth = exports.startOfCurrentMonth = exports.startOfCurrentYear = exports.isRestrictedAuditee = exports.isRestrictedAuditor = void 0;
// True when the user must be scoped to engagements they lead.
// Having engagement:read_all overrides the scoping.
const isRestrictedAuditor = (permissions) => !permissions.includes('engagement:read_all') && permissions.includes('engagement:read');
exports.isRestrictedAuditor = isRestrictedAuditor;
// True when the user must be scoped to findings against them.
// Having finding:read_all overrides the scoping.
const isRestrictedAuditee = (permissions) => !permissions.includes('finding:read_all') && (permissions.includes('followup:respond') || !permissions.includes('engagement:read'));
exports.isRestrictedAuditee = isRestrictedAuditee;
const startOfCurrentYear = (now = new Date()) => new Date(now.getFullYear(), 0, 1);
exports.startOfCurrentYear = startOfCurrentYear;
const startOfCurrentMonth = (now = new Date()) => new Date(now.getFullYear(), now.getMonth(), 1);
exports.startOfCurrentMonth = startOfCurrentMonth;
const startOfNextMonth = (now = new Date()) => new Date(now.getFullYear(), now.getMonth() + 1, 1);
exports.startOfNextMonth = startOfNextMonth;
const daysFromNow = (days, now = new Date()) => {
    const result = new Date(now);
    result.setDate(result.getDate() + days);
    return result;
};
exports.daysFromNow = daysFromNow;
const daysBetween = (earlier, later) => {
    const ms = later.getTime() - earlier.getTime();
    return Math.floor(ms / (1000 * 60 * 60 * 24));
};
exports.daysBetween = daysBetween;
//# sourceMappingURL=dashboard.utility.js.map