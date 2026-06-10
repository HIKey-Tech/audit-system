"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.hasElapsed = exports.hoursAgo = exports.assertHasPermission = void 0;
const app_error_1 = require("../../../shared/errors/app.error");
/** Permission-based authorization gate (see audit.utility for rationale). */
const assertHasPermission = (permissions, required, message = 'Insufficient permission for this action') => {
    if (!permissions.includes(required)) {
        throw app_error_1.AppError.forbidden(message);
    }
};
exports.assertHasPermission = assertHasPermission;
const hoursAgo = (hours) => {
    const value = new Date();
    value.setHours(value.getHours() - hours);
    return value;
};
exports.hoursAgo = hoursAgo;
const hasElapsed = (from, hours, now = new Date()) => now.getTime() - from.getTime() >= hours * 60 * 60 * 1000;
exports.hasElapsed = hasElapsed;
//# sourceMappingURL=workflow.utility.js.map