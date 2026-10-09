"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.mapAccessItemToResponse = void 0;
const system_audit_utility_1 = require("../../../utility/system-audit.utility");
const mapAccessItemToResponse = (item) => ({
    id: item.id,
    runId: item.run_id,
    accountId: item.account_id,
    displayName: item.display_name,
    email: item.email,
    department: item.department,
    accountStatus: item.account_status,
    isPrivileged: item.is_privileged,
    lastLoginAt: item.last_login_at?.toISOString() ?? null,
    entitlements: (0, system_audit_utility_1.parseJson)(item.entitlements, []),
    flags: (0, system_audit_utility_1.parseJson)(item.flags, []),
    decision: item.decision,
    decisionNote: item.decision_note,
    decidedBy: (0, system_audit_utility_1.toUserRef)(item.decided_by),
    decidedAt: item.decided_at?.toISOString() ?? null,
});
exports.mapAccessItemToResponse = mapAccessItemToResponse;
//# sourceMappingURL=access-review.response.dto.js.map