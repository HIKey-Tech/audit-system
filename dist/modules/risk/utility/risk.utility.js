"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.toIso = exports.getRiskScoreBand = exports.calculateRiskScore = exports.assertHasPermission = exports.assertHasRole = exports.hasAuditeeRole = exports.AUDITEE_ROLE = exports.RISK_ASSESSOR_ROLES = exports.RISK_ADMIN_ROLES = void 0;
const app_error_1 = require("../../../shared/errors/app.error");
const risk_enum_1 = require("../domain/enum/risk.enum");
exports.RISK_ADMIN_ROLES = ['super_admin', 'audit_admin'];
exports.RISK_ASSESSOR_ROLES = ['super_admin', 'audit_admin', 'audit_lead'];
exports.AUDITEE_ROLE = 'auditee';
const hasAuditeeRole = (roles) => roles.includes(exports.AUDITEE_ROLE);
exports.hasAuditeeRole = hasAuditeeRole;
const assertHasRole = (roles, allowedRoles, message = 'Insufficient role for this risk action') => {
    if (!roles.some((role) => allowedRoles.includes(role))) {
        throw app_error_1.AppError.forbidden(message);
    }
};
exports.assertHasRole = assertHasRole;
/** Permission-based authorization gate (see audit.utility for rationale). */
const assertHasPermission = (permissions, required, message = 'Insufficient permission for this action') => {
    if (!permissions.includes(required)) {
        throw app_error_1.AppError.forbidden(message);
    }
};
exports.assertHasPermission = assertHasPermission;
const calculateRiskScore = (likelihood, impact) => likelihood * impact;
exports.calculateRiskScore = calculateRiskScore;
const getRiskScoreBand = (score) => {
    if (score <= 5)
        return risk_enum_1.RiskScoreBand.Low;
    if (score <= 12)
        return risk_enum_1.RiskScoreBand.Medium;
    if (score <= 19)
        return risk_enum_1.RiskScoreBand.High;
    return risk_enum_1.RiskScoreBand.Critical;
};
exports.getRiskScoreBand = getRiskScoreBand;
const toIso = (value) => value ? value.toISOString() : null;
exports.toIso = toIso;
//# sourceMappingURL=risk.utility.js.map