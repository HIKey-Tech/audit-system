"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.hasElapsed = exports.hoursAgo = exports.getEscalationMatrix = exports.DEFAULT_ESCALATION_MATRIX = exports.assertHasPermission = void 0;
const app_error_1 = require("../../../shared/errors/app.error");
const prisma_client_1 = require("../../../shared/prisma/prisma.client");
const logger_util_1 = require("../../../shared/utils/logger.util");
/** Permission-based authorization gate (see audit.utility for rationale). */
const assertHasPermission = (permissions, required, message = 'Insufficient permission for this action') => {
    if (!permissions.includes(required)) {
        throw app_error_1.AppError.forbidden(message);
    }
};
exports.assertHasPermission = assertHasPermission;
exports.DEFAULT_ESCALATION_MATRIX = {
    auditEngagement: { level3: ['director'], beyond: ['cae'] },
    workflowApproval: { level3: ['director'], level4: ['cae'], otherwise: ['audit_manager'] },
};
const getEscalationMatrix = async () => {
    const parsed = await getJsonConfig('escalation_matrix', {});
    return {
        auditEngagement: { ...exports.DEFAULT_ESCALATION_MATRIX.auditEngagement, ...parsed.auditEngagement },
        workflowApproval: { ...exports.DEFAULT_ESCALATION_MATRIX.workflowApproval, ...parsed.workflowApproval },
    };
};
exports.getEscalationMatrix = getEscalationMatrix;
const getJsonConfig = async (key, fallback) => {
    const config = await prisma_client_1.prisma.system_Config.findUnique({
        where: { key },
        select: { value: true },
    });
    if (!config?.value)
        return fallback;
    try {
        return JSON.parse(config.value);
    }
    catch (err) {
        logger_util_1.logger.warn('Invalid JSON system config; using fallback', { key, err });
        return fallback;
    }
};
const hoursAgo = (hours) => {
    const value = new Date();
    value.setHours(value.getHours() - hours);
    return value;
};
exports.hoursAgo = hoursAgo;
const hasElapsed = (from, hours, now = new Date()) => now.getTime() - from.getTime() >= hours * 60 * 60 * 1000;
exports.hasElapsed = hasElapsed;
//# sourceMappingURL=workflow.utility.js.map