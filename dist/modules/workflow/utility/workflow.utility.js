"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.hasElapsed = exports.hoursAgo = exports.warnOnUnresolvableEscalationTargets = exports.getEscalationMatrix = exports.DEFAULT_ESCALATION_MATRIX = exports.assertHasPermission = void 0;
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
/**
 * Boot-time sanity check: warn when an escalation tier targets role names
 * that no active user holds (e.g. a deployment renamed/replaced the seeded
 * director/cae roles without updating `system_config.escalation_matrix`) —
 * escalations at that tier would notify nobody. Never throws.
 */
const warnOnUnresolvableEscalationTargets = async () => {
    try {
        const matrix = await (0, exports.getEscalationMatrix)();
        const tiers = [
            ['auditEngagement.level3', matrix.auditEngagement.level3],
            ['auditEngagement.beyond', matrix.auditEngagement.beyond],
            ['workflowApproval.level3', matrix.workflowApproval.level3],
            ['workflowApproval.level4', matrix.workflowApproval.level4],
            ['workflowApproval.otherwise', matrix.workflowApproval.otherwise],
        ];
        const roleNames = [...new Set(tiers.flatMap(([, roles]) => roles))];
        if (roleNames.length === 0)
            return;
        const holders = await prisma_client_1.prisma.user.findMany({
            where: {
                deleted_at: null,
                is_active: true,
                user_roles: { some: { role: { name: { in: roleNames } } } },
            },
            select: { user_roles: { select: { role: { select: { name: true } } } } },
        });
        const covered = new Set(holders.flatMap((user) => user.user_roles.map((userRole) => userRole.role.name)));
        for (const [tier, roles] of tiers) {
            if (roles.length > 0 && !roles.some((role) => covered.has(role))) {
                logger_util_1.logger.warn(`Escalation matrix tier "${tier}" targets roles [${roles.join(', ')}] but no active ` +
                    'user holds any of them — escalations at this tier will notify nobody. Update ' +
                    'system_config.escalation_matrix in Settings or assign the roles to users.');
            }
        }
    }
    catch (err) {
        logger_util_1.logger.warn('Escalation matrix startup check failed (non-fatal)', { err });
    }
};
exports.warnOnUnresolvableEscalationTargets = warnOnUnresolvableEscalationTargets;
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