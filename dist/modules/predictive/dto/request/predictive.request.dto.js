"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.InsightFeedbackSchema = void 0;
const zod_1 = require("zod");
exports.InsightFeedbackSchema = zod_1.z.object({
    feedback: zod_1.z.enum(['useful', 'not_useful', 'dismissed']),
    comment: zod_1.z.string().trim().max(500).optional(),
});
//# sourceMappingURL=predictive.request.dto.js.map