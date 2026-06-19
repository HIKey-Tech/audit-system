"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SetSignatureMetadataSchema = void 0;
// src/modules/user/dto/request/signature.request.dto.ts
const zod_1 = require("zod");
exports.SetSignatureMetadataSchema = zod_1.z.object({
    kind: zod_1.z.enum(['drawn', 'uploaded']),
});
//# sourceMappingURL=signature.request.dto.js.map