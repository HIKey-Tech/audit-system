"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.toIso = exports.getRiskScoreBand = exports.calculateRiskScore = exports.assertHasPermission = void 0;
const app_error_1 = require("../../../shared/errors/app.error");
const risk_enum_1 = require("../domain/enum/risk.enum");
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