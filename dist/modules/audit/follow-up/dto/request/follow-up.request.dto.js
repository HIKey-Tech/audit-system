"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.VerifyRemediationRequestSchema = exports.RemediationEvidenceRequestSchema = exports.ManagementResponseRequestSchema = void 0;
const zod_1 = require("zod");
const audit_enum_1 = require("../../../domain/enum/audit.enum");
exports.ManagementResponseRequestSchema = zod_1.z.object({
    managementResponse: zod_1.z.string().min(1).max(10000),
});
exports.RemediationEvidenceRequestSchema = zod_1.z.object({
    evidenceId: zod_1.z.string().uuid(),
});
exports.VerifyRemediationRequestSchema = zod_1.z.object({
    verificationStatus: zod_1.z.enum([audit_enum_1.VerificationStatus.Verified, audit_enum_1.VerificationStatus.Rejected]),
    verificationNotes: zod_1.z.string().max(5000).optional(),
});
//# sourceMappingURL=follow-up.request.dto.js.map