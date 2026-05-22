"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.daysBetween = exports.daysFromNow = exports.startOfNextMonth = exports.startOfCurrentMonth = exports.startOfCurrentYear = exports.isRestrictedAuditee = exports.isRestrictedAuditor = exports.hasAdminLevelRole = exports.AUDITEE_ROLE = exports.DASHBOARD_AUDITOR_ROLES = exports.DASHBOARD_ADMIN_ROLES = void 0;
// Roles whose holder always sees data across the entire organisation.
exports.DASHBOARD_ADMIN_ROLES = [
    'super_admin',
    'audit_admin',
    'audit_manager',
    'director',
    'cae',
];
exports.DASHBOARD_AUDITOR_ROLES = [
    'audit_lead',
    'auditor',
];
exports.AUDITEE_ROLE = 'auditee';
const hasAdminLevelRole = (roles) => roles.some((role) => exports.DASHBOARD_ADMIN_ROLES.includes(role));
exports.hasAdminLevelRole = hasAdminLevelRole;
// True when the user must be scoped to engagements they lead.
// Admin-level roles always override the scoping.
const isRestrictedAuditor = (roles) => !(0, exports.hasAdminLevelRole)(roles)
    && roles.some((role) => exports.DASHBOARD_AUDITOR_ROLES.includes(role));
exports.isRestrictedAuditor = isRestrictedAuditor;
// True when the user must be scoped to findings against them.
// Admin-level roles always override the scoping.
const isRestrictedAuditee = (roles) => !(0, exports.hasAdminLevelRole)(roles) && roles.includes(exports.AUDITEE_ROLE);
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