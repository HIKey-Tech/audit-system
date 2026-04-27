"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OidcCallbackRequestSchema = exports.RefreshTokenRequestSchema = exports.LoginRequestSchema = void 0;
// src/modules/user/dto/request/auth.request.dto.ts
const zod_1 = require("zod");
exports.LoginRequestSchema = zod_1.z.object({
    email: zod_1.z.string().email('Invalid email address'),
    password: zod_1.z.string().min(8, 'Password must be at least 8 characters'),
});
exports.RefreshTokenRequestSchema = zod_1.z.object({
    refreshToken: zod_1.z.string().min(1, 'Refresh token is required'),
});
exports.OidcCallbackRequestSchema = zod_1.z.object({
    code: zod_1.z.string(),
    state: zod_1.z.string().min(1, 'state is required'),
    session_state: zod_1.z.string().optional(),
});
//# sourceMappingURL=auth.request.dto.js.map