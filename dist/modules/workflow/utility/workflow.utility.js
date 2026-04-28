"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.hasElapsed = exports.hoursAgo = exports.assertHasRole = exports.WORKFLOW_APPROVER_ROLES = exports.WORKFLOW_ADMIN_ROLES = void 0;
const app_error_1 = require("../../../shared/errors/app.error");
exports.WORKFLOW_ADMIN_ROLES = ['super_admin', 'audit_admin'];
exports.WORKFLOW_APPROVER_ROLES = ['super_admin', 'audit_admin', 'audit_lead'];
const assertHasRole = (roles, allowedRoles, message = 'Insufficient role for this workflow action') => {
    if (!roles.some((role) => allowedRoles.includes(role))) {
        throw app_error_1.AppError.forbidden(message);
    }
};
exports.assertHasRole = assertHasRole;
const hoursAgo = (hours) => {
    const value = new Date();
    value.setHours(value.getHours() - hours);
    return value;
};
exports.hoursAgo = hoursAgo;
const hasElapsed = (from, hours, now = new Date()) => now.getTime() - from.getTime() >= hours * 60 * 60 * 1000;
exports.hasElapsed = hasElapsed;
//# sourceMappingURL=workflow.utility.js.map